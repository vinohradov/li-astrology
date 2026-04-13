import { Bot } from 'grammy';
import { BotContext } from '../bot.js';
import { adminOnly, isAdmin } from './middleware.js';
import { supabase } from '../db/client.js';
import { createReminder } from '../db/reminders.js';

export function registerAdminCommands(bot: Bot<BotContext>) {
  // /stats — basic statistics
  bot.command('stats', adminOnly, async (ctx) => {
    const { count: usersCount } = await supabase
      .from('bot_users')
      .select('*', { count: 'exact', head: true });

    const { count: purchasesCount } = await supabase
      .from('user_courses')
      .select('*', { count: 'exact', head: true });

    const { count: activeCount } = await supabase
      .from('bot_users')
      .select('*', { count: 'exact', head: true })
      .eq('blocked_bot', false)
      .gte('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    await ctx.reply(
      `📊 <b>Статистика</b>\n\n` +
      `Користувачів: ${usersCount ?? 0}\n` +
      `Активних (7д): ${activeCount ?? 0}\n` +
      `Покупок: ${purchasesCount ?? 0}`,
      { parse_mode: 'HTML' }
    );
  });

  // /broadcast {message} — send message to all active, non-blocked users
  bot.command('broadcast', adminOnly, async (ctx) => {
    const text = ctx.match;
    if (!text) {
      await ctx.reply('Використання: /broadcast <текст повідомлення>');
      return;
    }

    const { data: users } = await supabase
      .from('bot_users')
      .select('id')
      .eq('blocked_bot', false);

    if (!users || users.length === 0) {
      await ctx.reply('Немає активних користувачів.');
      return;
    }

    let count = 0;
    for (const user of users) {
      await createReminder({
        userId: user.id,
        type: 'broadcast',
        payload: { text },
      });
      count++;
    }

    await ctx.reply(`Розсилка створена для ${count} користувачів. Буде відправлено протягом хвилини.`);
  });

  // /reply {userId} {message} — reply to a support request
  bot.command('reply', adminOnly, async (ctx) => {
    const parts = ctx.match?.split(' ') ?? [];
    const userId = parseInt(parts[0], 10);
    const message = parts.slice(1).join(' ');

    if (isNaN(userId) || !message) {
      await ctx.reply('Використання: /reply <user_id> <текст відповіді>');
      return;
    }

    try {
      await ctx.api.sendMessage(userId, `📩 Відповідь від підтримки:\n\n${message}`);
      await ctx.reply('Відповідь надіслана.');
    } catch {
      await ctx.reply('Не вдалося надіслати відповідь. Можливо, користувач заблокував бота.');
    }
  });
}
