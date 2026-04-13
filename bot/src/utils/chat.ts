import { BotContext } from '../bot.js';

/**
 * Delete all old bot messages, then replace the current callback message with new content.
 * Loading state is already shown by the bot-level middleware before this runs.
 */
export async function cleanAndSend(
  ctx: BotContext,
  text: string,
  options: Parameters<BotContext['reply']>[1] = {}
): Promise<number> {
  const callbackMsgId = ctx.callbackQuery?.message?.message_id;

  // Delete all OTHER tracked bot messages (media, old messages)
  const ids = ctx.session.botMessageIds ?? [];
  for (const msgId of ids) {
    if (msgId === callbackMsgId) continue;
    try { await ctx.api.deleteMessage(ctx.chat!.id, msgId); } catch {}
  }

  // Edit the current message (which already shows loading) with real content
  if (callbackMsgId) {
    try {
      await ctx.editMessageText(text, options as any);
      ctx.session.botMessageIds = [callbackMsgId];
      return callbackMsgId;
    } catch { /* fall through */ }
  }

  // Fallback: send new message (for /start or if edit fails)
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
