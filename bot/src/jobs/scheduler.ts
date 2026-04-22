import cron from 'node-cron';
import { Bot } from 'grammy';
import { BotContext } from '../bot.js';
import { checkInactivity } from './inactivity.js';
import { checkNurture } from './nurture.js';
import { processReminders } from './send-reminders.js';
import { tickReconcilePayments } from './reconcile-payments.js';

export function startScheduler(bot: Bot<BotContext>) {
  // Send pending reminders every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processReminders(bot);
    } catch (e) {
      console.error('send-reminders job error:', e);
    }
  });

  // Poll Mono for any pending payments whose webhook was missed. Runs every
  // minute; idempotent because the Edge Function only touches still-pending
  // rows and upserts user_courses.
  cron.schedule('* * * * *', tickReconcilePayments);

  // Check for inactive users every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      await checkInactivity();
    } catch (e) {
      console.error('check-inactivity job error:', e);
    }
  });

  // Queue nurture messages for intensiv buyers hourly. Delivery is handled
  // by the reminders pipeline.
  cron.schedule('15 * * * *', async () => {
    try {
      await checkNurture();
    } catch (e) {
      console.error('nurture job error:', e);
    }
  });

  console.log('Scheduler started: reminders (1min), mono reconcile (1min), inactivity (6h), nurture (1h)');
}
