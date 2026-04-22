import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { getPendingReminders, markReminderSent, markReminderFailed } from '../db/reminders.js';
import { markBlocked } from '../db/users.js';
import { appendUserBotMessageId } from '../db/sessions.js';

export async function processReminders(bot: Bot<BotContext>) {
  const reminders = await getPendingReminders(30);
  if (reminders.length === 0) return;

  for (const reminder of reminders) {
    if (!reminder.user_id) continue;

    try {
      const keyboard = new InlineKeyboard();
      if (reminder.payload.buttons) {
        for (const btn of reminder.payload.buttons) {
          if (btn.url) {
            keyboard.url(btn.text, btn.url);
          } else if (btn.callback_data) {
            keyboard.text(btn.text, btn.callback_data);
          }
          keyboard.row();
        }
      }

      const sent = await bot.api.sendMessage(reminder.user_id, reminder.payload.text, {
        reply_markup: reminder.payload.buttons ? keyboard : undefined,
      });

      // Track in user's session so the next navigation click deletes it.
      // Best-effort: failures here shouldn't block the reminder from being marked sent.
      try {
        await appendUserBotMessageId(reminder.user_id, sent.message_id);
      } catch (trackErr) {
        console.error(`Failed to track reminder message ${sent.message_id} for user ${reminder.user_id}:`, trackErr);
      }

      await markReminderSent(reminder.id);
    } catch (e: any) {
      if (e?.error_code === 403) {
        // User blocked the bot
        await markBlocked(reminder.user_id);
        await markReminderFailed(reminder.id);
      } else {
        console.error(`Failed to send reminder ${reminder.id}:`, e);
        await markReminderFailed(reminder.id);
      }
    }
  }
}
