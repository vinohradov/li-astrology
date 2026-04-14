import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { uk } from '../locales/uk.js';
import { mainMenuKeyboard } from '../utils/keyboard.js';
import { cleanAndSend } from '../utils/chat.js';
import { getCourseBySlug } from '../db/courses.js';
import { grantAccess, hasAccess } from '../db/purchases.js';
import { getPaymentByOrderId, claimPaymentForUser } from '../db/payments.js';
import { upsertUser } from '../db/users.js';
import { formatPrice } from '../utils/format.js';

export function registerStartHandler(bot: Bot<BotContext>) {
  bot.command('start', async (ctx) => {
    const payload = ctx.match;
    const from = ctx.from!;

    try { await ctx.deleteMessage(); } catch {}

    await upsertUser({
      id: from.id,
      first_name: from.first_name,
      last_name: from.last_name,
      username: from.username,
    });

    if (payload && payload.startsWith('buy_')) {
      const slug = payload.slice(4);
      const course = await getCourseBySlug(slug);
      if (course) {
        const owned = await hasAccess(from.id, course.id);
        if (owned) {
          await cleanAndSend(ctx, `Ви вже маєте доступ до "${course.title}"!`, {
            reply_markup: mainMenuKeyboard(),
          });
        } else {
          await cleanAndSend(ctx,
            `${course.title}\n\n${course.description ?? ''}\n\nЦіна: ${formatPrice(course.price_uah)}`,
            {
              reply_markup: new InlineKeyboard()
                .text(uk.catalog.buy(formatPrice(course.price_uah)), `buy:${course.id}`)
                .row()
                .text(uk.catalog.promoCode, `promo:${course.id}`)
                .row()
                .text(uk.common.home, 'home'),
            },
          );
        }
        return;
      }
    }

    if (payload && (payload.startsWith('web-') || payload.startsWith('bot-'))) {
      const handled = await handleOrderIdDeeplink(ctx, payload);
      if (handled) return;
    }

    await cleanAndSend(ctx, uk.welcome(from.first_name ?? ''), {
      reply_markup: mainMenuKeyboard(),
    });
  });
}

async function handleOrderIdDeeplink(ctx: any, orderId: string): Promise<boolean> {
  const payment = await getPaymentByOrderId(orderId);
  if (!payment) return false;

  const userId = ctx.from.id;

  if (payment.status === 'pending') {
    await cleanAndSend(ctx, uk.purchase.pending, {
      reply_markup: mainMenuKeyboard(),
    });
    return true;
  }

  if (payment.status !== 'paid') {
    await cleanAndSend(ctx, uk.purchase.failed, {
      reply_markup: mainMenuKeyboard(),
    });
    return true;
  }

  // Claim web-first payment if unassigned
  if (payment.telegram_user_id === null) {
    const claimed = await claimPaymentForUser(orderId, userId);
    if (!claimed) {
      // Someone already claimed it — treat as unauthorized
      await cleanAndSend(ctx, uk.purchase.alreadyClaimed, {
        reply_markup: mainMenuKeyboard(),
      });
      return true;
    }
  } else if (payment.telegram_user_id !== userId) {
    await cleanAndSend(ctx, uk.purchase.alreadyClaimed, {
      reply_markup: mainMenuKeyboard(),
    });
    return true;
  }

  const course = await getCourseBySlug(payment.course_slug);
  if (!course) {
    console.error('course not found for payment', payment.course_slug);
    await cleanAndSend(ctx, uk.purchase.failed, {
      reply_markup: mainMenuKeyboard(),
    });
    return true;
  }

  await grantAccess({
    userId,
    courseId: course.id,
    paymentId: orderId,
    amountPaid: payment.amount * 100,
  });

  await cleanAndSend(ctx, uk.purchase.success(course.title), {
    reply_markup: new InlineKeyboard()
      .text(uk.purchase.goToCourse, `course:${course.id}`)
      .row()
      .text(uk.common.home, 'home'),
  });
  return true;
}
