import { useEffect, useState } from 'react';
import { products, type ProductSlug } from '@/config/site';
import { courseStats, getCourseBySlug, getMyProgress, getOutline, listOwnedCourseIds } from '@/lib/cabinet-api';
import type { Course, LessonOutline, Progress } from '@/lib/cabinet-types';
import { t } from '@/lib/cabinet-strings';
import { tgHtmlToWeb } from '@/lib/tg-html';
import CabinetShell, { type CabinetCtx } from './CabinetShell';
import { courseTitle, formatPrice } from './CabinetHome';
import { createInvoice, trackCheckout } from '@/lib/checkout';
import { Notice, ProgressBar, Spinner, buttonClass, lessonLabel } from './ui';

export default function CourseView() {
  return <CabinetShell active="courses">{(ctx) => <Course {...ctx} />}</CabinetShell>;
}

type Data = { course: Course | null; owned: boolean; outline: LessonOutline[]; progress: Map<string, Progress> };

/** Consecutive compact lessons render as a chip grid, the rest as full rows (same as the bot). */
function groupLessons(outline: LessonOutline[]): Array<{ compact: boolean; items: LessonOutline[] }> {
  const groups: Array<{ compact: boolean; items: LessonOutline[] }> = [];
  for (const lesson of outline) {
    const last = groups[groups.length - 1];
    if (last && last.compact && lesson.compact) last.items.push(lesson);
    else groups.push({ compact: lesson.compact, items: [lesson] });
  }
  return groups;
}

function Course({ telegramId }: CabinetCtx) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState(false);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('slug') ?? '';
    (async () => {
      const course = slug ? await getCourseBySlug(slug) : null;
      if (!course) return setData({ course: null, owned: false, outline: [], progress: new Map() });
      const [owned, outline, progress] = await Promise.all([listOwnedCourseIds(), getOutline(course.id), getMyProgress()]);
      document.title = `${courseTitle(course)} — Кабінет`;
      setData({ course, owned: owned.has(course.id), outline, progress });
    })().catch((e) => {
      console.error('course load failed', e);
      setError(true);
    });
  }, []);

  if (error) return <Notice tone="error">{t.home.loadError}</Notice>;
  if (!data) return <Spinner label={t.common.loading} />;

  const back = (
    <a href="/cabinet/" className="text-sm text-ink-muted transition-colors hover:text-ink">
      {t.course.back}
    </a>
  );

  if (!data.course) {
    return (
      <div className="space-y-6">
        {back}
        <Notice tone="error">{t.course.notFound}</Notice>
      </div>
    );
  }

  const { course, owned, outline, progress } = data;
  const stats = courseStats(outline, progress);
  const product = products[course.slug as ProductSlug];

  const buy = async () => {
    setBuying(true);
    setBuyError(false);
    trackCheckout(course.slug);
    try {
      window.location.href = await createInvoice({ slug: course.slug, telegramUserId: telegramId });
    } catch (e) {
      console.error('course buy failed', e);
      setBuyError(true);
      setBuying(false);
    }
  };

  const row = (lesson: LessonOutline, compact: boolean) => {
    const done = owned && progress.get(lesson.id)?.completed;
    const label = compact ? lesson.title : lessonLabel(lesson.title, lesson.content_type);
    const base = compact
      ? 'flex h-full items-center gap-2 rounded-2xl border px-4 py-3 text-sm'
      : 'flex items-center gap-4 rounded-2xl border px-5 py-4';
    const inner = (
      <>
        {owned && (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? 'bg-emerald-600 text-white' : 'border border-ink/20'}`}
            aria-label={done ? t.lesson.completed : undefined}
          >
            {done ? '✓' : ''}
          </span>
        )}
        <span className={compact ? 'leading-snug' : 'font-medium leading-snug'}>{label}</span>
        {!owned && <span className="ml-auto shrink-0 text-sm opacity-60" aria-hidden="true">🔒</span>}
      </>
    );
    return owned ? (
      <a
        key={lesson.id}
        href={`/cabinet/lesson/?id=${lesson.id}`}
        className={`${base} border-ink/10 bg-cream transition hover:border-gold hover:bg-white`}
      >
        {inner}
      </a>
    ) : (
      <div key={lesson.id} className={`${base} border-ink/5 bg-cream/60 text-ink-muted`}>
        {inner}
      </div>
    );
  };

  return (
    <div className="space-y-10">
      <div className="space-y-5">
        {back}
        <h1 className="font-display text-3xl leading-tight md:text-5xl">{courseTitle(course)}</h1>
        {owned && (
          <div className="max-w-md">
            <ProgressBar completed={stats.completed} total={stats.total} label={t.home.progress(stats.completed, stats.total)} />
          </div>
        )}
        {owned && stats.nextLessonId && (
          <a href={`/cabinet/lesson/?id=${stats.nextLessonId}`} className={buttonClass('primary')}>
            {stats.completed > 0 ? t.home.continue : t.home.start}
          </a>
        )}
      </div>

      {!owned && (
        <div className="space-y-4">
          <Notice>{t.course.locked}</Notice>
          {buyError && <Notice tone="error">{t.home.buyError}</Notice>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={buy} disabled={buying} className={buttonClass('primary')}>
              {buying ? t.home.processing : `${t.home.buy} · ${formatPrice(course.price_uah)}`}
            </button>
            {product?.href && (
              <a href={product.href} className={buttonClass('outline')}>
                {t.home.details}
              </a>
            )}
          </div>
        </div>
      )}

      {owned && course.intro_html && (
        <details className="group rounded-2xl border border-ink/10 bg-cream px-5 py-4">
          <summary className="cursor-pointer list-none font-medium marker:hidden">
            <span className="inline-block transition-transform group-open:rotate-90">›</span> {t.course.about}
          </summary>
          <div className="lesson-html mt-4" dangerouslySetInnerHTML={{ __html: tgHtmlToWeb(course.intro_html) }} />
        </details>
      )}

      <ol className="space-y-3">
        {groupLessons(outline).map((group) =>
          group.compact ? (
            <li key={group.items[0].id} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.items.map((l) => row(l, true))}
            </li>
          ) : (
            <li key={group.items[0].id}>{row(group.items[0], false)}</li>
          ),
        )}
      </ol>
    </div>
  );
}
