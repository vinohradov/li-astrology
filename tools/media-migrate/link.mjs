// Writes the Bunny locations into lessons.media so the cabinet can play/open them.
//
//   node tools/media-migrate/link.mjs [exportDir]            # dry run: shows what would change
//   node tools/media-migrate/link.mjs [exportDir] --apply    # writes
//
// Items are matched by Telegram file_id. Only keys are added to an item (bunny_video_id for
// videos, storage_path for audio/documents, plus size_bytes and duration_s); file_id stays,
// so the bot is unaffected.
import { exportDirFromArgs, loadEnv, loadManifest, loadState } from './lib.mjs';

const env = loadEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
const exportDir = exportDirFromArgs();
const apply = process.argv.includes('--apply');

const rest = `${env.SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const byFileId = new Map(loadManifest(exportDir).map((m) => [m.file_id, m]));
const { state } = loadState(exportDir);

const res = await fetch(`${rest}/lessons?select=id,title,position,media,courses(slug)&order=course_id,position`, { headers });
if (!res.ok) throw new Error(`lessons read → ${res.status} ${await res.text()}`);
const lessons = await res.json();

let linked = 0;
let already = 0;
let notUploaded = 0;
const unknown = [];

for (const lesson of lessons) {
  let changed = false;
  const media = (lesson.media ?? []).map((item, index) => {
    if (!item.file_id) return item;
    const source = byFileId.get(item.file_id);
    if (!source) {
      unknown.push(`${lesson.courses?.slug} #${lesson.position} «${lesson.title}» item ${index} (${item.type})`);
      return item;
    }
    const upload = state[source.content_id];
    if (!upload?.uploaded) {
      notUploaded++;
      return item;
    }
    const location = upload.bunny_video_id
      ? { bunny_video_id: upload.bunny_video_id }
      : { storage_path: upload.storage_path };
    const [field, value] = Object.entries(location)[0];
    if (item[field] === value) {
      already++;
      return item;
    }
    changed = true;
    linked++;
    return {
      ...item,
      ...location,
      size_bytes: source.size_bytes,
      ...(source.duration_s ? { duration_s: source.duration_s } : {}),
    };
  });
  if (!changed) continue;

  console.log(`${apply ? '✓' : '·'} ${lesson.courses?.slug} #${lesson.position} «${lesson.title}»`);
  if (apply) {
    const patch = await fetch(`${rest}/lessons?id=eq.${lesson.id}`, { method: 'PATCH', headers, body: JSON.stringify({ media }) });
    if (!patch.ok) throw new Error(`lesson ${lesson.id} update → ${patch.status} ${await patch.text()}`);
  }
}

console.log(`\n${apply ? 'Linked' : 'Would link'} ${linked} files; ${already} already linked; ${notUploaded} not uploaded yet.`);
if (unknown.length) {
  console.log(`${unknown.length} files in the database are not in the export (left untouched):`);
  for (const u of unknown) console.log(`  ${u}`);
}
if (!apply && linked) console.log('Dry run — add --apply to write.');
