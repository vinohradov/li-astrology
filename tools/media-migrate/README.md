# Media migration (cabinet Phase 4)

Moves lesson media out of Telegram so it can play in the cabinet. The originals exist only in
the private course channels, so step 1 is getting the files onto disk. Plan:
`.claude/dosc/CABINET_IMPLEMENTATION_PLAN.md` §7.

## 1. Get the files from Telegram

Only **one** channel is needed: every lesson file of all four courses also exists in
«Астрология с 0 // курс» (70 distinct files, 15.2 GB; the four channels together are 27 GB of
mostly the same files).

Either export it — channel → ⋮ → **Export chat history**, tick **Videos** and **Files**,
**Size limit** at the maximum (the largest video is 1.15 GB) — or download the files by hand
in the chat, which is usually faster than an export. Put or leave them anywhere under one
folder; `temporary/media-export/` is the default and is gitignored.

## 2. Check what is on disk

```bash
node tools/media-migrate/check-export.mjs            # or pass another folder
```

Searches the folder recursively and recognises each file by its exact byte size, so the folder
layout, file names and `result.json` don't matter, and a cancelled export is fine. Lists what
is still missing or half-downloaded and writes `manifest.json` there: one row per
`lessons.media` item with its Telegram `file_id`, plus a `content_id` shared by identical files.

## 3. Upload to Bunny

Videos go to the Stream library `li-astrology`; audio and documents go to the Storage zone
`li-astrology-files` (served through the pull zone `li-astrology-files.b-cdn.net`, token
authentication on) as `<type>/<content_id>.<ext>`.

Keys go in `tools/media-migrate/.env` (gitignored): `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`,
`BUNNY_TOKEN_KEY`, `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_HOST`, `BUNNY_STORAGE_PASSWORD`,
`BUNNY_FILES_HOST`, `BUNNY_FILES_TOKEN_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

```bash
node tools/media-migrate/upload.mjs --only video --limit 1   # smallest video, as a test
node tools/media-migrate/upload.mjs                          # everything else; safe to re-run
```

Each distinct file (`content_id`) is uploaded once — 70 files cover all 115 lesson items.
Progress is kept in `temporary/media-export/uploaded.json`.

## 4. Link the files to lessons

```bash
node tools/media-migrate/link.mjs                    # dry run
node tools/media-migrate/link.mjs --apply
```

Adds `bunny_video_id` (videos) or `storage_path` (audio/documents), plus `size_bytes` and
`duration_s`, to each matching `lessons.media` item, matched by `file_id`. The bot keeps
reading `file_id`. The cabinet gets a signed URL for each item from the `media-url` edge
function, which needs the secrets `BUNNY_LIBRARY_ID`, `BUNNY_TOKEN_KEY`, `BUNNY_FILES_HOST`
and `BUNNY_FILES_TOKEN_KEY`.
