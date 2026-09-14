import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { site } from '@/config/site';
import { getTelegramId, logout, useSession } from '@/lib/auth';
import { t } from '@/lib/cabinet-strings';
import Logo from './Logo';
import TelegramLogin from './TelegramLogin';
import { Spinner } from './ui';

export type CabinetCtx = { session: Session; telegramId: number };

type Props = {
  children: (ctx: CabinetCtx) => ReactNode;
  /** Extra line on the login card (e.g. which order will be activated). */
  loginHint?: string;
  active?: 'courses' | 'settings';
};

/** Frame for every cabinet page: top bar, session gate, footer. */
export default function CabinetShell({ children, loginHint, active }: Props) {
  const { session, loading } = useSession();
  const telegramId = getTelegramId(session);
  const signedIn = session !== null && telegramId !== null;

  const navLink = (href: string, label: string, isActive: boolean) => (
    <a
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`rounded-full px-4 py-2 transition-colors ${isActive ? 'bg-gold-bright text-ink' : 'text-cream/75 hover:text-cream'}`}
    >
      {label}
    </a>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="gradient-night text-cream">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 md:px-8">
          <a href="/cabinet/" className="group flex items-center gap-3">
            <Logo className="h-9 w-9 transition-transform duration-700 group-hover:rotate-12" />
            <span className="font-display text-lg leading-none tracking-wide">
              Li <span className="italic text-gold-bright">Astrology</span>
            </span>
          </a>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-medium">
            {signedIn ? (
              <>
                {navLink('/cabinet/', t.nav.myCourses, active === 'courses')}
                {navLink('/cabinet/settings/', t.nav.settings, active === 'settings')}
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    window.location.href = '/cabinet/';
                  }}
                  className="rounded-full px-4 py-2 text-cream/60 transition-colors hover:text-cream"
                >
                  {t.nav.logout}
                </button>
              </>
            ) : (
              navLink('/', t.nav.toSite, false)
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 md:px-8 md:py-14">
        {loading ? (
          <Spinner label={t.common.loading} />
        ) : signedIn ? (
          children({ session: session!, telegramId: telegramId! })
        ) : (
          <TelegramLogin hint={loginHint} />
        )}
      </main>

      <footer className="border-t border-ink/10 px-5 py-6 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} {site.name} ·{' '}
        <a href={`mailto:${site.contact.email}`} className="underline-offset-4 hover:underline">
          {site.contact.email}
        </a>
      </footer>
    </div>
  );
}
