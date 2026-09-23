/**
 * Verifies that bot messaging audiences exclude website-only sign-ups
 * (bot_users.started_bot_at IS NULL) and include real bot users. Runs the bot's own
 * audience functions against the LIVE DB with two synthetic bot_users rows (ids
 * 990000000001/2, never real Telegram ids), which are always deleted afterwards.
 *
 * Run from repo root:  bot/node_modules/.bin/tsx --env-file=bot/.env tools/cabinet-tests/bot_audience_test.ts
 */
import { supabase } from '../../bot/src/db/client.js';
import { fetchColdUsers, fetchIntensivBuyers } from '../../bot/src/jobs/nurture.js';

const WEB_ONLY = 990000000001; // tg-auth style row: started_bot_at NULL
const BOT_USER = 990000000002; // pressed Start yesterday
let failed = 0;
const expect = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) failed++;
};

async function main() {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const { error: insErr } = await supabase.from('bot_users').insert([
    { id: WEB_ONLY, first_name: 'WebOnly', blocked_bot: false, created_at: yesterday, started_bot_at: null },
    { id: BOT_USER, first_name: 'BotUser', blocked_bot: false, created_at: yesterday, started_bot_at: yesterday },
  ]);
  if (insErr) throw insErr;

  try {
    const cold = await fetchColdUsers();
    const ids = new Set(cold.map((a) => a.userId));
    expect('cold nurture excludes website-only sign-up', !ids.has(WEB_ONLY));
    expect('cold nurture includes bot user', ids.has(BOT_USER));
    const anchor = cold.find((a) => a.userId === BOT_USER)?.anchor;
    expect('cold anchor = started_bot_at', !!anchor && Math.abs(anchor.getTime() - new Date(yesterday).getTime()) < 1000, String(anchor));

    const buyers = await fetchIntensivBuyers();
    expect('buyer audience has no NULL started_bot_at rows', buyers.every((b) => b.userId > 0), `${buyers.length} buyers`);

    // Direct check of the inactivity + broadcast filter shape
    const { data: inactive } = await supabase.from('bot_users').select('id').eq('blocked_bot', false).not('started_bot_at', 'is', null).in('id', [WEB_ONLY, BOT_USER]);
    expect('started_bot_at filter keeps only the bot user', inactive?.length === 1 && inactive[0].id === BOT_USER, JSON.stringify(inactive));
  } finally {
    const { error: delErr } = await supabase.from('bot_users').delete().in('id', [WEB_ONLY, BOT_USER]);
    const { data: left } = await supabase.from('bot_users').select('id').in('id', [WEB_ONLY, BOT_USER]);
    console.log('cleanup:', delErr ? delErr.message : 'ok', 'leftover:', left?.length ?? '?');
  }
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
}

main().then(() => process.exit(failed ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
