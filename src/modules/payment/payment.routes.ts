import { Router } from 'express';
import {
  createPaymentLink,
  getPaymentLinks,
  getPaymentLinkById,
  initiateInstallmentPayment,
} from './payment.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// Protected routes (hospital)
router.post('/', authMiddleware, createPaymentLink);
router.get('/', authMiddleware, getPaymentLinks);

// Public routes (patient)
router.get('/:id', getPaymentLinkById);
router.post('/:id/pay', initiateInstallmentPayment);

export default router;
