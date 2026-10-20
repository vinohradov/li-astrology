import { useEffect, useState } from 'react';
import { getLesson, getMyProgress, getOutline, listCourses, markCompleted, markOpened } from '@/lib/cabinet-api';
import type { Course, Lesson, LessonOutline } from '@/lib/cabinet-types';
import { t } from '@/lib/cabinet-strings';
import { tgHtmlToWeb } from '@/lib/tg-html';
import CabinetShell, { type CabinetCtx } from './CabinetShell';
import { courseTitle } from './CabinetHome';
import MediaBlock from './MediaBlock';
import { Notice, Spinner, buttonClass, lessonLabel } from './ui';

export default function LessonView() {
  return <CabinetShell active="courses">{(ctx) => <LessonPage {...ctx} />}</CabinetShell>;
}

type Data =
  | { state: 'ok'; lesson: Lesson; course: Course; siblings: LessonOutline[]; completed: boolean }
  | { state: 'locked'; course: Course | null }
  | { state: 'missing' };

function LessonPage({ telegramId }: CabinetCtx) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id') ?? '';
    (async () => {
      const [lesson, courses, outline] = await Promise.all([
        id ? getLesson(id) : Promise.resolve(null),
        listCourses(),
        getOutline(),
      ]);
      if (!lesson) {
        const known = outline.find((l) => l.id === id);
        if (!known) return setData({ state: 'missing' });
        return setData({ state: 'locked', course: courses.find((c) => c.id === known.course_id) ?? null });
      }
      const course = courses.find((c) => c.id === lesson.course_id);
      if (!course) return setData({ state: 'missing' });
      const progress = await getMyProgress();
      document.title = `${lesson.title} — ${courseTitle(course)}`;
      setData({
        state: 'ok',
        lesson,
        course,
        siblings: outline.filter((l) => l.course_id === course.id),
        completed: progress.get(lesson.id)?.completed ?? false,
      });
      markOpened(telegramId, lesson.id).catch((e) => console.error('markOpened failed', e));
    })().catch((e) => {
      console.error('lesson load failed', e);
      setError(true);
    });
  }, [telegramId]);

  if (error) return <Notice tone="error">{t.home.loadError}</Notice>;
  if (!data) return <Spinner label={t.common.loading} />;

  if (data.state !== 'ok') {
    const course = data.state === 'locked' ? data.course : null;
    return (
      <div className="space-y-6">
        <Notice tone="error">{data.state === 'locked' ? t.lesson.noAccess : t.lesson.notFound}</Notice>
        <a href={course ? `/cabinet/course/?slug=${encodeURIComponent(course.slug)}` : '/cabinet/'} className={buttonClass('outline')}>
          {course ? courseTitle(course) : t.nav.myCourses}
        </a>
      </div>
    );
  }

  const { lesson, course, siblings, completed } = data;
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const prev = !lesson.material && idx > 0 ? siblings[idx - 1] : null;
  const next = !lesson.material && idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const courseHref = `/cabinet/course/?slug=${encodeURIComponent(course.slug)}`;

  const counters: Record<string, number> = {};
  const media = (lesson.media ?? []).map((item, index) => {
    counters[item.type] = (counters[item.type] ?? 0) + 1;
    return { item, index, ordinal: counters[item.type] };
  });

  const complete = async () => {
    setSaving(true);
    try {
      await markCompleted(telegramId, lesson.id);
      setData({ ...data, completed: true });
      setToast(true);
      window.gtag?.('event', 'lesson_complete', { course_slug: course.slug, lesson_id: lesson.id });
      if (idx === siblings.length - 1 || siblings.slice(idx + 1).every((l) => l.material)) {
        window.gtag?.('event', 'course_complete', { course_slug: course.slug });
      }
    } catch (e) {
      console.error('markCompleted failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <nav className="text-sm text-ink-muted">
        <a href="/cabinet/" className="hover:text-ink">{t.nav.myCourses}</a>
        <span className="mx-2">/</span>
        <a href={courseHref} className="hover:text-ink">{courseTitle(course)}</a>
      </nav>

      <h1 className="font-display text-3xl leading-tight md:text-4xl">{lessonLabel(lesson.title, lesson.content_type)}</h1>

      {lesson.text_html?.trim() && (
        <div className="lesson-html" dangerouslySetInnerHTML={{ __html: tgHtmlToWeb(lesson.text_html) }} />
      )}

      {media.length > 0 && (
        <div className="space-y-3">
          {media.map(({ item, index, ordinal }) => (
            <MediaBlock key={index} item={item} lessonId={lesson.id} index={index} ordinal={ordinal} />
          ))}
        </div>
      )}

      <div className="space-y-4 border-t border-ink/10 pt-8">
        {toast && <Notice tone="success">{t.lesson.completedToast}</Notice>}
        {!lesson.material && (
          completed ? (
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">{t.lesson.completed}</div>
          ) : (
            <button type="button" onClick={complete} disabled={saving} className={buttonClass('primary')}>
              {t.lesson.markComplete}
            </button>
          )
        )}
        <div className="flex flex-wrap items-center gap-3">
          {prev && (
            <a href={`/cabinet/lesson/?id=${prev.id}`} className={buttonClass('outline', 'sm')}>{t.lesson.prev}</a>
          )}
          {next && (
            <a href={`/cabinet/lesson/?id=${next.id}`} className={buttonClass(completed ? 'dark' : 'outline', 'sm')}>{t.lesson.next}</a>
          )}
          <a href={courseHref} className={`${buttonClass('ghost', 'sm')} sm:ml-auto`}>{t.lesson.backToList}</a>
        </div>
      </div>
    </article>
  );
}
