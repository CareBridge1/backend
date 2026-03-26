import axios from 'axios';
import { env } from '../config/env';
import { generateRef } from '../utils/generateRef';

interface InterswitchTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

import crypto from 'crypto';

interface InterswitchPaymentInitResponse {
  paymentUrl: string;
  transactionRef: string;
  formParams?: Record<string, string>;
  checkoutScriptUrl?: string;
}

// Removed OAuth token fetching for WebPay hosted flow

// Initiate a payment via Interswitch QuickTeller
export const initiatePayment = async (
  amount: number,
  paymentLinkId: string,
  customerEmail: string,
  customerName: string
): Promise<InterswitchPaymentInitResponse> => {
  const transactionRef = generateRef();
  const amountInKobo = Math.round(amount * 100);

  // In sandbox/demo mode when credentials are not configured
  if (!env.INTERSWITCH.CLIENT_ID) {
    // Return a mock URL for demo purposes
    const mockUrl = `${env.FRONTEND_URL}/pay/${paymentLinkId}/checkout?ref=${transactionRef}&amount=${amountInKobo}&demo=true`;
    return { paymentUrl: mockUrl, transactionRef };
  }

  // Use Interswitch WebPay hosted checkout
  const redirectUrl = `${env.FRONTEND_URL}/pay/${paymentLinkId}/verify?ref=${transactionRef}`;
  
  // Hash formula: SHA512(txn_ref + pay_item_id + amount + site_redirect_url + MAC_KEY)
  const hashString = `${transactionRef}${env.INTERSWITCH.PAY_ITEM_ID}${amountInKobo}${redirectUrl}${env.INTERSWITCH.CLIENT_SECRET}`;
  const hash = crypto.createHash('sha512').update(hashString).digest('hex');

  const formParams = {
    merchant_code: env.INTERSWITCH.MERCHANT_CODE,
    pay_item_id: env.INTERSWITCH.PAY_ITEM_ID,
    txn_ref: transactionRef,
    amount: amountInKobo.toString(),
    currency: '566', // NGN
    site_redirect_url: redirectUrl,
    cust_id: customerEmail,
    cust_email: customerEmail,
    cust_name: customerName,
    hash: hash,
  };

  const isQA = env.INTERSWITCH.BASE_URL.includes('qa');
  const webpayUrl = isQA 
    ? 'https://newwebpay.qa.interswitchng.com/collections/w/pay' 
    : 'https://newwebpay.interswitchng.com/collections/w/pay';

  const checkoutScriptUrl = isQA 
    ? 'https://newwebpay.qa.interswitchng.com/inline-checkout.js' 
    : 'https://newwebpay.interswitchng.com/inline-checkout.js';

  return {
    paymentUrl: webpayUrl,
    transactionRef,
    formParams: {
      ...formParams,
      mode: isQA ? 'TEST' : 'LIVE',
    },
    checkoutScriptUrl,
  };
};

// Verify a transaction via Interswitch
export const verifyPayment = async (
  transactionRef: string,
  amount: number
): Promise<{ status: string; message: string; data?: Record<string, unknown> }> => {
  // Demo mode
  if (!env.INTERSWITCH.CLIENT_ID) {
    return {
      status: 'successful',
      message: 'Payment verified (demo mode)',
      data: { transactionReference: transactionRef, amount },
    };
  }

  // Also fix verification array response check 
  // For WebPay, verification usually hits /api/v2/quickteller/transactions?site_redirect_url doesn't match E42
  // We'll use the WebPay transaction polling endpoint:
  try {
    const response = await axios.get(
      `${env.INTERSWITCH.BASE_URL}/collections/api/v1/gettransaction.json?merchantcode=${env.INTERSWITCH.MERCHANT_CODE}&transactionreference=${transactionRef}&amount=${amountInKobo}`
    );
     // Webpay uses response.data.ResponseCode === '00'
     const responseCode = response.data.ResponseCode || response.data.responseCode;
     const isSuccess = responseCode === '00';
   
     return {
       status: isSuccess ? 'successful' : 'failed',
       message: response.data.ResponseDescription || response.data.responseDescription || 'Unknown status',
       data: response.data,
     };
  } catch (err: any) {
    return {
       status: 'failed',
       message: 'Transaction verification error',
       data: err.response?.data || {}
    }
  }
};
