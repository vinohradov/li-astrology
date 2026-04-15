import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { uk } from '../locales/uk.js';
import { getLessonsByCourse, getLessonById } from '../db/lessons.js';
import { getCompletedCount, getProgressForCourse, markLessonOpened, markLessonCompleted } from '../db/progress.js';
import { getCourseById } from '../db/courses.js';
import { hasAccess } from '../db/purchases.js';
import { paginate, addPaginationButtons } from '../utils/pagination.js';
import { progressBar } from '../utils/format.js';
import { cleanAndSend, sendTrackedMedia } from '../utils/chat.js';

export function registerLessonHandler(bot: Bot<BotContext>) {

  bot.callbackQuery(/^course:(.+?)(?::(\d+))?$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const courseId = ctx.match[1];
    const page = parseInt(ctx.match[2] ?? '1', 10);
    await showLessonList(ctx, courseId, page);
  });

  bot.callbackQuery(/^course_intro:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const courseId = ctx.match[1];
    const course = await getCourseById(courseId);
    if (!course) return;

    const introText = course.intro_html
      || `<b>${course.title}</b>\n\n${course.description ?? ''}`;

    await cleanAndSend(ctx, introText, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: new InlineKeyboard()
        .text('Почати навчання →', `course:${courseId}`)
        .row()
        .text(uk.common.back, 'my_courses'),
    });
  });

  bot.callbackQuery(/^lesson:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const lessonId = ctx.match[1];
    await showLesson(ctx, lessonId);
  });

  bot.callbackQuery(/^complete:(.+)$/, async (ctx) => {
    const lessonId = ctx.match[1];
    await markLessonCompleted(ctx.from.id, lessonId);
    await ctx.answerCallbackQuery({ text: '✅ Урок завершено!' });
    // Re-render without resending media
    await showLesson(ctx, lessonId, true);
  });

  bot.callbackQuery(/^next_lesson:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const lessonId = ctx.match[1];
    const lesson = await getLessonById(lessonId);
    if (!lesson) return;
    const lessons = await getLessonsByCourse(lesson.course_id);
    const nextIdx = lessons.findIndex(l => l.id === lessonId) + 1;
    if (nextIdx < lessons.length) await showLesson(ctx, lessons[nextIdx].id);
  });

  bot.callbackQuery(/^prev_lesson:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const lessonId = ctx.match[1];
    const lesson = await getLessonById(lessonId);
    if (!lesson) return;
    const lessons = await getLessonsByCourse(lesson.course_id);
    const prevIdx = lessons.findIndex(l => l.id === lessonId) - 1;
    if (prevIdx >= 0) await showLesson(ctx, lessons[prevIdx].id);
  });
}

