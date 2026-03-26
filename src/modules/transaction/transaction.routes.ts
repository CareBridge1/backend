import { Router } from 'express';
import { verifyTransaction, getTransactionsByLink, handleInterswitchWebhook } from './transaction.controller';

const router = Router();

router.post('/webhook', handleInterswitchWebhook);
router.post('/verify', verifyTransaction);
router.get('/link/:paymentLinkId', getTransactionsByLink);

export default router;
