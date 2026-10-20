// Uploads every unique lesson file from the export manifest to Bunny:
// videos → Stream library, audio and documents → Storage zone.
//
//   node tools/media-migrate/upload.mjs [exportDir] [--only video|audio|document] [--limit N]
//
// Smallest files go first, so `--only video --limit 1` is a cheap end-to-end test. Safe to
// re-run: finished uploads are remembered in <exportDir>/uploaded.json (keyed by the manifest's
// content_id, so a file shared by several courses is uploaded once); an interrupted
// video is deleted and redone.
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { exportDirFromArgs, loadEnv, loadManifest, loadState } from './lib.mjs';

const env = loadEnv([
  'BUNNY_LIBRARY_ID',
  'BUNNY_API_KEY',
  'BUNNY_STORAGE_ZONE',
  'BUNNY_STORAGE_HOST',
  'BUNNY_STORAGE_PASSWORD',
]);
const exportDir = exportDirFromArgs();
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const limit = flag('--limit') ? Number(flag('--limit')) : Infinity;
const only = flag('--only');

const STREAM = `https://video.bunnycdn.com/library/${env.BUNNY_LIBRARY_ID}/videos`;
const streamHeaders = { AccessKey: env.BUNNY_API_KEY, accept: 'application/json' };
const STORAGE = `https://${env.BUNNY_STORAGE_HOST}/${env.BUNNY_STORAGE_ZONE}`;
const DEFAULT_EXT = { audio: '.mp3', document: '.pdf' };

async function streamApi(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { ...streamHeaders, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url.replace(STREAM, '')} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Streamed PUT with a known Content-Length (videos are up to 1.2 GB).
function putFile(url, accessKey, file, size, onProgress) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'PUT', headers: { AccessKey: accessKey, 'Content-Type': 'application/octet-stream', 'Content-Length': size } },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () =>
          res.statusCode === 200 || res.statusCode === 201
            ? resolve()
            : reject(new Error(`upload → ${res.statusCode} ${text.slice(0, 200)}`)),
        );
      },
    );
    req.on('error', reject);
    let sent = 0;
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => onProgress((sent += chunk.length)));
    stream.on('error', reject);
    stream.pipe(req);
  });
}

const manifest = loadManifest(exportDir);
const { state, save } = loadState(exportDir);

const unique = [...new Map(manifest.map((m) => [m.content_id, m])).values()]
  .filter((m) => !only || m.type === only)
  .sort((a, b) => a.size_bytes - b.size_bytes);
const todo = unique.filter((f) => !state[f.content_id]?.uploaded).slice(0, limit);
const todoGb = todo.reduce((sum, f) => sum + f.size_bytes, 0) / 1e9;
console.log(`${unique.length} unique files, ${unique.length - todo.length} not in this run, uploading ${todo.length} (${todoGb.toFixed(2)} GB)\n`);

let failed = 0;
for (const [i, file] of todo.entries()) {
  const key = file.content_id;
  const title = `${file.course_slug} · ${file.lesson_title} · ${file.file_name}`;
  const mb = (file.size_bytes / 1e6).toFixed(0);
  let lastPct = -1;
  const progress = (sent) => {
    const pct = Math.floor((sent / file.size_bytes) * 100);
    if (pct >= lastPct + 10) {
      lastPct = pct;
      process.stdout.write(`\r[${i + 1}/${todo.length}] ${title} — ${mb} MB ${pct}%   `);
    }
  };
  try {
    if (file.type === 'video') {
      if (state[key]) {
        // Left over from an interrupted run — Bunny rejects a second PUT, so start clean.
        await streamApi('DELETE', `${STREAM}/${state[key].bunny_video_id}`).catch(() => {});
        delete state[key];
      }
      const created = await streamApi('POST', STREAM, { title });
      state[key] = { bunny_video_id: created.guid, title, uploaded: false };
      save();
      await putFile(`${STREAM}/${created.guid}`, env.BUNNY_API_KEY, file.path, file.size_bytes, progress);
    } else {
      // ASCII-only path: it is signed and put in URLs by the media-url function.
      const ext = path.extname(file.file_name).toLowerCase() || DEFAULT_EXT[file.type];
      const storagePath = `${file.type}/${key}${ext}`;
      state[key] = { storage_path: storagePath, title, uploaded: false };
      save();
      await putFile(`${STORAGE}/${storagePath}`, env.BUNNY_STORAGE_PASSWORD, file.path, file.size_bytes, progress);
    }
    state[key].uploaded = true;
    save();
    process.stdout.write(`\r[${i + 1}/${todo.length}] ${title} — ${mb} MB ✓      \n`);
  } catch (e) {
    failed++;
    process.stdout.write(`\n  ✗ ${title}: ${e.message}\n`);
  }
}

const done = unique.filter((f) => state[f.content_id]?.uploaded).length;
console.log(`\n${done}/${unique.length} files uploaded. Bunny encodes videos in the background.`);
if (failed) process.exit(1);
