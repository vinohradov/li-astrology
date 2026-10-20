// Finds the lesson media files on disk and writes a manifest that maps every
// lessons.media item to its file.
//
//   node tools/media-migrate/check-export.mjs [dir]
//
// dir (default: temporary/media-export) is searched recursively, so it can be a Telegram
// Desktop export (finished or cancelled), files downloaded by hand, or a mix. A file is
// recognised by its exact byte size, taken from the import-time exports in
// temporary/telegram_chat_history (which also give each message's Telegram file_id).
// Every lesson file of all four courses also exists in the «Астрология с 0» channel, so
// exporting that one channel is enough.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const exportDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'temporary/media-export'));

// astro-z-0 first: its copy of a file is the one the others are deduplicated against.
const COURSES = [
  { slug: 'astro-z-0', history: 'astrology_from_0' },
  { slug: 'intensiv', history: 'intensive' },
  { slug: 'aspekty-basic', history: 'aspekty_basic' },
  { slug: 'aspekty-pro', history: 'aspetky_pro' },
];
const TYPES = { video_file: 'video', audio_file: 'audio' };
const SKIP = /(_thumb\.jpg|\.json|\.html|\.css|\.js)$/i;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const gb = (bytes) => `${(bytes / 1e9).toFixed(2)} GB`;

// Every file under exportDir, by size and by name.
const bySize = new Map();
const sizesByName = new Map();
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (!SKIP.test(entry.name)) {
      const size = fs.statSync(full).size;
      if (!bySize.has(size)) bySize.set(size, full);
      sizesByName.set(entry.name, size);
    }
  }
}
if (fs.existsSync(exportDir)) scan(exportDir);

const manifest = [];
const contentIds = new Map(); // "size|name" → file_unique_id of the first message with that file
const missing = new Map(); // same key → { name, size } still to download
console.log(`Looking in: ${exportDir}\n`);

for (const course of COURSES) {
  const history = readJson(path.join(ROOT, 'temporary/telegram_chat_history', `${course.history}_enriched.json`));
  const structure = readJson(path.join(ROOT, 'bot/course-structure', `${course.slug}.json`));
  const lessonOf = new Map();
  for (const lesson of structure.lessons) {
    for (const id of lesson.messageIds) lessonOf.set(id, lesson.title);
  }
  const wanted = history.messages.filter((m) => m._file_id && lessonOf.has(m.id));

  let ok = 0;
  const problems = [];
  for (const msg of wanted) {
    const key = `${msg._file_size}|${msg._file_name}`;
    if (!contentIds.has(key)) contentIds.set(key, msg._file_unique_id);
    const file = bySize.get(msg._file_size);
    if (!file) {
      const partial = sizesByName.get(msg._file_name);
      problems.push(
        `#${msg.id} ${msg._file_name} (${lessonOf.get(msg.id)})` +
          (partial ? ` — incomplete: ${partial} of ${msg._file_size} bytes` : ''),
      );
      missing.set(key, msg._file_size);
      continue;
    }
    ok++;
    manifest.push({
      course_slug: course.slug,
      message_id: msg.id,
      lesson_title: lessonOf.get(msg.id),
      type: TYPES[msg.media_type] ?? 'document',
      file_id: msg._file_id,
      content_id: contentIds.get(key),
      file_name: msg._file_name,
      size_bytes: msg._file_size,
      duration_s: msg._duration ?? null,
      path: file,
    });
  }
  console.log(`${ok === wanted.length ? '✓' : '…'} ${course.slug}: ${ok}/${wanted.length} files found`);
  for (const p of problems.slice(0, 8)) console.log(`    ✗ ${p}`);
  if (problems.length > 8) console.log(`    … and ${problems.length - 8} more`);
}

console.log('');
if (manifest.length > 0) {
  const out = path.join(exportDir, 'manifest.json');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  const unique = new Map(manifest.map((m) => [m.content_id, m.size_bytes]));
  const uniqueBytes = [...unique.values()].reduce((a, b) => a + b, 0);
  console.log(`Manifest: ${out}`);
  console.log(`${manifest.length} lesson items ready = ${unique.size} distinct files (${gb(uniqueBytes)} to upload)`);
}
if (missing.size > 0) {
  const bytes = [...missing.values()].reduce((a, b) => a + b, 0);
  console.log(`Still missing: ${missing.size} distinct files (${gb(bytes)})`);
  process.exit(1);
}
console.log('All lesson media is present.');
