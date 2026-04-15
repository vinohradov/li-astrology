import { NextFunction } from 'grammy';
import { BotContext } from '../bot.js';
import { getLocale } from '../locales/index.js';
import { getUser } from '../db/users.js';

/**
 * Sets ctx.t to the correct locale based on the user's stored lang preference.
 * Falls back to 'uk' if the user row is missing or the column is empty.
 *
 * Depends on authMiddleware having already upserted the user row.
 */
export async function localeMiddleware(ctx: BotContext, next: NextFunction) {
  const userId = ctx.from?.id;
  let lang: string | null = null;
  if (userId) {
    const user = await getUser(userId);
    lang = user?.lang ?? null;
  }
  ctx.t = getLocale(lang);
  await next();
}
