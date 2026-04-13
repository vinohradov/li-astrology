import { BotError } from 'grammy';
import { BotContext } from '../bot.js';
import { config } from '../config.js';

export function errorHandler(bot: { api: BotContext['api'] }) {
  return async (err: BotError<BotContext>) => {
    const ctx = err.ctx;
    const e = err.error;

    console.error(`Error handling update ${ctx.update.update_id}:`, e);

    // Notify admin
    for (const adminId of config.ADMIN_IDS) {
      try {
        await bot.api.sendMessage(
          adminId,
          `Bot error:\n<code>${String(e).slice(0, 500)}</code>`,
          { parse_mode: 'HTML' }
        );
      } catch {
        // Admin might have blocked the bot
      }
    }

    // Try to respond to user
    try {
      await ctx.reply('Виникла помилка. Спробуйте пізніше.');
    } catch {
      // Can't respond
    }
  };
}
