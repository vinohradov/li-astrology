import { Bot, Context, session, SessionFlavor } from 'grammy';
import { config } from './config.js';
import { supabase } from './db/client.js';
import type { Locale } from './locales/index.js';

export interface SessionData {
  /** Current promo code being entered for a course */
  promoForCourse?: string;
  /** Whether user is in support mode (free text goes to ticket) */
  inSupportMode?: boolean;
  /** ALL bot message IDs in this chat (for cleanup) */
  botMessageIds?: number[];
}

export interface LocaleFlavor {
  /** Translations for the current user — set by the locale middleware. */
  t: Locale;
}

export type BotContext = Context & SessionFlavor<SessionData> & LocaleFlavor;

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  // FIRST middleware: show loading state IMMEDIATELY on any callback button press
  // This runs BEFORE session loading, so user sees instant feedback.
  // Skip for stale callback messages — cleanAndSend will send a NEW message
  // at the bottom instead of editing, so "Завантаження…" on an old in-place
  // edit would just leave a stale "⏳" stranded in chat history.
  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery?.data && ctx.callbackQuery.data !== 'noop') {
      const msg = ctx.callbackQuery.message;
      const msgId = msg?.message_id;
      const msgDate = msg?.date;
      const isStale = msgDate
        ? Math.floor(Date.now() / 1000) - msgDate > 24 * 3600
        : false;
      if (msgId && !isStale) {
        // Fire-and-forget: edit to loading state without awaiting session
        ctx.api.editMessageText(
          ctx.chat!.id,
          msgId,
          '⏳ Завантаження...',
          { reply_markup: undefined }
        ).catch(() => {});
      }
    }
    await next();
  });

  // Session storage backed by Supabase
  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage: {
        async read(key: string) {
          const { data } = await supabase
            .from('bot_sessions')
            .select('value')
            .eq('key', key)
            .single();
          return data?.value ?? undefined;
        },
        async write(key: string, value: SessionData) {
          await supabase
            .from('bot_sessions')
            .upsert({ key, value }, { onConflict: 'key' });
        },
        async delete(key: string) {
          await supabase.from('bot_sessions').delete().eq('key', key);
        },
      },
    })
  );

  return bot;
}
