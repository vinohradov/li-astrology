/**
 * Extract Telegram file_ids from a private channel where the bot is admin.
 *
 * How it works:
 *   1. Reads the Telegram Desktop JSON export to get message IDs
 *   2. Uses Bot API to forward each message to a "dump" chat (your personal chat with the bot)
 *   3. Captures file_id from the forwarded message
 *   4. Saves enriched JSON with file_ids
 *
 * Prerequisites:
 *   - Bot must be admin in the source channel
 *   - You must have started a chat with the bot (send /start)
 *
 * Usage:
 *   BOT_TOKEN=xxx DUMP_CHAT_ID=your_telegram_id npx tsx scripts/extract-file-ids.ts \
 *     --file ../telegram_chat_history/aspetky_pro.json
 *
 * To find your DUMP_CHAT_ID:
 *   1. Send /start to the bot
 *   2. Check bot logs or use @userinfobot
 */

import fs from 'fs';
import path from 'path';

const BOT_TOKEN = process.env.BOT_TOKEN;
const DUMP_CHAT_ID = process.env.DUMP_CHAT_ID;

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN env var');
  process.exit(1);
}
if (!DUMP_CHAT_ID) {
  console.error('Missing DUMP_CHAT_ID env var (your personal Telegram user ID)');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface FileInfo {
  messageId: number;
  mediaType: string | null;
  fileId: string | null;
  fileUniqueId: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null;
  textPreview: string;
}

async function tgApi(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description} (${method})`);
  }
  return data.result;
}

function extractFileInfo(msg: any): { fileId: string; fileUniqueId: string; fileName?: string; fileSize?: number; mimeType?: string; duration?: number } | null {
  // Video
  if (msg.video) {
    return {
      fileId: msg.video.file_id,
      fileUniqueId: msg.video.file_unique_id,
      fileName: msg.video.file_name,
      fileSize: msg.video.file_size,
      mimeType: msg.video.mime_type,
      duration: msg.video.duration,
    };
  }
  // Video note (round video)
  if (msg.video_note) {
    return {
      fileId: msg.video_note.file_id,
      fileUniqueId: msg.video_note.file_unique_id,
      fileSize: msg.video_note.file_size,
      duration: msg.video_note.duration,
    };
  }
  // Document (PDF, etc.)
  if (msg.document) {
    return {
      fileId: msg.document.file_id,
      fileUniqueId: msg.document.file_unique_id,
      fileName: msg.document.file_name,
      fileSize: msg.document.file_size,
      mimeType: msg.document.mime_type,
    };
  }
  // Audio
  if (msg.audio) {
    return {
      fileId: msg.audio.file_id,
      fileUniqueId: msg.audio.file_unique_id,
      fileName: msg.audio.file_name,
      fileSize: msg.audio.file_size,
      mimeType: msg.audio.mime_type,
      duration: msg.audio.duration,
    };
  }
  // Voice
  if (msg.voice) {
    return {
      fileId: msg.voice.file_id,
      fileUniqueId: msg.voice.file_unique_id,
      fileSize: msg.voice.file_size,
      mimeType: msg.voice.mime_type,
      duration: msg.voice.duration,
    };
  }
  // Photo (take largest)
  if (msg.photo && msg.photo.length > 0) {
    const largest = msg.photo[msg.photo.length - 1];
    return {
      fileId: largest.file_id,
      fileUniqueId: largest.file_unique_id,
      fileSize: largest.file_size,
    };
  }
  return null;
}

function getTextPreview(textField: any): string {
  if (typeof textField === 'string') return textField.slice(0, 100);
  if (Array.isArray(textField)) {
    return textField
      .map((e: any) => (typeof e === 'string' ? e : e.text ?? ''))
      .join('')
      .slice(0, 100);
  }
  return '';
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  if (fileIdx === -1) {
    console.error('Usage: npx tsx scripts/extract-file-ids.ts --file <path-to-export.json>');
    process.exit(1);
  }

  const filePath = path.resolve(args[fileIdx + 1]);
  const exportData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const channelName = exportData.name;
  const channelId = exportData.id;
  // Telegram channel IDs in Bot API format: -100{id}
  const botApiChannelId = `-100${channelId}`;

  console.log(`Channel: ${channelName}`);
  console.log(`Channel ID (Bot API): ${botApiChannelId}`);
  console.log(`Dump chat: ${DUMP_CHAT_ID}`);
  console.log('');

  // Filter messages that have media
  const mediaMessages = exportData.messages.filter(
    (m: any) => m.type === 'message' && (m.media_type || m.file || m.photo)
  );

  console.log(`Found ${mediaMessages.length} messages with media`);
  console.log('');

  const results: FileInfo[] = [];

  for (const msg of mediaMessages) {
    const textPreview = getTextPreview(msg.text);
    console.log(`Processing msg #${msg.id}: ${msg.media_type ?? 'file'} | ${textPreview.slice(0, 60)}...`);

    try {
      // Copy message from channel to dump chat (doesn't show "Forwarded from")
      const copied = await tgApi('copyMessage', {
        chat_id: DUMP_CHAT_ID,
        from_chat_id: botApiChannelId,
        message_id: msg.id,
      });

      // Now fetch the copied message to get file_id
      // We need to use forwardMessage instead — copyMessage doesn't return file_id
      // Let's delete the copy and use forwardMessage
      try {
        await tgApi('deleteMessage', {
          chat_id: DUMP_CHAT_ID,
          message_id: copied.message_id,
        });
      } catch {
        // ignore delete errors
      }

      // Forward gives us the full message object with file_ids
      const forwarded = await tgApi('forwardMessage', {
        chat_id: DUMP_CHAT_ID,
        from_chat_id: botApiChannelId,
        message_id: msg.id,
      });

      const info = extractFileInfo(forwarded);

      results.push({
        messageId: msg.id,
        mediaType: msg.media_type ?? (msg.photo ? 'photo' : 'file'),
        fileId: info?.fileId ?? null,
        fileUniqueId: info?.fileUniqueId ?? null,
        fileName: info?.fileName ?? null,
        fileSize: info?.fileSize ?? null,
        mimeType: info?.mimeType ?? null,
        duration: info?.duration ?? null,
        textPreview,
      });

      console.log(`  -> file_id: ${info?.fileId?.slice(0, 40)}...`);

      // Clean up forwarded message
      try {
        await tgApi('deleteMessage', {
          chat_id: DUMP_CHAT_ID,
          message_id: forwarded.message_id,
        });
      } catch {
        // ignore
      }

      // Rate limit: Telegram allows ~30 req/sec, but let's be safe
      await new Promise(r => setTimeout(r, 200));
    } catch (e: any) {
      console.error(`  -> ERROR: ${e.message}`);
      results.push({
        messageId: msg.id,
        mediaType: msg.media_type ?? null,
        fileId: null,
        fileUniqueId: null,
        fileName: null,
        fileSize: null,
        mimeType: null,
        duration: null,
        textPreview,
      });
    }
  }

  // Save results
  const outputPath = filePath.replace('.json', '_file_ids.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  // Also enrich the original export with file_ids
  const enrichedPath = filePath.replace('.json', '_enriched.json');
  const fileIdMap = new Map(results.map(r => [r.messageId, r]));

  for (const msg of exportData.messages) {
    const info = fileIdMap.get(msg.id);
    if (info?.fileId) {
      msg._file_id = info.fileId;
      msg._file_unique_id = info.fileUniqueId;
      msg._file_name = info.fileName;
      msg._file_size = info.fileSize;
      msg._mime_type = info.mimeType;
      msg._duration = info.duration;
    }
  }

  fs.writeFileSync(enrichedPath, JSON.stringify(exportData, null, 2));
  console.log(`Enriched export saved to: ${enrichedPath}`);

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Total media messages: ${results.length}`);
  console.log(`Successfully extracted: ${results.filter(r => r.fileId).length}`);
  console.log(`Failed: ${results.filter(r => !r.fileId).length}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
