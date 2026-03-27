import { Request, Response } from 'express';
import { prisma } from '../../config/db';
import { initiatePayment } from '../../integrations/interswitch';
import { AuthRequest } from '../../middleware/auth.middleware';

export const createPaymentLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, patientContact, patientName, description, duration, installmentAmount } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ message: 'Valid amount is required' });
      return;
    }
    if (!patientContact) {
      res.status(400).json({ message: 'Patient phone or email is required' });
      return;
    }

    const isEmail = patientContact.includes('@');
    
    // Find or create patient
    let patient = await prisma.patient.findFirst({
      where: isEmail ? { email: patientContact } : { phone: patientContact }
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name: patientName || null,
          email: isEmail ? patientContact : null,
          phone: isEmail ? null : patientContact,
        }
      });
    } else if (patientName && !patient.name) {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: { name: patientName }
      });
    }

    const paymentLink = await prisma.paymentLink.create({
      data: {
        amount: Number(amount),
        duration: duration ? Number(duration) : 1,
        installmentAmount: installmentAmount ? Number(installmentAmount) : null,
        description: description || null,
        userId: req.userId!,
        patientId: patient.id,
      },
      include: {
        user: { select: { hospitalName: true, email: true } },
        patient: { select: { name: true, phone: true, email: true } }
      },
    });

    const linkUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pay/${paymentLink.id}`;

    res.status(201).json({
      message: 'Payment link created',
      paymentLink: {
        id: paymentLink.id,
        amount: paymentLink.amount,
        duration: paymentLink.duration,
        installmentAmount: paymentLink.installmentAmount,
        patientName: paymentLink.patient.name,
        patientContact: paymentLink.patient.phone || paymentLink.patient.email,
        description: paymentLink.description,
        status: paymentLink.status,
        createdAt: paymentLink.createdAt,
        linkUrl,
        hospital: paymentLink.user.hospitalName,
      },
    });
  } catch (err) {
    console.error('Create payment link error:', err);
    res.status(500).json({ message: 'Failed to create payment link' });
  }
};

export const getPaymentLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const links = await prisma.paymentLink.findMany({
      where: { userId: req.userId! },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 5 },
        user: { select: { hospitalName: true } },
        patient: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = links.map((link: any) => ({
      id: link.id,
      amount: link.amount,
      duration: link.duration,
      installmentAmount: link.installmentAmount,
      patientName: link.patient?.name,
      patientContact: link.patient?.phone || link.patient?.email,
      description: link.description,
      status: link.status,
      createdAt: link.createdAt,
      linkUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pay/${link.id}`,
      hospital: link.user.hospitalName,
      transactions: link.transactions,
      amountPaid: link.transactions
        .filter((t: any) => t.status === 'SUCCESS')
        .reduce((sum: number, t: any) => sum + t.amount, 0),
    }));

    res.json({ paymentLinks: result });
  } catch (err) {
    console.error('Get payment links error:', err);
    res.status(500).json({ message: 'Failed to fetch payment links' });
  }
};

export const getPaymentLinkById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const link = await prisma.paymentLink.findUnique({
      where: { id },
      include: {
        user: { select: { hospitalName: true, email: true } },
        patient: true,
        transactions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!link) {
      res.status(404).json({ message: 'Payment link not found' });
      return;
    }

    const amountPaid = link.transactions
      .filter((t: any) => t.status === 'SUCCESS')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    res.json({
      id: link.id,
      amount: link.amount,
      duration: link.duration,
      installmentAmount: link.installmentAmount,
      patientName: link.patient?.name,
      patientContact: link.patient?.phone || link.patient?.email,
      description: link.description,
      status: link.status,
      createdAt: link.createdAt,
      hospital: link.user.hospitalName,
      transactions: link.transactions,
      amountPaid,
      amountRemaining: link.amount - amountPaid,
    });
  } catch (err) {
    console.error('Get payment link by id error:', err);
    res.status(500).json({ message: 'Failed to fetch payment link' });
  }
};

export const initiateInstallmentPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, patientEmail: bodyEmail, patientName: bodyName } = req.body;

    const link = await prisma.paymentLink.findUnique({
      where: { id },
      include: {
        user: { select: { hospitalName: true } },
        patient: true,
        transactions: true,
      },
    });

    if (!link) {
      res.status(404).json({ message: 'Payment link not found' });
      return;
    }

    if (link.status === 'PAID') {
      res.status(400).json({ message: 'This payment link has already been fully paid' });
      return;
    }

    const amountPaid = link.transactions
      .filter((t: any) => t.status === 'SUCCESS')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const remainingAmount = link.amount - amountPaid;

    const requestedAmount = Number(amount);
    if (!requestedAmount || isNaN(requestedAmount) || requestedAmount <= 0) {
      res.status(400).json({ message: 'Valid payment amount is required' });
      return;
    }
    
    // Allow minor floating point differences, but prevent massive overpayment.
    if (requestedAmount > remainingAmount + 1) {
      res.status(400).json({ message: `Cannot pay more than remaining balance of ${remainingAmount}` });
      return;
    }

    const installmentAmount = requestedAmount;
    const installmentNumber = link.transactions.filter((t: any) => t.status === 'SUCCESS').length + 1;

    // Prefer request-body overrides, then Patient record, then safe fallbacks
    const patientEmail = bodyEmail || link.patient.email || `patient-${link.patient.id.slice(0,8)}@carenow.app`;
    const patientName = bodyName || link.patient.name || 'Patient';

    const { paymentUrl, transactionRef, formParams, checkoutScriptUrl } = await initiatePayment(
      installmentAmount,
      id,
      patientEmail,
      patientName
    );

    // Create pending transaction record
    await prisma.transaction.create({
      data: {
        paymentLinkId: id,
        amount: installmentAmount,
        transactionRef,
        installment: installmentNumber,
        status: 'PENDING',
      },
    });

    res.json({
      message: 'Payment initiated',
      paymentUrl,
      transactionRef,
      formParams,
      checkoutScriptUrl,
      installmentAmount,
      installmentNumber,
    });
  } catch (err) {
    console.error('Initiate payment error:', err);
    res.status(500).json({ message: 'Failed to initiate payment' });
  }
};
