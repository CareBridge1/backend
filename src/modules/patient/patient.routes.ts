import { Router } from 'express'
import { requestOtp, verifyOtp, getPatientHistory } from './patient.controller'
import { authMiddleware } from '../../middleware/auth.middleware'

const router = Router()

router.post('/verify-contact', requestOtp)
router.post('/confirm-otp', verifyOtp)
// Uses auth middleware, :contact parameter is optional or used for validation
router.get('/:contact/payment-links', authMiddleware, getPatientHistory)
router.get('/payment-links', authMiddleware, getPatientHistory)

export default router
