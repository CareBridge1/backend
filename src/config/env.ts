import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'carenow_secret_key',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  INTERSWITCH: {
    CLIENT_ID: process.env.INTERSWITCH_CLIENT_ID || '',
    CLIENT_SECRET: process.env.INTERSWITCH_CLIENT_SECRET || '',
    BASE_URL: process.env.INTERSWITCH_BASE_URL || 'https://qa.interswitchng.com',
    PAY_ITEM_ID: process.env.INTERSWITCH_PAY_ITEM_ID || '',
    MERCHANT_CODE: process.env.INTERSWITCH_MERCHANT_CODE || '',
  },
};
