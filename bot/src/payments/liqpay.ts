import crypto from 'crypto';
import { config } from '../config.js';

interface PaymentParams {
  orderId: string;
  amount: number; // in UAH (not kopiykas)
  description: string;
  productId: string;
}

export function createPaymentLink(params: PaymentParams): string {
  const data = {
    public_key: config.LIQPAY_PUBLIC_KEY,
    version: '3',
    action: 'pay',
    amount: params.amount,
    currency: 'UAH',
    description: params.description,
    order_id: params.orderId,
    server_url: `https://li-astrology-bot.up.railway.app/webhook/liqpay`,
    result_url: `https://t.me/li_astrology_bot`,
  };

  const dataBase64 = Buffer.from(JSON.stringify(data)).toString('base64');
  const signature = generateSignature(dataBase64);

  // LiqPay checkout URL with encoded data
  return `https://www.liqpay.ua/api/3/checkout?data=${encodeURIComponent(dataBase64)}&signature=${encodeURIComponent(signature)}`;
}

export function generateSignature(dataBase64: string): string {
  const signString = config.LIQPAY_PRIVATE_KEY + dataBase64 + config.LIQPAY_PRIVATE_KEY;
  return crypto.createHash('sha1').update(signString).digest('base64');
}

export function verifySignature(dataBase64: string, signature: string): boolean {
  const expected = generateSignature(dataBase64);
  return expected === signature;
}

export function decodeData(dataBase64: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(dataBase64, 'base64').toString('utf-8'));
}
