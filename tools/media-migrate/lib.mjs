// Shared bits for the media-migrate scripts: paths, .env, manifest and upload state.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');

const VALUE_FLAGS = ['--limit', '--only'];

/** First non-flag argument, else temporary/media-export. */
export function exportDirFromArgs(argv = process.argv.slice(2)) {
  const dir = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(argv[i - 1]));
  return path.resolve(dir ?? path.join(ROOT, 'temporary/media-export'));
}

/** tools/media-migrate/.env → object; exits when a required key is empty. */
export function loadEnv(required) {
  const file = path.join(HERE, '.env');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.trim().startsWith('#')) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  const empty = required.filter((k) => !env[k]);
  if (empty.length) {
    console.error(`Missing in ${file}: ${empty.join(', ')}`);
    process.exit(1);
  }
  return env;
}

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

export function loadManifest(exportDir) {
  const file = path.join(exportDir, 'manifest.json');
  if (!fs.existsSync(file)) {
    console.error(`No manifest at ${file} — run check-export.mjs first.`);
    process.exit(1);
  }
  return readJson(file);
}

/** uploaded.json: { [content_id]: { bunny_video_id | storage_path, title, uploaded } } */
export function loadState(exportDir) {
  const file = path.join(exportDir, 'uploaded.json');
  const state = fs.existsSync(file) ? readJson(file) : {};
  const save = () => fs.writeFileSync(file, JSON.stringify(state, null, 2));
  return { state, save };
}
