// Queues nurture messages. Two parallel sequences:
//   1. Intensiv buyer → full course (type: nurture_day<N>, anchor: purchase)
//   2. Non-buyer → Intensiv tripwire (type: cold_nurture_day<N>, anchor: registration)
// Both run on the same cron tick. Delivery is handled by send-reminders,
// which polls `reminders` every minute.

import { supabase } from '../db/client.js';
import { createReminder } from '../db/reminders.js';
import {
  COLD_NURTURE_STEPS,
  INTENSIV_NURTURE_STEPS,
  type NurtureStep,
} from '../content/nurture.js';

const INTENSIV_SLUG = 'intensiv';
const CONVERSION_SLUG = 'astro-z-0';
const COLD_MAX_AGE_DAYS = 30; // skip stale bot_users older than this

interface Audience {
  userId: number;
  firstName: string | null;
  lang: string;
  anchor: Date;
}

export async function checkNurture() {
  const intensivQueued = await runSequence(
    await fetchIntensivBuyers(),
    INTENSIV_NURTURE_STEPS,
    'nurture_day',
  );

  const coldQueued = await runSequence(
    await fetchColdUsers(),
    COLD_NURTURE_STEPS,
    'cold_nurture_day',
  );

  if (intensivQueued || coldQueued) {
    console.log(
      `Nurture queued: ${intensivQueued} intensiv, ${coldQueued} cold`,
    );
  }
}

async function runSequence(
  audience: Audience[],
  steps: NurtureStep[],
  typePrefix: string,
): Promise<number> {
  const now = Date.now();
  let queued = 0;

  for (const u of audience) {
    const ageDays = Math.floor((now - u.anchor.getTime()) / 86_400_000);

    for (const step of steps) {
      if (ageDays < step.day) continue;

      const type = `${typePrefix}${step.day}`;

      const { count: existing } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.userId)
        .eq('type', type);
      if ((existing ?? 0) > 0) continue;

      const name = u.firstName ?? '';
      const text = u.lang === 'ru' ? step.textRu(name) : step.textUk(name);
      const buttons = step.button
        ? [
            {
              text: u.lang === 'ru' ? step.button.labelRu : step.button.labelUk,
              url: step.button.url,
            },
          ]
        : undefined;

      await createReminder({
        userId: u.userId,
        type,
        payload: { text, buttons },
      });
      queued += 1;
    }
  }

  return queued;
}

async function fetchIntensivBuyers(): Promise<Audience[]> {
  const { data: intensiv } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', INTENSIV_SLUG)
    .single();
  if (!intensiv) return [];

  const { data: fullCourse } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', CONVERSION_SLUG)
    .single();

  const { data: rows } = await supabase
    .from('user_courses')
    .select('user_id, purchased_at, bot_users!inner(id, first_name, lang, blocked_bot)')
    .eq('course_id', intensiv.id)
    .eq('bot_users.blocked_bot', false);

  if (!rows) return [];

  const out: Audience[] = [];
  for (const r of rows as any[]) {
    // Skip users who already converted to full course.
    if (fullCourse) {
      const { count } = await supabase
        .from('user_courses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', r.user_id)
        .eq('course_id', fullCourse.id);
      if ((count ?? 0) > 0) continue;
    }
    out.push({
      userId: r.user_id,
      firstName: r.bot_users?.first_name ?? null,
      lang: r.bot_users?.lang ?? 'uk',
      anchor: new Date(r.purchased_at),
    });
  }
  return out;
}

async function fetchColdUsers(): Promise<Audience[]> {
  const cutoff = new Date(
    Date.now() - COLD_MAX_AGE_DAYS * 86_400_000,
  ).toISOString();

  const { data: users } = await supabase
    .from('bot_users')
    .select('id, first_name, lang, created_at')
    .eq('blocked_bot', false)
    .gte('created_at', cutoff);

  if (!users || users.length === 0) return [];

  // Exclude anyone who already bought anything — they move into intensiv-nurture
  // (or are already fully converted).
  const { data: purchases } = await supabase
    .from('user_courses')
    .select('user_id');

  const buyerIds = new Set((purchases ?? []).map((p: any) => p.user_id));

  return users
    .filter((u: any) => !buyerIds.has(u.id))
    .map((u: any) => ({
      userId: u.id,
      firstName: u.first_name ?? null,
      lang: u.lang ?? 'uk',
      anchor: new Date(u.created_at),
    }));
}
