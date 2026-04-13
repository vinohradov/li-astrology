import { NextFunction } from 'grammy';
import { BotContext } from '../bot.js';
import { config } from '../config.js';

export function isAdmin(ctx: BotContext): boolean {
  return ctx.from ? config.ADMIN_IDS.includes(ctx.from.id) : false;
}

export async function adminOnly(ctx: BotContext, next: NextFunction) {
  if (!isAdmin(ctx)) {
    await ctx.reply('Ця команда доступна лише адміністраторам.');
    return;
  }
  await next();
}
