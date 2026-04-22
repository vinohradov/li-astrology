import { BotContext } from '../bot.js';

// If the callback message is older than this, we send a NEW message at the
// bottom of the chat instead of editing in place. This avoids "dead content
// at the bottom, navigation buried somewhere in history" when users return
// after a long pause (the edited message stays in its original chronological
// slot, so newer media sent below it would push the nav out of view).
const STALE_CALLBACK_AGE_SEC = 24 * 3600;

/**
 * Delete all old bot messages, then place the new content in the chat:
 *  - for a fresh callback (<24h): edit the current message in place (shows
 *    instant "Завантаження…" → final content, keeps same "card" feel)
 *  - for a stale callback (≥24h) or /start: send a NEW message so it
 *    lands at the bottom of the chat where Telegram auto-scrolls on open
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

  // Delete all OTHER tracked bot messages (media, old navigation).
  // When stale, also try to delete the callback msg itself (will silently
  // fail past Telegram's 48h window — that's OK, we'll send new below).
  const ids = ctx.session.botMessageIds ?? [];
  for (const msgId of ids) {
    if (msgId === callbackMsgId && !isStale) continue;
    try { await ctx.api.deleteMessage(ctx.chat!.id, msgId); } catch {}
  }

  // Fresh callback: edit the current message (already showing loading state)
  if (callbackMsgId && !isStale) {
    try {
      await ctx.editMessageText(text, options as any);
      ctx.session.botMessageIds = [callbackMsgId];
      return callbackMsgId;
    } catch { /* fall through to send-new */ }
  }

  // Send new message — ends up at the bottom of the chat
  const sent = await ctx.reply(text, options);
  ctx.session.botMessageIds = [sent.message_id];

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
