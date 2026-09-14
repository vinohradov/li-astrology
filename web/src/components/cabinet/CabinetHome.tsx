import { useEffect, useState } from 'react';
import { products, site, type ProductSlug } from '@/config/site';
import {
  claimOrder,
  courseStats,
  getMe,
  getMyProgress,
  getOutline,
  listCourses,
  listOwnedCourseIds,
} from '@/lib/cabinet-api';
import type { Course, LessonOutline, Me, Progress } from '@/lib/cabinet-types';
import { t } from '@/lib/cabinet-strings';
import { createInvoice, trackCheckout } from '@/lib/checkout';
import CabinetShell, { type CabinetCtx } from './CabinetShell';
import { Notice, ProgressBar, Spinner, buttonClass } from './ui';

export default function CabinetHome() {
  // Set by /payment/success/ → «Відкрити кабінет»: /cabinet/?claim=<order_id>
  const [claimId] = useState(() => new URLSearchParams(window.location.search).get('claim'));
  return (
    <CabinetShell active="courses" loginHint={claimId ? t.login.claimHint(claimId) : undefined}>
      {(ctx) => <Home {...ctx} claimId={claimId} />}
    </CabinetShell>
  );
}

type Data = {
  me: Me | null;
  courses: Course[];
  owned: Set<string>;
  outline: LessonOutline[];
  progress: Map<string, Progress>;
};

export function courseTitle(course: Pick<Course, 'slug' | 'title'>): string {
  return products[course.slug as ProductSlug]?.title ?? course.title;
}

export function formatPrice(kopiykas: number): string {
  return `${Math.round(kopiykas / 100).toLocaleString('uk-UA')} грн`;
}