async function showLessonList(ctx: BotContext, courseId: string, page: number) {
  const userId = ctx.from!.id;
  const course = await getCourseById(courseId);
  if (!course) return;

  if (!(await hasAccess(userId, courseId))) {
    await cleanAndSend(ctx, 'У вас немає доступу до цього курсу.', {
      reply_markup: new InlineKeyboard()
        .text(uk.catalog.details, `catalog_detail:${courseId}`)
        .row()
        .text(uk.common.home, 'home'),
    });
    return;
  }

  const allLessons = await getLessonsByCourse(courseId);
  const trackable = allLessons.filter(l => !l.material);
  const total = trackable.length;
  const completed = await getCompletedCount(userId, courseId);
  const progress = await getProgressForCourse(userId, courseId);

  const { items: pageLessons, totalPages } = paginate(allLessons, page);

  const keyboard = new InlineKeyboard();

  if (page === 1 && course.intro_html) {
    keyboard.text('ℹ️ Про курс', `course_intro:${courseId}`).row();
  }

  // Build buttons: compact lessons go 2 per row, full lessons get their own row
  let compactBuffer: typeof pageLessons = [];

  const flushCompact = () => {
    if (compactBuffer.length === 0) return;
    for (const lesson of compactBuffer) {
      const p = progress.get(lesson.id);
      const check = p?.completed ? '✅' : '';
      const label = `${check}${lesson.title}`;
      const truncated = label.length > 28 ? label.slice(0, 25) + '...' : label;
      keyboard.text(truncated, `lesson:${lesson.id}`);
    }
    keyboard.row();
    compactBuffer = [];
  };

  for (const lesson of pageLessons) {
    if (lesson.compact) {
      compactBuffer.push(lesson);
      if (compactBuffer.length >= 2) flushCompact();
    } else {
      flushCompact(); // flush any pending compact buttons first
      const p = progress.get(lesson.id);
      const isCompleted = p?.completed ?? false;

      // Skip the content-type icon when the title already starts with an emoji
      // (titles in course JSONs carry their own, more specific icon).
      const titleHasLeadingEmoji = /^\p{Extended_Pictographic}/u.test(lesson.title);
      const typeIcon = titleHasLeadingEmoji ? ''
        : lesson.content_type === 'video' ? '🎬 '
        : lesson.content_type === 'audio' ? '🎧 '
        : lesson.content_type === 'document' ? '📄 '
        : '📚 ';

      const checkmark = isCompleted ? '✅ ' : '';
      const label = `${checkmark}${typeIcon}${lesson.title}`;
      const truncated = label.length > 55 ? label.slice(0, 52) + '...' : label;
      keyboard.text(truncated, `lesson:${lesson.id}`).row();
    }
  }
  flushCompact(); // flush remaining

  addPaginationButtons(keyboard, page, totalPages, `course:${courseId}`);
  keyboard.text(uk.common.back, 'my_courses');

  const bar = progressBar(completed, total);
  const header = `<b>${course.title}</b>\n\n${bar} ${completed}/${total} уроків`;

  await cleanAndSend(ctx, header, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });
}

async function showLesson(ctx: BotContext, lessonId: string, skipMediaResend = false) {
  const userId = ctx.from!.id;
  const lesson = await getLessonById(lessonId);
  if (!lesson) return;

  await markLessonOpened(userId, lessonId);

  const allLessons = await getLessonsByCourse(lesson.course_id);
  const currentIdx = allLessons.findIndex(l => l.id === lessonId);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < allLessons.length - 1;

  const progress = await getProgressForCourse(userId, lesson.course_id);
  const isCompleted = progress.get(lessonId)?.completed ?? false;

  // Navigation keyboard
  const keyboard = new InlineKeyboard();

  // Materials don't need completion tracking — just "back" button
  if (!lesson.material) {
    if (!isCompleted) {
      keyboard.text('✅ Позначити як завершений', `complete:${lessonId}`).row();
    } else {
      keyboard.text('✅ Завершено', 'noop').row();
    }
  }

  const navRow: Array<{ text: string; data: string }> = [];
  if (!lesson.material) {
    if (hasPrev) navRow.push({ text: '◄ Попередній', data: `prev_lesson:${lessonId}` });
    if (hasNext) navRow.push({ text: 'Наступний ►', data: `next_lesson:${lessonId}` });
  }
  for (const btn of navRow) keyboard.text(btn.text, btn.data);
  if (navRow.length) keyboard.row();

  keyboard.text('📋 До списку уроків', `course:${lesson.course_id}`);

  // Build text
  let text = `<b>${lesson.title}</b>`;
  if (lesson.text_html?.trim()) text += `\n\n${lesson.text_html}`;

  const urlMedia = lesson.media?.filter(m => m.url) ?? [];
  for (const m of urlMedia) {
    text += `\n\n🎬 <a href="${m.url}">Дивитись відео</a>`;
  }

  const fileMedia = lesson.media?.filter(m => m.file_id) ?? [];

  if (skipMediaResend) {
    // Just update the navigation message text/buttons (media already visible)
    try {
      await ctx.editMessageText(text, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } catch {
      try {
        await ctx.editMessageText(text + '\u200b', {
          reply_markup: keyboard,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
      } catch {}
    }
    return;
  }

  // Full render: clean old, send navigation text, then media below it
  await cleanAndSend(ctx, text, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });

  // Send media files below the navigation message
  for (const m of fileMedia) {
    if (m.file_id) {
      await sendTrackedMedia(ctx, m.type as 'video' | 'audio' | 'document', m.file_id);
    }
  }
}
