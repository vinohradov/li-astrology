// Headless UI test of the cabinet against a local `astro preview` (port 4329) with the
// owner's real session injected into localStorage. Tracker requests (GA/Meta) are blocked
// so no fake page views or purchases are sent. Clicks "mark complete" once — the caller
// must restore that progress row (run.sh does).
// Usage: PW=<path to playwright/index.mjs> node ui_test.mjs <outDir> <lessonId> <lessonTitle> <lockedLessonId>
//   <outDir>/session.json must exist (written by rls_auth_test.py).
const { chromium } = await import(process.env.PW);
import fs from 'node:fs';
const [,, scratch, lessonId, lessonTitle, azLesson] = process.argv;
const session = fs.readFileSync(`${scratch}/session.json`, 'utf8');
fs.mkdirSync(`${scratch}/run2`, { recursive: true });
const base = 'http://localhost:4329';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const problems = [];
const TRACKERS = /googletagmanager|google-analytics|analytics\.google|facebook\.net|facebook\.com\/tr|doubleclick/;
async function newCtx(opts, authed) {
  const ctx = await browser.newContext(opts);
  await ctx.route(TRACKERS, (r) => r.abort());
  if (authed) await ctx.addInitScript((s) => localStorage.setItem('sb-plyofinxmwvwbintvqbx-auth-token', s), session);
  return ctx;
}
async function visit(ctx, path, name, check) {
  const p = await ctx.newPage();
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/ERR_FAILED|net::|telegram\.org|status of 404/.test(t)) problems.push(`${name} console: ${t.slice(0, 200)}`); });
  p.on('pageerror', (e) => problems.push(`${name} pageerror: ${e.message}`));
  p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('supabase.co') && !(name === 'claim-unknown' && r.url().includes('claim-order'))) problems.push(`${name} http ${r.status()} ${r.url().slice(0, 140)}`); });
  await p.goto(base + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${scratch}/run2/shot-${name}.png`, fullPage: true });
  if (check) {
    const text = (await p.locator("body").innerText()).toLowerCase();
    console.log(`${check(text, p) ? 'OK  ' : 'FAIL'} ${name} — ${text.replace(/\s+/g, ' ').slice(0, 130)}`);
  }
  return p;
}
const desk = await newCtx({ viewport: { width: 1280, height: 900 } }, true);
await visit(desk, '/cabinet/', 'home', (t) => t.includes('мої курси') && t.includes('3/11 уроків') && t.includes('інші курси') && t.includes('купити'));
await visit(desk, '/cabinet/course/?slug=intensiv', 'course-owned', (t) => t.includes('урок 1') && !t.includes('ще не придбано'));
await visit(desk, '/cabinet/course/?slug=astro-z-0', 'course-locked', (t) => t.includes('ще не придбано') && t.includes('🔒'));
await visit(desk, '/cabinet/course/?slug=nope', 'course-missing', (t) => t.includes('не знайдено'));
const lp = await visit(desk, `/cabinet/lesson/?id=${lessonId}`, 'lesson', (t) => t.includes(lessonTitle.toLowerCase()) && t.includes('відкрити в боті'));
const btn = lp.getByRole('button', { name: /Позначити як завершений/ });
if (await btn.count()) {
  await btn.click(); await lp.waitForTimeout(1500);
  const t = (await lp.locator('main').innerText()).toLowerCase();
  console.log(`${t.includes('урок завершено') && t.includes('завершено') ? 'OK  ' : 'FAIL'} mark-complete UI`);
  await lp.screenshot({ path: `${scratch}/run2/shot-lesson-completed.png`, fullPage: true });
} else console.log('FAIL mark-complete button missing');
await visit(desk, `/cabinet/lesson/?id=${azLesson}`, 'lesson-locked', (t) => t.includes('немає доступу'));
await visit(desk, '/cabinet/settings/', 'settings', (t) => t.includes('id 413606412') && t.includes('українська'));
await visit(desk, '/cabinet/?claim=web-intensiv-does-not-exist', 'claim-unknown', (t) => t.includes('замовлення не знайдено'));
const mob = await newCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, true);
for (const [path, name] of [['/cabinet/', 'mobile-home'], ['/cabinet/course/?slug=astro-z-0', 'mobile-course'], [`/cabinet/lesson/?id=${lessonId}`, 'mobile-lesson']]) {
  const p = await visit(mob, path, name);
  if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) problems.push(`${name}: horizontal overflow`);
}
const anon = await newCtx({ viewport: { width: 1280, height: 900 } }, false);
await visit(anon, '/cabinet/', 'logged-out', (t) => t.includes('особистий кабінет'));
await visit(anon, '/cabinet/?claim=web-abc', 'logged-out-claim', (t) => t.includes('активувати замовлення web-abc'));
const sp = await visit(anon, '/payment/success/?order_id=web-intensiv-123-abc&product=intensiv', 'success', (t) => t.includes('відкрити кабінет') && t.includes('відкрити в telegram'));
console.log('success cabinet href:', await sp.locator('#success-cabinet-link').getAttribute('href'));
console.log('success bot href:    ', await sp.locator('#success-bot-link').getAttribute('href'));
await visit(anon, '/', 'site-home', (t) => t.includes('кабінет'));
await browser.close();
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'no console errors / failed supabase requests / overflow');
