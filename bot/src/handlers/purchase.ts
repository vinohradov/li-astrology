import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { uk } from '../locales/uk.js';
import { getCourseById } from '../db/courses.js';
import { validatePromo, calculateDiscount, incrementPromoUsage } from '../db/promotions.js';
import { formatPrice } from '../utils/format.js';
import { createPaymentLink } from '../payments/liqpay.js';
import { cleanAndSend } from '../utils/chat.js';

export function registerPurchaseHandler(bot: Bot<BotContext>) {
  bot.callbackQuery(/^buy:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const courseId = ctx.match[1];
    const userId = ctx.from.id;

    const course = await getCourseById(courseId);
    if (!course) return;

    const orderId = `${userId}_${course.slug}_${Date.now()}`;
    const paymentUrl = createPaymentLink({
      orderId,
      amount: course.price_uah / 100,
      description: course.title,
      productId: course.slug,
    });

    await cleanAndSend(ctx, uk.purchase.payViaLink, {
      reply_markup: new InlineKeyboard()
        .url(uk.purchase.payButton, paymentUrl)
        .row()
        .text(uk.common.back, `catalog_detail:${courseId}`),
    });
  });

  bot.callbackQuery(/^promo:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const courseId = ctx.match[1];

    ctx.session.promoForCourse = courseId;
    await cleanAndSend(ctx, uk.promo.enterCode, {
      reply_markup: new InlineKeyboard()
        .text(uk.common.back, `catalog_detail:${courseId}`),
    });
  });

  bot.on('message:text', async (ctx, next) => {
    if (!ctx.session.promoForCourse) {
      await next();
      return;
    }

    const courseId = ctx.session.promoForCourse;
    const code = ctx.message.text.trim();
    ctx.session.promoForCourse = undefined;

    // Delete user's message
    try { await ctx.deleteMessage(); } catch {}

    const course = await getCourseById(courseId);
    if (!course) return;

    const promo = await validatePromo(code, courseId);

    if (!promo) {
      await cleanAndSend(ctx, uk.promo.invalid, {
        reply_markup: new InlineKeyboard()
          .text(uk.catalog.buy(formatPrice(course.price_uah)), `buy:${courseId}`)
          .row()
          .text(uk.common.back, `catalog_detail:${courseId}`),
      });
      return;
    }

    const discount = calculateDiscount(promo, course.price_uah);
    const newPrice = course.price_uah - discount;
    const pct = promo.discount_pct ?? Math.round((discount / course.price_uah) * 100);

    await incrementPromoUsage(promo.id);

    const userId = ctx.from!.id;
    const orderId = `${userId}_${course.slug}_promo_${Date.now()}`;
    const paymentUrl = createPaymentLink({
      orderId,
      amount: newPrice / 100,
      description: `${course.title} (знижка ${pct}%)`,
      productId: course.slug,
    });

    await cleanAndSend(ctx, uk.promo.applied(pct, formatPrice(newPrice)), {
      reply_markup: new InlineKeyboard()
        .url(uk.purchase.payButton, paymentUrl)
        .row()
        .text(uk.common.home, 'home'),
    });
  });
}
