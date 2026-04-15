import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { config } from '../config.js';
import { cleanAndSend } from '../utils/chat.js';

export function registerSupportHandler(bot: Bot<BotContext>) {
  bot.callbackQuery('support', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.inSupportMode = true;

    await cleanAndSend(ctx, ctx.t.support.intro, {
      reply_markup: new InlineKeyboard()
        .text(ctx.t.common.home, 'home'),
    });
  });

  bot.on('message:text', async (ctx, next) => {
    if (!ctx.session.inSupportMode) {
      await next();
      return;
    }

    ctx.session.inSupportMode = false;
    const userId = ctx.from!.id;
    const username = ctx.from!.username ? `@${ctx.from!.username}` : ctx.from!.first_name;
    const text = ctx.message.text;

    // Delete user's message to keep chat clean
    try { await ctx.deleteMessage(); } catch {}

    // Admin notification stays in Ukrainian — admins are UA-speaking.
    for (const adminId of config.ADMIN_IDS) {
      try {
        await ctx.api.sendMessage(
          adminId,
          `📩 <b>Нове звернення</b>\n\nВід: ${username} (ID: ${userId})\n\n${text}`,
          { parse_mode: 'HTML' }
        );
      } catch {}
    }

    await cleanAndSend(ctx, ctx.t.support.received, {
      reply_markup: new InlineKeyboard()
        .text(ctx.t.common.home, 'home'),
    });
  });
}
