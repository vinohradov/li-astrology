import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { uk } from '../locales/uk.js';
import { getUserCourses } from '../db/purchases.js';
import { getCourseById } from '../db/courses.js';
import { getLessonCount } from '../db/lessons.js';
import { getCompletedCount } from '../db/progress.js';
import { progressBar } from '../utils/format.js';
import { cleanAndSend } from '../utils/chat.js';

export function registerMyCoursesHandler(bot: Bot<BotContext>) {
  bot.callbackQuery('my_courses', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;

    const userCourses = await getUserCourses(userId);

    if (userCourses.length === 0) {
      await cleanAndSend(ctx, uk.myCourses.empty, {
        reply_markup: new InlineKeyboard()
          .text(uk.myCourses.toCatalog, 'catalog')
          .row()
          .text(uk.common.home, 'home'),
      });
      return;
    }

    const keyboard = new InlineKeyboard();
    const lines: string[] = ['Мої курси:\n'];

    for (const uc of userCourses) {
      const course = await getCourseById(uc.course_id);
      if (!course) continue;

      const total = await getLessonCount(course.id);
      const completed = await getCompletedCount(userId, course.id);
      const bar = progressBar(completed, total);

      lines.push(`${course.title}`);
      lines.push(`${bar} ${uk.myCourses.progress(completed, total)}\n`);

      const label = completed > 0 && completed < total
        ? `Продовжити: ${course.title}`
        : course.title;

      keyboard.text(label, `course:${course.id}`).row();
    }

    keyboard.text(uk.common.home, 'home');

    await cleanAndSend(ctx, lines.join('\n'), {
      reply_markup: keyboard,
    });
  });
}
