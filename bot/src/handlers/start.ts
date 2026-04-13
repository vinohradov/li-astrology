import { Bot } from 'grammy';
import { BotContext } from '../bot.js';
import { uk } from '../locales/uk.js';
import { mainMenuKeyboard } from '../utils/keyboard.js';
import { cleanAndSend } from '../utils/chat.js';
import { getCourseBySlug } from '../db/courses.js';
import { hasAccess } from '../db/purchases.js';
import { InlineKeyboard } from 'grammy';
import { formatPrice } from '../utils/format.js';

export function registerStartHandler(bot: Bot<BotContext>) {
  bot.command('start', async (ctx) => {
    const payload = ctx.match;

    // Delete user's /start message
    try { await ctx.deleteMessage(); } catch {}

    if (payload && payload.startsWith('buy_')) {
      const slug = payload.slice(4);
      const course = await getCourseBySlug(slug);
      if (course) {
        const owned = await hasAccess(ctx.from!.id, course.id);
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
            }
          );
        }
        return;
      }
    }

    await cleanAndSend(ctx, uk.welcome(ctx.from?.first_name ?? ''), {
      reply_markup: mainMenuKeyboard(),
    });
  });
}
