import { useEffect, useRef, useState } from 'react';
import { site } from '@/config/site';
import { AuthError, loginWithTelegram, type TelegramWidgetUser } from '@/lib/auth';
import { t } from '@/lib/cabinet-strings';
import { Notice, Spinner } from './ui';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

/**
 * Telegram Login Widget. Only renders on the domain set via BotFather /setdomain
 * (www.li-astrology.com.ua) — on localhost the iframe shows "Bot domain invalid".
 * On success the Supabase session changes and CabinetShell re-renders.
 */
export default function TelegramLogin({ hint }: { hint?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    window.onTelegramAuth = async (user) => {
      setBusy(true);
      setError(null);
      try {
        await loginWithTelegram(user);
      } catch (e) {
        setBusy(false);
        setError(e instanceof AuthError && e.code === 'expired' ? t.login.expired : t.login.error);
      }
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.dataset.telegramLogin = site.bot.username;
    script.dataset.size = 'large';
    script.dataset.radius = '20';
    script.dataset.userpic = 'false';
    script.dataset.requestAccess = 'write';
    script.dataset.onauth = 'onTelegramAuth(user)';
    script.onerror = () => setBlocked(true);
    el.appendChild(script);

    const timer = window.setTimeout(() => {
      if (!el.querySelector('iframe')) setBlocked(true);
    }, 8000);

    return () => {
      window.clearTimeout(timer);
      delete window.onTelegramAuth;
      el.replaceChildren();
    };
  }, []);

  return (
    <section className="mx-auto max-w-lg rounded-3xl border border-ink/10 bg-cream p-8 text-center shadow-[0_30px_60px_-30px_rgba(11,10,18,0.35)] md:p-12">
      <div className="mb-4 text-3xl text-gold-deep" aria-hidden="true">✦</div>
      <h1 className="font-display text-3xl leading-tight md:text-4xl">{t.login.title}</h1>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">{t.login.text}</p>
      {hint && (
        <div className="mt-6 text-left">
          <Notice>{hint}</Notice>
        </div>
      )}
      <div className="mt-8 flex min-h-[48px] justify-center" hidden={busy}>
        <div ref={container} />
      </div>
      {busy && <Spinner label={t.login.loading} />}
      {blocked && !busy && (
        <div className="mt-6 text-left">
          <Notice tone="error">{t.login.widgetBlocked}</Notice>
        </div>
      )}
      {error && (
        <div className="mt-6 text-left">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </section>
  );
}
