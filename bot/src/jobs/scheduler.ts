import cron from 'node-cron';
import { Bot } from 'grammy';
import { BotContext } from '../bot.js';
import { checkInactivity } from './inactivity.js';
import { processReminders } from './send-reminders.js';

export function startScheduler(bot: Bot<BotContext>) {
  // Send pending reminders every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processReminders(bot);
    } catch (e) {
      console.error('send-reminders job error:', e);
    }
  });

  // Check for inactive users every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      await checkInactivity();
    } catch (e) {
      console.error('check-inactivity job error:', e);
    }
  });

  console.log('Scheduler started: reminders (1min), inactivity (6h)');
}
