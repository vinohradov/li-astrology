import { BotError, GrammyError } from 'grammy';
import { BotContext } from '../bot.js';
import { config } from '../config.js';

// Errors that are normal and shouldn't spam the admin
const IGNORED_ERRORS = [
  'query is too old',
  'message is not modified',
  'message to delete not found',
  'message can\'t be deleted',
  'bot was blocked by the user',
];

export function errorHandler(bot: { api: BotContext['api'] }) {
  return async (err: BotError<BotContext>) => {
    const ctx = err.ctx;
    const e = err.error;
    const msg = String(e);

    // Skip known non-critical errors
    if (IGNORED_ERRORS.some(ignored => msg.includes(ignored))) {
      console.log(`Ignored error: ${msg.slice(0, 100)}`);
      return;
    }

    console.error(`Error handling update ${ctx.update.update_id}:`, e);

    // Notify admin
    for (const adminId of config.ADMIN_IDS) {
      try {
        await bot.api.sendMessage(
          adminId,
          `Bot error:\n<code>${msg.slice(0, 500)}</code>`,
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
