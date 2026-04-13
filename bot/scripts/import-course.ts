/**
 * CLI script to import Telegram channel export into the database.
 *
 * Usage:
 *   npx tsx scripts/import-course.ts --file ./export/result.json --course-slug basic
 */

import fs from 'fs';
import path from 'path';
import { parseExport } from '../src/import/parse-export.js';
import { seedLessons } from '../src/import/seed-lessons.js';
import { supabase } from '../src/db/client.js';

async function main() {
  const args = process.argv.slice(2);

  const fileIdx = args.indexOf('--file');
  const slugIdx = args.indexOf('--course-slug');

  if (fileIdx === -1 || slugIdx === -1) {
    console.error('Usage: npx tsx scripts/import-course.ts --file <path> --course-slug <slug>');
    console.error('Available slugs: intensiv, aspekty, basic, advanced');
    process.exit(1);
  }

  const filePath = path.resolve(args[fileIdx + 1]);
  const courseSlug = args[slugIdx + 1];

  // Validate file exists
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Find course
  const { data: course, error } = await supabase
    .from('courses')
    .select('id, title, slug')
    .eq('slug', courseSlug)
    .single();

  if (error || !course) {
    console.error(`Course not found: ${courseSlug}`);
    console.error('Make sure you ran schema.sql first.');
    process.exit(1);
  }

  console.log(`Importing into: ${course.title} (${course.slug})`);
  console.log(`Reading: ${filePath}`);

  // Parse export
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const lessons = parseExport(raw);

  console.log(`Parsed ${lessons.length} lessons from export`);

  if (lessons.length === 0) {
    console.log('No lessons found. Check the export file format.');
    process.exit(0);
  }

  // Show preview
  console.log('\nPreview (first 5):');
  for (const l of lessons.slice(0, 5)) {
    console.log(`  ${l.position}. [${l.contentType}] ${l.title}`);
  }
  console.log('');

  // Seed
  await seedLessons(course.id, lessons);
}

main().catch(e => {
  console.error('Import failed:', e);
  process.exit(1);
});
