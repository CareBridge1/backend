import { Request, Response } from 'express'
import { prisma } from '../../config/db'
import jwt from 'jsonwebtoken'

// Basic mock function to "send" OTP
const sendOTP = async (contact: string, otp: string) => {
  console.log(`\n\n=== 🔐 MOCK OTP DISPATCH ===`)
  console.log(`Sending to: ${contact}`)
  console.log(`OTP Code: ${otp}`)
  console.log(`==============================\n\n`)
}

export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { contact } = req.body
    if (!contact) {
      return res.status(400).json({ error: 'Phone or email is required' })
    }

    const isEmail = contact.includes('@')
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpiresAt = new Date(Date.now() + 10 * 60000) // 10 mins

    let patient = await prisma.patient.findFirst({
      where: isEmail ? { email: contact } : { phone: contact }
    })

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          email: isEmail ? contact : null,
          phone: isEmail ? null : contact,
          otp,
          otpExpiresAt
        }
      })
    } else {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: { otp, otpExpiresAt }
      })
    }

    await sendOTP(contact, otp)

    res.json({ message: 'OTP sent successfully' })
  } catch (error) {
    console.error('Request OTP error:', error)
    res.status(500).json({ error: 'Failed to request OTP' })
  }
}

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { contact, otp } = req.body
    if (!contact || !otp) {
      return res.status(400).json({ error: 'Contact and OTP are required' })
    }

    const isEmail = contact.includes('@')
    const patient = await prisma.patient.findFirst({
      where: isEmail ? { email: contact } : { phone: contact }
    })

    if (!patient || patient.otp !== otp || !patient.otpExpiresAt || patient.otpExpiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired OTP' })
    }

    await prisma.patient.update({
      where: { id: patient.id },
      data: { otp: null, otpExpiresAt: null }
    })

    const token = jwt.sign(
      { userId: patient.id, role: 'patient' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    )

    res.json({
      token,
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone
      }
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    res.status(500).json({ error: 'Failed to verify OTP' })
  }
}

export const getPatientHistory = async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).userId

    if (!patientId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const links = await prisma.paymentLink.findMany({
      where: { patientId },
      include: {
        user: {
          select: { hospitalName: true }
        },
        transactions: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ links })
  } catch (error) {
    console.error('Get history error:', error)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
}
