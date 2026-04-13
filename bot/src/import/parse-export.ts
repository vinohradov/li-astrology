/**
 * Parse Telegram Desktop JSON export into structured lessons.
 *
 * Telegram export format:
 * {
 *   "name": "Channel Name",
 *   "messages": [
 *     {
 *       "id": 123,
 *       "type": "message",
 *       "date": "2024-01-15T10:00:00",
 *       "text": "string" | [{type, text}, ...],
 *       "text_entities": [{type, text}],
 *       "media_type": "video_file" | "document" | ...,
 *       "mime_type": "...",
 *       "file": "path/to/file",
 *       "photo": "path/to/photo",
 *       "thumbnail": "path/to/thumb"
 *     }
 *   ]
 * }
 */

export interface ParsedLesson {
  position: number;
  title: string;
  contentType: 'text' | 'video' | 'document' | 'photo' | 'audio' | 'mixed';
  textHtml: string;
  media: Array<{ type: string; file_id?: string; url?: string; filePath?: string }>;
  tgMessageId: number;
}

interface TgMessage {
  id: number;
  type: string;
  date: string;
  text: string | Array<{ type: string; text: string; href?: string }>;
  text_entities?: Array<{ type: string; text: string; href?: string }>;
  media_type?: string;
  mime_type?: string;
  file?: string;
  photo?: string;
  // Enriched fields added by extract-file-ids script
  _file_id?: string;
  _file_unique_id?: string;
  _file_name?: string;
  _file_size?: number;
  _mime_type?: string;
  _duration?: number;
}

interface TgExport {
  name: string;
  messages: TgMessage[];
}

export function parseExport(json: TgExport): ParsedLesson[] {
  const lessons: ParsedLesson[] = [];

  // Filter to actual messages only (skip service messages like joins, pins, etc.)
  const messages = json.messages.filter(
    m => m.type === 'message' && (getTextContent(m.text).trim() || m.file || m.photo || m.media_type)
  );

  let position = 0;

  for (const msg of messages) {
    position++;

    const rawText = getTextContent(msg.text);
    const html = textToHtml(msg.text, msg.text_entities);
    const contentType = detectContentType(msg, rawText);
    const title = extractTitle(rawText, position);
    const media = extractMedia(msg, rawText);

    lessons.push({
      position,
      title,
      contentType,
      textHtml: html,
      media,
      tgMessageId: msg.id,
    });
  }

  return lessons;
}

/** Extract plain text from Telegram's text field (can be string or entity array) */
function getTextContent(text: TgMessage['text']): string {
  if (typeof text === 'string') return text;
  if (Array.isArray(text)) return text.map(e => typeof e === 'string' ? e : e.text ?? '').join('');
  return '';
}

/** Convert Telegram text entities to HTML */
function textToHtml(
  text: TgMessage['text'],
  entities?: TgMessage['text_entities']
): string {
  // If text is a simple string with no entities, return as-is
  if (typeof text === 'string' && (!entities || entities.length === 0)) {
    return escapeHtml(text);
  }

  // If text is an entity array (Telegram Desktop export format)
  // Array can contain plain strings AND entity objects
  if (Array.isArray(text)) {
    return text
      .map(entity => {
        if (typeof entity === 'string') return escapeHtml(entity);
        const escaped = escapeHtml(entity.text ?? '');
        switch (entity.type) {
          case 'bold': return `<b>${escaped}</b>`;
          case 'italic': return `<i>${escaped}</i>`;
          case 'code': return `<code>${escaped}</code>`;
          case 'pre': return `<pre>${escaped}</pre>`;
          case 'text_link': return `<a href="${entity.href}">${escaped}</a>`;
          case 'link': return `<a href="${entity.text}">${escaped}</a>`;
          case 'strikethrough': return `<s>${escaped}</s>`;
          case 'underline': return `<u>${escaped}</u>`;
          default: return escaped;
        }
      })
      .join('');
  }

  return escapeHtml(String(text));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function detectContentType(
  msg: TgMessage,
  rawText: string
): ParsedLesson['contentType'] {
  const hasVideo = msg.media_type === 'video_file' || /youtu\.?be|vimeo/i.test(rawText);
  const hasAudio = msg.media_type === 'audio_file';
  const hasDocument = (!hasAudio && msg.media_type === 'document') || msg.mime_type === 'application/pdf';
  const hasPhoto = !!msg.photo;

  const types = [hasVideo, hasAudio, hasDocument, hasPhoto].filter(Boolean).length;
  if (types > 1) return 'mixed';
  if (hasVideo) return 'video';
  if (hasAudio) return 'audio';
  if (hasDocument) return 'document';
  if (hasPhoto) return 'photo';
  return 'text';
}

function extractTitle(rawText: string, position: number): string {
  // Take first line, clean it up
  const firstLine = rawText.split('\n')[0]?.trim() ?? '';

  // Remove common prefixes
  const cleaned = firstLine
    .replace(/^(урок|lesson|заняття)\s*\d*[.:)\s]*/i, '')
    .trim();

  if (cleaned.length > 3 && cleaned.length < 100) {
    return cleaned;
  }

  return `Урок ${position}`;
}

function extractMedia(msg: TgMessage, rawText: string): ParsedLesson['media'] {
  const media: ParsedLesson['media'] = [];

  // YouTube / Vimeo links from text
  const urlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)\S+)/gi;
  const matches = rawText.match(urlRegex);
  if (matches) {
    for (const url of matches) {
      media.push({ type: 'video', url });
    }
  }

  // If we have an enriched file_id (from extract-file-ids script), use it
  if (msg._file_id) {
    const type = msg.media_type === 'video_file' ? 'video'
      : msg.media_type === 'audio_file' ? 'audio'
      : 'document';
    media.push({ type, file_id: msg._file_id });
    return media;
  }

  // Fallback: file path from export (no file_id)
  if (msg.file) {
    if (msg.media_type === 'video_file') {
      media.push({ type: 'video', filePath: msg.file });
    } else if (msg.media_type === 'audio_file') {
      media.push({ type: 'audio', filePath: msg.file });
    } else {
      media.push({ type: 'document', filePath: msg.file });
    }
  }

  // Photo
  if (msg.photo) {
    media.push({ type: 'photo', filePath: msg.photo });
  }

  return media;
}
