import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { site } from '@/config/site';
import { functionsUrl, supabase } from './supabase';

/** Raw payload the Telegram Login Widget passes to its onauth callback. */
export type TelegramWidgetUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export class AuthError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Verify the widget payload server-side and start a Supabase session. */
export async function loginWithTelegram(user: TelegramWidgetUser): Promise<Session> {
  const res = await fetch(`${functionsUrl}/tg-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${site.supabase.anonKey}`,
    },
    body: JSON.stringify(user),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.token_hash) throw new AuthError(payload.error || `http_${res.status}`);

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: payload.token_hash,
    type: 'magiclink',
  });
  if (error || !data.session) throw new AuthError(error?.message || 'no_session');

  window.gtag?.('event', 'login', { method: 'telegram' });
  return data.session;
}

export function getTelegramId(session: Session | null): number | null {
  const raw = session?.user.app_metadata?.telegram_id;
  const id = Number(raw);
  return raw != null && Number.isSafeInteger(id) ? id : null;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

/** Current session, kept in sync with login/logout/refresh. `loading` is true until the first read. */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
