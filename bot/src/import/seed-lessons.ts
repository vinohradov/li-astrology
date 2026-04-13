import { supabase } from '../db/client.js';
import { ParsedLesson } from './parse-export.js';

/**
 * Insert parsed lessons into the database.
 * Idempotent: uses tg_message_id + course_id for dedup.
 */
export async function seedLessons(courseId: string, lessons: ParsedLesson[]) {
  let inserted = 0;
  let skipped = 0;

  for (const lesson of lessons) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('lessons')
      .select('id')
      .eq('course_id', courseId)
      .eq('tg_message_id', lesson.tgMessageId)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('lessons').insert({
      course_id: courseId,
      position: lesson.position,
      title: lesson.title,
      content_type: lesson.contentType,
      text_html: lesson.textHtml,
      media: lesson.media,
      tg_message_id: lesson.tgMessageId,
    });

    if (error) {
      console.error(`Failed to insert lesson ${lesson.position}:`, error.message);
    } else {
      inserted++;
    }
  }

  console.log(`Seed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
}
