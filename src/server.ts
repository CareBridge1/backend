import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { env } from './config/env';
import { prisma } from './config/db';

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    app.listen(env.PORT, () => {
      console.log(`🚀 CareNow PayLater API running on port ${env.PORT}`);
      console.log(`📍 Health: http://localhost:${env.PORT}/health`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
