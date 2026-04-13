import { Request, Response } from 'express';
import { Bot } from 'grammy';
import { BotContext } from '../bot.js';
import { verifySignature, decodeData } from './liqpay.js';
import { getCourseBySlug } from '../db/courses.js';
import { grantAccess, hasAccess } from '../db/purchases.js';
import { uk } from '../locales/uk.js';
import { InlineKeyboard } from 'grammy';

export function createLiqPayWebhook(bot: Bot<BotContext>) {
  return async (req: Request, res: Response) => {
    try {
      const { data, signature } = req.body;

      if (!data || !signature) {
        res.status(400).json({ error: 'Missing data or signature' });
        return;
      }

      if (!verifySignature(data, signature)) {
        console.error('LiqPay: invalid signature');
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }

      const payload = decodeData(data) as {
        order_id: string;
        status: string;
        amount: number;
        currency: string;
        payment_id: string;
      };

      console.log('LiqPay callback:', payload.order_id, payload.status);

      // Only process successful payments
      if (payload.status !== 'success' && payload.status !== 'sandbox') {
        res.json({ ok: true });
        return;
      }

      // Parse order_id: {userId}_{courseSlug}_{timestamp} or {userId}_{courseSlug}_promo_{timestamp}
      const parts = payload.order_id.split('_');
      const userId = parseInt(parts[0], 10);
      const courseSlug = parts[1];

      if (isNaN(userId) || !courseSlug) {
        console.error('LiqPay: invalid order_id format:', payload.order_id);
        res.json({ ok: true });
        return;
      }

      const course = await getCourseBySlug(courseSlug);
      if (!course) {
        console.error('LiqPay: course not found:', courseSlug);
        res.json({ ok: true });
        return;
      }

      // Check if already granted (idempotent)
      const alreadyOwned = await hasAccess(userId, course.id);
      if (!alreadyOwned) {
        await grantAccess({
          userId,
          courseId: course.id,
          paymentId: payload.order_id,
          amountPaid: Math.round(payload.amount * 100),
        });

        // Notify user via bot
        try {
          await bot.api.sendMessage(
            userId,
            uk.purchase.success(course.title),
            {
              reply_markup: new InlineKeyboard()
                .text(uk.purchase.goToCourse, `course:${course.id}`)
                .row()
                .text(uk.common.home, 'home'),
            }
          );
        } catch (e) {
          console.error('Failed to notify user:', userId, e);
        }
      }

      res.json({ ok: true });
    } catch (e) {
      console.error('LiqPay webhook error:', e);
      res.status(500).json({ error: 'Internal error' });
    }
  };
}
