/**
 * Generates the "welcome back" banner PNG sent when a user returns after >48h.
 *
 * Run: `npm run build:banner` — outputs bot/assets/welcome-back-banner.png.
 * Commit the PNG; production never invokes sharp.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 720;
const H = 1600;

// Deterministic "stars" — pseudo-random but stable so re-runs produce the same PNG
function* starPositions(): Generator<{ x: number; y: number; r: number; opacity: number }> {
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 90; i++) {
    yield {
      x: Math.round(rand() * W),
      y: Math.round(rand() * H),
      r: 0.5 + rand() * 1.7,
      opacity: 0.25 + rand() * 0.6,
    };
  }
}

const stars = [...starPositions()]
  .map(
    (s) =>
      `<circle cx="${s.x}" cy="${s.y}" r="${s.r.toFixed(2)}" fill="#fff" opacity="${s.opacity.toFixed(2)}"/>`,
  )
  .join('\n  ');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0a1f"/>
      <stop offset="55%" stop-color="#141029"/>
      <stop offset="100%" stop-color="#1d1538"/>
    </linearGradient>

    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6d27a"/>
      <stop offset="50%" stop-color="#e8b552"/>
      <stop offset="100%" stop-color="#b88532"/>
    </linearGradient>

    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e8b552" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="#e8b552" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#e8b552" stop-opacity="0"/>
    </radialGradient>

    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- starfield -->
  ${stars}

  <!-- soft halo behind the star symbol -->
  <circle cx="${W / 2}" cy="${H * 0.40}" r="260" fill="url(#halo)"/>

  <!-- 8-pointed star symbol -->
  <g transform="translate(${W / 2} ${H * 0.40})">
    <path d="M 0 -130 L 22 -22 L 130 0 L 22 22 L 0 130 L -22 22 L -130 0 L -22 -22 Z"
          fill="url(#gold)" opacity="0.95"/>
    <path d="M 0 -90 L 12 -12 L 90 0 L 12 12 L 0 90 L -12 12 L -90 0 L -12 -12 Z"
          fill="#fff8e6" opacity="0.85"/>
    <circle cx="0" cy="0" r="6" fill="#fff"/>
  </g>

  <!-- brand wordmark -->
  <text x="${W / 2}" y="${H * 0.58}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="62" font-style="italic" fill="url(#gold)" letter-spacing="2">
    li.astrology
  </text>

  <!-- divider -->
  <line x1="${W / 2 - 90}" y1="${H * 0.62}" x2="${W / 2 + 90}" y2="${H * 0.62}"
        stroke="url(#gold)" stroke-width="1" opacity="0.65"/>

  <!-- welcome message (Ukrainian) -->
  <text x="${W / 2}" y="${H * 0.70}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif"
        font-size="46" font-weight="300" fill="#f4ead6" letter-spacing="1">
    З поверненням
  </text>

  <!-- subtitle -->
  <text x="${W / 2}" y="${H * 0.76}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif"
        font-size="26" font-weight="300" fill="#9b8fae" letter-spacing="1">
    продовжуємо подорож
  </text>

  <!-- small decorative stars near bottom -->
  <g fill="url(#gold)" opacity="0.85">
    <circle cx="${W / 2 - 110}" cy="${H * 0.85}" r="2"/>
    <circle cx="${W / 2 - 60}" cy="${H * 0.85}" r="3"/>
    <circle cx="${W / 2}" cy="${H * 0.85}" r="2.5"/>
    <circle cx="${W / 2 + 60}" cy="${H * 0.85}" r="3"/>
    <circle cx="${W / 2 + 110}" cy="${H * 0.85}" r="2"/>
  </g>
</svg>`;

const __filename = fileURLToPath(import.meta.url);
const outDir = resolve(dirname(__filename), '..', 'assets');
const outPath = resolve(outDir, 'welcome-back-banner.png');

await mkdir(outDir, { recursive: true });

const pngBuf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(outPath, pngBuf);

// Also drop the SVG source alongside for future tweaks
await writeFile(resolve(outDir, 'welcome-back-banner.svg'), svg);

const stats = pngBuf.byteLength;
console.log(`✓ Wrote ${outPath} (${(stats / 1024).toFixed(1)} KB, ${W}x${H})`);
