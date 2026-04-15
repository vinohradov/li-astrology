import { Bot } from 'grammy';
import { BotContext } from '../bot.js';
import { mainMenuKeyboard } from '../utils/keyboard.js';
import { cleanAndSend } from '../utils/chat.js';

export function registerMenuHandler(bot: Bot<BotContext>) {
  bot.callbackQuery('home', async (ctx) => {
    await ctx.answerCallbackQuery();
    await cleanAndSend(ctx, ctx.t.welcome(ctx.from.first_name ?? ''), {
      reply_markup: mainMenuKeyboard(ctx.t),
    });
  });

  bot.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.command('menu', async (ctx) => {
    try { await ctx.deleteMessage(); } catch {}
    await cleanAndSend(ctx, ctx.t.welcome(ctx.from?.first_name ?? ''), {
      reply_markup: mainMenuKeyboard(ctx.t),
    });
  });
}