function Home({ telegramId, claimId }: CabinetCtx & { claimId: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyError, setBuyError] = useState(false);

  useEffect(() => {
    Promise.all([getMe(telegramId), listCourses(), listOwnedCourseIds(), getOutline(), getMyProgress()])
      .then(([me, courses, owned, outline, progress]) => setData({ me, courses, owned, outline, progress }))
      .catch((e) => {
        console.error('cabinet home load failed', e);
        setError(true);
      });
  }, [telegramId, reload]);

  const buy = async (slug: string) => {
    setBuying(slug);
    setBuyError(false);
    trackCheckout(slug);
    try {
      window.location.href = await createInvoice({ slug, telegramUserId: telegramId });
    } catch (e) {
      console.error('cabinet buy failed', e);
      setBuyError(true);
      setBuying(null);
    }
  };

  const claim = claimId ? <ClaimBanner orderId={claimId} onGranted={() => setReload((r) => r + 1)} /> : null;

  if (error) return <div className="space-y-6">{claim}<Notice tone="error">{t.home.loadError}</Notice></div>;
  if (!data) return <div className="space-y-6">{claim}<Spinner label={t.common.loading} /></div>;

  const mine = data.courses.filter((c) => data.owned.has(c.id));
  const others = data.courses.filter((c) => !data.owned.has(c.id));

  return (
    <div className="space-y-14">
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-deep">Кабінет</p>
          <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
            Вітаю{data.me?.first_name ? `, ${data.me.first_name}` : ''} ✦
          </h1>
        </div>
        {claim}
      </div>

      <section>
        <h2 className="mb-6 font-display text-2xl">{t.home.myCourses}</h2>
        {mine.length === 0 ? (
          <Notice>{t.home.empty}</Notice>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {mine.map((course) => {
              const outline = data.outline.filter((l) => l.course_id === course.id);
              const stats = courseStats(outline, data.progress);
              const courseHref = `/cabinet/course/?slug=${encodeURIComponent(course.slug)}`;
              return (
                <article key={course.id} className="overflow-hidden rounded-3xl border border-ink/10 bg-cream shadow-[0_24px_48px_-32px_rgba(11,10,18,0.4)]">
                  <a href={courseHref} className="block aspect-[16/9] overflow-hidden bg-plum-deep">
                    <img src={`/images/courses/${course.slug}.jpg`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                  </a>
                  <div className="space-y-5 p-6">
                    <h3 className="font-display text-xl leading-snug">{courseTitle(course)}</h3>
                    <ProgressBar completed={stats.completed} total={stats.total} label={t.home.progress(stats.completed, stats.total)} />
                    <div className="flex flex-wrap gap-3">
                      {stats.nextLessonId && (
                        <a href={`/cabinet/lesson/?id=${stats.nextLessonId}`} className={buttonClass('primary')}>
                          {stats.completed > 0 ? t.home.continue : t.home.start}
                        </a>
                      )}
                      <a href={courseHref} className={buttonClass('outline')}>
                        {t.home.open}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="mb-6 font-display text-2xl">{t.home.otherCourses}</h2>
          {buyError && (
            <div className="mb-5">
              <Notice tone="error">{t.home.buyError}</Notice>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((course) => {
              const product = products[course.slug as ProductSlug];
              return (
                <article key={course.id} className="flex flex-col overflow-hidden rounded-3xl border border-ink/10 bg-cream">
                  <div className="aspect-[16/10] overflow-hidden bg-plum-deep">
                    <img src={`/images/courses/${course.slug}.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90" />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <h3 className="font-display text-lg leading-snug">{courseTitle(course)}</h3>
                    {product?.tagline && <p className="text-sm leading-relaxed text-ink-muted">{product.tagline}</p>}
                    <div className="font-display text-lg text-gold-deep">{formatPrice(course.price_uah)}</div>
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => buy(course.slug)}
                        disabled={buying !== null}
                        className={buttonClass('primary', 'sm')}
                      >
                        {buying === course.slug ? t.home.processing : t.home.buy}
                      </button>
                      <a href={`/cabinet/course/?slug=${encodeURIComponent(course.slug)}`} className={buttonClass('outline', 'sm')}>
                        {t.home.program}
                      </a>
                      {product?.href && (
                        <a href={product.href} className={buttonClass('ghost', 'sm')}>
                          {t.home.details}
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

type ClaimState = 'checking' | 'pending' | 'granted' | 'failed' | 'claimed_by_other' | 'not_found' | 'timeout' | 'error';

const CLAIM_POLL_MS = 5000;
const CLAIM_TIMEOUT_MS = 3 * 60 * 1000;

/** Activates a web order for the logged-in user; polls while the bank hasn't confirmed it. */
function ClaimBanner({ orderId, onGranted }: { orderId: string; onGranted: () => void }) {
  const [state, setState] = useState<ClaimState>('checking');
  const [title, setTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    const clearParams = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('claim');
      url.searchParams.delete('product');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    };

    const run = async () => {
      try {
        const res = await claimOrder(orderId);
        if (cancelled) return;
        if (res.status === 'pending') {
          if (Date.now() - startedAt > CLAIM_TIMEOUT_MS) return setState('timeout');
          setState('pending');
          timer = window.setTimeout(run, CLAIM_POLL_MS);
          return;
        }
        if (res.status === 'granted') {
          setTitle(courseTitle({ slug: res.course_slug, title: res.course_title }));
          window.gtag?.('event', 'claim_order', { course_slug: res.course_slug });
          onGranted();
        }
        setState(res.status);
        if (res.status !== 'error') clearParams();
      } catch (e) {
        console.error('claim-order failed', e);
        if (!cancelled) setState('error');
      }
    };

    run();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId]);

  switch (state) {
    case 'checking':
      return <Notice>{t.claim.checking}</Notice>;
    case 'pending':
      return <Notice>{t.claim.pending}</Notice>;
    case 'granted':
      return <Notice tone="success">{t.claim.granted(title)}</Notice>;
    case 'failed':
      return <Notice tone="error">{t.claim.failed}</Notice>;
    case 'claimed_by_other':
      return <Notice tone="error">{t.claim.claimedByOther}</Notice>;
    case 'not_found':
      return <Notice tone="error">{t.claim.notFound(site.contact.email)}</Notice>;
    case 'timeout':
      return <Notice tone="error">{t.claim.timeout(site.contact.email)}</Notice>;
    default:
      return <Notice tone="error">{t.claim.error}</Notice>;
  }
}
