import { useEffect, useState } from 'react';
import { getMe, setLang } from '@/lib/cabinet-api';
import type { Me } from '@/lib/cabinet-types';
import { t } from '@/lib/cabinet-strings';
import CabinetShell, { type CabinetCtx } from './CabinetShell';
import { Notice, Spinner } from './ui';

export default function SettingsView() {
  return <CabinetShell active="settings">{(ctx) => <Settings {...ctx} />}</CabinetShell>;
}

function Settings({ telegramId }: CabinetCtx) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getMe(telegramId).then(setMe).catch(() => setError(true));
  }, [telegramId]);

  if (error) return <Notice tone="error">{t.home.loadError}</Notice>;
  if (me === undefined) return <Spinner label={t.common.loading} />;

  const choose = async (lang: 'uk' | 'ru') => {
    setSaved(false);
    try {
      await setLang(telegramId, lang);
      setMe((m) => (m ? { ...m, lang } : m));
      setSaved(true);
    } catch {
      setError(true);
    }
  };

  const name = [me?.first_name, me?.last_name].filter(Boolean).join(' ');

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <h1 className="font-display text-4xl">{t.settings.title}</h1>

      <section className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-6">
        <h2 className="text-xs uppercase tracking-[0.25em] text-ink-muted">{t.settings.account}</h2>
        <div className="font-display text-xl">{name || '—'}</div>
        <div className="text-sm text-ink-muted">
          {me?.username ? `@${me.username} · ` : ''}ID {telegramId}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-6">
        <div>
          <h2 className="text-xs uppercase tracking-[0.25em] text-ink-muted">{t.settings.lang}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t.settings.langHint}</p>
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label={t.settings.lang}>
          {(['uk', 'ru'] as const).map((lang) => {
            const active = (me?.lang ?? 'uk') === lang;
            return (
              <button
                key={lang}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(lang)}
                className={`rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-widest transition ${active ? 'bg-gold-bright text-ink' : 'border border-ink/15 text-ink-muted hover:text-ink'}`}
              >
                {lang === 'uk' ? 'Українська' : 'Русский'}
              </button>
            );
          })}
        </div>
        {saved && <Notice tone="success">{t.settings.saved}</Notice>}
      </section>
    </div>
  );
}
