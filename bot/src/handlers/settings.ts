import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { uk } from '../locales/uk.js';
import { cleanAndSend } from '../utils/chat.js';

export function registerSettingsHandler(bot: Bot<BotContext>) {
  bot.callbackQuery('settings', async (ctx) => {
    await ctx.answerCallbackQuery();

    await cleanAndSend(ctx, uk.settings.title, {
      reply_markup: new InlineKeyboard()
        .text(`🇺🇦 Українська`, 'noop')
        .row()
        .text(uk.common.home, 'home'),
    });
  });
}
