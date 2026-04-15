import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { getCourseById } from '../db/courses.js';
import { createInvoice } from '../payments/create.js';
import { cleanAndSend } from '../utils/chat.js';

export function registerPurchaseHandler(bot: Bot<BotContext>) {
  bot.callbackQuery(/^buy:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const courseId = ctx.match[1];
    const userId = ctx.from.id;

    const course = await getCourseById(courseId);
    if (!course) return;

    try {
      const { invoiceUrl } = await createInvoice({
        courseSlug: course.slug,
        telegramUserId: userId,
      });

      await cleanAndSend(ctx, ctx.t.purchase.payViaLink, {
        reply_markup: new InlineKeyboard()
          .url(ctx.t.purchase.payButton, invoiceUrl)
          .row()
          .text(ctx.t.common.back, `catalog_detail:${courseId}`),
      });
    } catch (err) {
      console.error('create invoice failed', err);
      await cleanAndSend(ctx, ctx.t.purchase.error, {
        reply_markup: new InlineKeyboard()
          .text(ctx.t.common.back, `catalog_detail:${courseId}`),
      });
    }
  });
}
