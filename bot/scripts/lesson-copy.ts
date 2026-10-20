/**
 * Apply course-structure/lesson-copy.json to the lessons already in the database:
 * Ukrainian text_html and a title for every lessons.media item. Lessons are matched by
 * (course slug, position) and patched in place, so ids, progress and cabinet links survive.
 *
 * Usage (from bot/):
 *   npx tsx scripts/lesson-copy.ts                      # dry run, prints what would change
 *   npx tsx scripts/lesson-copy.ts --apply              # write
 *   npx tsx scripts/lesson-copy.ts --apply --exports ../temporary/telegram_chat_history
 *       # also fill duration_s / size_bytes from the enriched channel exports (by file_id)
 *
 * import-structured.ts calls applyLessonCopy() after a re-import, so the copy is never lost.
 * Needs SUPABASE_URL + SUPABASE_SERVICE_KEY in bot/.env (or the environment).
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COPY_FILE = path.join(HERE, '../course-structure/lesson-copy.json');

interface MediaCopy { type: string; title: string }
interface LessonCopy { position: number; text_html: string; media: MediaCopy[] }
interface CopyFile { courses: Record<string, LessonCopy[]> }

interface MediaItem {
  type: string;
  file_id?: string;
  url?: string;
  title?: string;
  duration_s?: number;
  size_bytes?: number;
  [k: string]: unknown;
}
interface LessonRow {
  id: string;
  position: number;
  title: string;
  text_html: string | null;
  media: MediaItem[] | null;
}

interface FileMeta { duration_s?: number; size_bytes?: number }

export interface ApplyOptions {
  apply: boolean;
  /** Folder with *_enriched.json exports; fills duration_s/size_bytes by file_id. */
  exportsDir?: string;
  /** Limit to these course slugs (default: every course in the copy file). */
  slugs?: string[];
  client?: SupabaseClient;
  log?: (line: string) => void;
}

function loadCopy(): CopyFile {
  return JSON.parse(fs.readFileSync(COPY_FILE, 'utf-8'));
}

/** file_id → { duration_s, size_bytes } from every *_enriched.json in the folder. */
function loadFileMeta(dir: string): Map<string, FileMeta> {
  const meta = new Map<string, FileMeta>();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('_enriched.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
    for (const m of data.messages ?? []) {
      if (!m._file_id) continue;
      meta.set(m._file_id, {
        ...(m._duration ? { duration_s: m._duration } : {}),
        ...(m._file_size ? { size_bytes: m._file_size } : {}),
      });
    }
  }
  return meta;
}

export async function applyLessonCopy(opts: ApplyOptions): Promise<{ changed: number; problems: number }> {
  const log = opts.log ?? console.log;
  const supabase = opts.client ?? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const copy = loadCopy();
  const fileMeta = opts.exportsDir ? loadFileMeta(path.resolve(opts.exportsDir)) : null;
  const slugs = opts.slugs ?? Object.keys(copy.courses);

  let changed = 0;
  let problems = 0;

  for (const slug of slugs) {
    const lessonsCopy = copy.courses[slug];
    if (!lessonsCopy) {
      log(`${slug}: no entry in lesson-copy.json — skipped`);
      continue;
    }
    const { data: course } = await supabase.from('courses').select('id').eq('slug', slug).single();
    if (!course) {
      log(`${slug}: course not found`);
      problems++;
      continue;
    }
    const { data: rows, error } = await supabase
      .from('lessons')
      .select('id, position, title, text_html, media')
      .eq('course_id', course.id)
      .order('position');
    if (error) throw new Error(`${slug}: ${error.message}`);
    const byPosition = new Map((rows as LessonRow[]).map((r) => [r.position, r]));

    log(`\n${slug}`);
    for (const lc of lessonsCopy) {
      const row = byPosition.get(lc.position);
      if (!row) {
        log(`  #${lc.position}: no lesson at this position`);
        problems++;
        continue;
      }
      const media = row.media ?? [];
      if (media.length !== lc.media.length || media.some((m, i) => m.type !== lc.media[i].type)) {
        log(`  #${lc.position} «${row.title}»: media mismatch — db [${media.map((m) => m.type).join(', ')}] vs copy [${lc.media.map((m) => m.type).join(', ')}]`);
        problems++;
        continue;
      }

      const newText = lc.text_html || null;
      const newMedia = media.map((item, i) => {
        const extra = fileMeta && item.file_id ? fileMeta.get(item.file_id) ?? {} : {};
        return { ...item, title: lc.media[i].title, ...extra };
      });
      const textChanged = (row.text_html ?? null) !== newText;
      const mediaChanged = JSON.stringify(media) !== JSON.stringify(newMedia);
      if (!textChanged && !mediaChanged) continue;

      changed++;
      const what = [textChanged ? 'text' : '', mediaChanged ? 'media' : ''].filter(Boolean).join(' + ');
      log(`  ${opts.apply ? '✓' : '·'} #${lc.position} «${row.title}» (${what})`);
      if (opts.apply) {
        const patch: Record<string, unknown> = {};
        if (textChanged) patch.text_html = newText;
        if (mediaChanged) patch.media = newMedia;
        const { error: upErr } = await supabase.from('lessons').update(patch).eq('id', row.id);
        if (upErr) throw new Error(`${slug} #${lc.position}: ${upErr.message}`);
      }
    }
  }

  log(`\n${opts.apply ? 'Updated' : 'Would update'} ${changed} lessons; ${problems} problems.`);
  if (!opts.apply && changed) log('Dry run — add --apply to write.');
  return { changed, problems };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const args = process.argv.slice(2);
  const exportsIdx = args.indexOf('--exports');
  applyLessonCopy({
    apply: args.includes('--apply'),
    exportsDir: exportsIdx >= 0 ? args[exportsIdx + 1] : undefined,
  }).then(({ problems }) => process.exit(problems ? 1 : 0))
    .catch((e) => {
      console.error('Fatal:', e);
      process.exit(1);
    });
}
