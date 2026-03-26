import { Request, Response } from 'express';
import { prisma } from '../../config/db';
import { verifyPayment } from '../../integrations/interswitch';

export const handleInterswitchWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Interswitch sends transaction state in the body
    const { transactionReference, amount, responseCode } = req.body;

    if (!transactionReference) {
      res.status(400).json({ message: 'Transaction reference missing' });
      return;
    }

    const transaction = await prisma.transaction.findUnique({
      where: { transactionRef: transactionReference },
      include: { paymentLink: true },
    });

    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    if (transaction.status === 'SUCCESS') {
      res.status(200).send('Already processed');
      return;
    }

    // Verify S2S instead of relying entirely on the payload
    const result = await verifyPayment(transactionReference, transaction.amount);
    const isSuccess = result.status === 'successful';

    const updatedTransaction = await prisma.transaction.update({
      where: { transactionRef: transactionReference },
      data: { status: isSuccess ? 'SUCCESS' : 'FAILED' },
    });

    if (isSuccess) {
      const allTransactions = await prisma.transaction.findMany({
        where: { paymentLinkId: transaction.paymentLinkId, status: 'SUCCESS' },
      });

      const totalPaid = allTransactions.reduce((sum, t) => sum + t.amount, 0);
      const newStatus = totalPaid >= transaction.paymentLink.amount ? 'PAID' : 'PARTIAL';

      await prisma.paymentLink.update({
        where: { id: transaction.paymentLinkId },
        data: { status: newStatus },
      });
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Server Error');
  }
};

export const verifyTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionRef } = req.body;

    if (!transactionRef) {
      res.status(400).json({ message: 'Transaction reference is required' });
      return;
    }

    const transaction = await prisma.transaction.findUnique({
      where: { transactionRef },
      include: { paymentLink: true },
    });

    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    if (transaction.status === 'SUCCESS') {
      res.json({ message: 'Transaction already verified', status: 'SUCCESS', transaction });
      return;
    }

    const result = await verifyPayment(transactionRef, transaction.amount);
    const isSuccess = result.status === 'successful';

    // Update transaction status
    const updatedTransaction = await prisma.transaction.update({
      where: { transactionRef },
      data: { status: isSuccess ? 'SUCCESS' : 'FAILED' },
    });

    if (isSuccess) {
      // Check if payment link is now fully paid
      const allTransactions = await prisma.transaction.findMany({
        where: {
          paymentLinkId: transaction.paymentLinkId,
          status: 'SUCCESS',
        },
      });

      const totalPaid = allTransactions.reduce((sum, t) => sum + t.amount, 0);
      const newStatus =
        totalPaid >= transaction.paymentLink.amount
          ? 'PAID'
          : totalPaid > 0
          ? 'PARTIAL'
          : 'PENDING';

      await prisma.paymentLink.update({
        where: { id: transaction.paymentLinkId },
        data: { status: newStatus },
      });
    }

    res.json({
      message: isSuccess ? 'Payment successful!' : 'Payment failed',
      status: updatedTransaction.status,
      transaction: updatedTransaction,
      interswitchData: result.data,
    });
  } catch (err) {
    console.error('Verify transaction error:', err);
    res.status(500).json({ message: 'Failed to verify transaction' });
  }
};

export const getTransactionsByLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentLinkId } = req.params;
    const transactions = await prisma.transaction.findMany({
      where: { paymentLinkId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ transactions });
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};
