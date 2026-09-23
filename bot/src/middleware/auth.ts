import { NextFunction } from 'grammy';
import { BotContext } from '../bot.js';
import { markStartedBot, upsertUser } from '../db/users.js';

/** Upsert user record on every incoming update */
export async function authMiddleware(ctx: BotContext, next: NextFunction) {
  const from = ctx.from;
  if (from && !from.is_bot) {
    await upsertUser({
      id: from.id,
      first_name: from.first_name,
      last_name: from.last_name,
      username: from.username,
    });
    if (!ctx.session.startedBotMarked) {
      await markStartedBot(from.id);
      ctx.session.startedBotMarked = true;
    }
  }
  await next();
}
