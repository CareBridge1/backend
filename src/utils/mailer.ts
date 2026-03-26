import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.MAIL.HOST,
  port: env.MAIL.PORT,
  secure: env.MAIL.PORT === 465, // true for 465, false for other ports
  auth: {
    user: env.MAIL.USER,
    pass: env.MAIL.PASS,
  },
});

export const sendOTPEmail = async (to: string, otp: string) => {
  const mailOptions = {
    from: env.MAIL.FROM,
    to,
    subject: 'Your CareBridge OTP Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2c3e50; text-align: center;">CareBridge Verification</h2>
        <p style="font-size: 16px; color: #34495e;">Hello,</p>
        <p style="font-size: 16px; color: #34495e;">Your OTP code for login is:</p>
        <div style="background-color: #f7f9fa; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2980b9;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #7f8c8d;">This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
        <p style="font-size: 12px; color: #bdc3c7; text-align: center;">&copy; 2026 CareBridge. All rights reserved.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    // In development/sandbox, we might want to still log the OTP if email fails
    if (env.NODE_ENV === 'development') {
      console.log(`[DEV] Proposed OTP for ${to}: ${otp}`);
    }
    throw new Error('Failed to send OTP email');
  }
};
