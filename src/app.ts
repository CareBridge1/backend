import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import paymentRoutes from './modules/payment/payment.routes';
import transactionRoutes from './modules/transaction/transaction.routes';
import patientRoutes from './modules/patient/patient.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// CORS
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:5800','https://care-now-pay-later.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CareNow PayLater API', version: '1.0.0' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment-links', paymentRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/patients', patientRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use(errorMiddleware);

export default app;
