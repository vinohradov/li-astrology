import { InputFile } from 'grammy';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BotContext } from '../bot.js';

// If the callback message is older than this, we send a NEW message at the
// bottom of the chat instead of editing in place. This avoids "dead content
// at the bottom, navigation buried somewhere in history" when users return
// after a long pause (the edited message stays in its original chronological
// slot, so newer media sent below it would push the nav out of view).
const STALE_CALLBACK_AGE_SEC = 24 * 3600;

// Gap since the last nav message after which we send a "welcome back" banner
// before the new nav, pushing stale media above the fold. Matches Telegram's
// 48h delete window — past that point we can't clean up old content anyway.
const WELCOME_BACK_THRESHOLD_MS = 48 * 3600 * 1000;

const __filename = fileURLToPath(import.meta.url);
const BANNER_PATH = resolve(dirname(__filename), '..', '..', 'assets', 'welcome-back-banner.png');

/**
 * Send the tall "welcome back" banner. Caches Telegram's file_id in session
 * so subsequent sends are byte-free. Intentionally NOT tracked in
 * botMessageIds — the banner persists as a chronological divider.
 */
async function sendWelcomeBackBanner(ctx: BotContext): Promise<void> {
  try {
    const cached = ctx.session.welcomeBannerFileId;
    const sent = cached
      ? await ctx.api.sendPhoto(ctx.chat!.id, cached)
      : await ctx.api.sendPhoto(ctx.chat!.id, new InputFile(BANNER_PATH));

    if (!cached) {
      const sizes = sent.photo;
      const largest = sizes?.[sizes.length - 1]?.file_id;
      if (largest) ctx.session.welcomeBannerFileId = largest;
    }
  } catch (e) {
    console.error('welcome-back banner failed:', e);
  }
}

/**
 * Delete all old bot messages, then place the new content in the chat:
 *  - for a fresh callback (<24h): edit the current message in place (shows
 *    instant "Завантаження…" → final content, keeps same "card" feel)
 *  - for a stale callback (≥24h) or /start: send a NEW message so it
 *    lands at the bottom of the chat where Telegram auto-scrolls on open
 *  - if the user has been away ≥48h since the last nav, prepend the
 *    welcome-back banner before the new nav (pushes old media above the fold)
 */
export async function cleanAndSend(
  ctx: BotContext,
  text: string,
  options: Parameters<BotContext['reply']>[1] = {}
): Promise<number> {
  const callbackMsg = ctx.callbackQuery?.message;
  const callbackMsgId = callbackMsg?.message_id;
  const callbackMsgDate = callbackMsg?.date;
  const nowSec = Math.floor(Date.now() / 1000);
  const isStale = callbackMsgDate
    ? nowSec - callbackMsgDate > STALE_CALLBACK_AGE_SEC
    : false;

  const nowMs = Date.now();
  const lastNavAt = ctx.session.lastNavAt;
  const isLongAbsence = !!lastNavAt && nowMs - lastNavAt > WELCOME_BACK_THRESHOLD_MS;

  // Delete all OTHER tracked bot messages (media, old navigation).
  // When stale, also try to delete the callback msg itself (will silently
  // fail past Telegram's 48h window — that's OK, we'll send new below).
  const ids = ctx.session.botMessageIds ?? [];
  for (const msgId of ids) {
    if (msgId === callbackMsgId && !isStale && !isLongAbsence) continue;
    try { await ctx.api.deleteMessage(ctx.chat!.id, msgId); } catch {}
  }

  // Long absence: push old content above the fold with a tall banner before the new nav.
  if (isLongAbsence) {
    await sendWelcomeBackBanner(ctx);
  }

  // Fresh callback: edit the current message (already showing loading state).
  // Skip the in-place edit on long absence — we want the new nav to land at
  // the bottom right after the banner.
  if (callbackMsgId && !isStale && !isLongAbsence) {
    try {
      await ctx.editMessageText(text, options as any);
      ctx.session.botMessageIds = [callbackMsgId];
      ctx.session.lastNavAt = nowMs;
      return callbackMsgId;
    } catch { /* fall through to send-new */ }
  }

  // Send new message — ends up at the bottom of the chat
  const sent = await ctx.reply(text, options);
  ctx.session.botMessageIds = [sent.message_id];
  ctx.session.lastNavAt = nowMs;

  if (callbackMsgId) {
    try { await ctx.api.deleteMessage(ctx.chat!.id, callbackMsgId); } catch {}
  }

  return sent.message_id;
}

/**
 * Send a media file and track its message ID.
 */
export async function sendTrackedMedia(
  ctx: BotContext,
  type: 'video' | 'audio' | 'document',
  fileId: string
): Promise<void> {
  try {
    let sent;
    if (type === 'video') sent = await ctx.api.sendVideo(ctx.chat!.id, fileId);
    else if (type === 'audio') sent = await ctx.api.sendAudio(ctx.chat!.id, fileId);
    else sent = await ctx.api.sendDocument(ctx.chat!.id, fileId);

    if (sent) {
      if (!ctx.session.botMessageIds) ctx.session.botMessageIds = [];
      ctx.session.botMessageIds.push(sent.message_id);
    }
  } catch (e) {
    console.error('Failed to send media:', e);
  }
}

/**
 * Delete all tracked bot messages from this chat.
 */
export async function deleteAllBotMessages(ctx: BotContext) {
  const ids = ctx.session.botMessageIds;
  if (!ids?.length) return;

  for (const msgId of ids) {
    try { await ctx.api.deleteMessage(ctx.chat!.id, msgId); } catch {}
  }
  ctx.session.botMessageIds = [];
}
