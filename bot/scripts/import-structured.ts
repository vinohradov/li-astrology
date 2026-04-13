/**
 * Import course content using a structure config that groups messages into lessons.
 *
 * Usage:
 *   npx tsx scripts/import-structured.ts \
 *     --export ../telegram_chat_history/aspekty_basic_enriched.json \
 *     --structure ../bot/course-structure/aspekty-basic.json
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

interface StructureConfig {
  courseSlug: string;
  intro: {
    welcome: string;
    about: string;
    howItWorks: string;
    instagram?: string;
  } | number[];
  outro: number[];
  lessons: Array<{
    title: string;
    description?: string;
    compact?: boolean;
    material?: boolean;
    messageIds: number[];
  }>;
}

interface TgMessage {
  id: number;
  type: string;
  text: string | Array<{ type: string; text: string; href?: string }>;
  text_entities?: Array<{ type: string; text: string; href?: string }>;
  media_type?: string;
  _file_id?: string;
  _file_name?: string;
  _mime_type?: string;
  _duration?: number;
}

function getTextContent(text: TgMessage['text']): string {
  if (typeof text === 'string') return text;
  if (Array.isArray(text)) return text.map(e => typeof e === 'string' ? e : e.text ?? '').join('');
  return '';
}

function textToHtml(text: TgMessage['text']): string {
  if (typeof text === 'string') return escapeHtml(text);
  if (Array.isArray(text)) {
    return text.map(entity => {
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
    }).join('');
  }
  return '';
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
  const args = process.argv.slice(2);
  const exportIdx = args.indexOf('--export');
  const structIdx = args.indexOf('--structure');

  if (exportIdx === -1 || structIdx === -1) {
    console.error('Usage: npx tsx scripts/import-structured.ts --export <export.json> --structure <structure.json>');
    process.exit(1);
  }

  const exportPath = path.resolve(args[exportIdx + 1]);
  const structPath = path.resolve(args[structIdx + 1]);

  const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
  const structure: StructureConfig = JSON.parse(fs.readFileSync(structPath, 'utf-8'));

  // Find course
  const { data: course } = await supabase
    .from('courses')
    .select('id, title, slug')
    .eq('slug', structure.courseSlug)
    .single();

  if (!course) {
    console.error(`Course not found: ${structure.courseSlug}`);
    process.exit(1);
  }

  console.log(`Course: ${course.title} (${course.slug})`);
  console.log(`Lessons to import: ${structure.lessons.length}`);
  console.log('');

  // Update course intro if structured intro is provided
  if (structure.intro && !Array.isArray(structure.intro)) {
    const intro = structure.intro;
    let introHtml = `${intro.welcome}\n\n${intro.about}\n\n<b>Як проходить навчання:</b>\n${intro.howItWorks}`;
    if (intro.instagram) {
      introHtml += `\n\n<a href="${intro.instagram}">Instagram викладача</a>`;
    }
    await supabase
      .from('courses')
      .update({ intro_html: introHtml })
      .eq('id', course.id);
    console.log('Updated course intro');
  }

  // Build message map
  const msgMap = new Map<number, TgMessage>();
  for (const m of exportData.messages) {
    if (m.type === 'message') msgMap.set(m.id, m);
  }

  // Delete existing lessons for this course (re-import)
  const { error: delErr } = await supabase
    .from('lessons')
    .delete()
    .eq('course_id', course.id);
  if (delErr) console.error('Delete error:', delErr.message);
  else console.log('Cleared existing lessons');

  // Import each structured lesson
  for (let i = 0; i < structure.lessons.length; i++) {
    const lessonDef = structure.lessons[i];
    const position = i + 1;

    // Gather all messages for this lesson
    const messages = lessonDef.messageIds
      .map(id => msgMap.get(id))
      .filter((m): m is TgMessage => !!m);

    // Combine text from all messages
    const textParts: string[] = [];
    const media: Array<{ type: string; file_id?: string; url?: string }> = [];

    for (const msg of messages) {
      const rawText = getTextContent(msg.text).trim();
      const html = textToHtml(msg.text).trim();

      if (html) textParts.push(html);

      // Extract media
      if (msg._file_id) {
        const type = msg.media_type === 'video_file' ? 'video'
          : msg.media_type === 'audio_file' ? 'audio'
          : 'document';
        media.push({ type, file_id: msg._file_id });
      }

      // YouTube links from text
      const urlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)\S+)/gi;
      const urlMatches = rawText.match(urlRegex);
      if (urlMatches) {
        for (const url of urlMatches) {
          media.push({ type: 'video', url });
        }
      }
    }

    // Determine content type
    const hasVideo = media.some(m => m.type === 'video');
    const hasAudio = media.some(m => m.type === 'audio');
    const hasDoc = media.some(m => m.type === 'document');
    const types = [hasVideo, hasAudio, hasDoc].filter(Boolean).length;
    const contentType = types > 1 ? 'mixed'
      : hasVideo ? 'video'
      : hasAudio ? 'audio'
      : hasDoc ? 'document'
      : 'text';

    const { error } = await supabase.from('lessons').insert({
      course_id: course.id,
      position,
      title: lessonDef.title,
      content_type: contentType,
      text_html: textParts.join('\n\n') || null,
      media,
      tg_message_id: messages[0]?.id ?? null,
      compact: lessonDef.compact ?? false,
      material: lessonDef.material ?? false,
    });

    if (error) {
      console.error(`  ERROR lesson ${position}: ${error.message}`);
    } else {
      const mediaStr = media.map(m => m.type).join(', ') || 'text only';
      console.log(`  ${position}. ${lessonDef.title} [${mediaStr}]`);
    }
  }

  console.log('\nImport complete!');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
