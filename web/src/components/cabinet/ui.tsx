import type { ReactNode } from 'react';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-muted" role="status">
      <svg className="h-5 w-5 animate-spin text-gold-deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
        <path d="M22 12a10 10 0 0 0-10-10" strokeLinecap="round" />
      </svg>
      {label && <span>{label}</span>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const tones = {
    info: 'border-gold/40 bg-cream text-ink',
    error: 'border-red-400/50 bg-red-50 text-red-900',
    success: 'border-emerald-500/40 bg-emerald-50 text-emerald-900',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border px-5 py-4 text-sm leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function ProgressBar({ completed, total, label }: { completed: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
      >
        <div className="h-full rounded-full gradient-gold transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {label && <div className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-muted">{label}</div>}
    </div>
  );
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold uppercase tracking-[0.18em] transition duration-300 disabled:opacity-50 disabled:pointer-events-none';
const buttonVariants = {
  primary: 'bg-gold-bright text-ink hover:bg-gold',
  dark: 'bg-ink text-cream hover:bg-plum-deep',
  outline: 'border border-ink/20 text-ink hover:border-ink/50',
  ghost: 'text-ink-muted hover:text-ink',
};
const buttonSizes = { sm: 'px-4 py-2 text-[11px]', md: 'px-6 py-3 text-xs' };

export function buttonClass(variant: keyof typeof buttonVariants = 'primary', size: keyof typeof buttonSizes = 'md') {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}

/** Type icon rule from bot/src/handlers/lesson.ts: skip when the title already starts with an emoji. */
export function lessonLabel(title: string, contentType: string): string {
  if (/^\p{Extended_Pictographic}/u.test(title)) return title;
  const icon =
    contentType === 'video' ? '🎬' : contentType === 'audio' ? '🎧' : contentType === 'document' ? '📄' : '📚';
  return `${icon} ${title}`;
}
