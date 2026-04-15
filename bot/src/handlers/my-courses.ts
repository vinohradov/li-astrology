import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
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
      await cleanAndSend(ctx, ctx.t.myCourses.empty, {
        reply_markup: new InlineKeyboard()
          .text(ctx.t.myCourses.toCatalog, 'catalog')
          .row()
          .text(ctx.t.common.home, 'home'),
      });
      return;
    }

    const keyboard = new InlineKeyboard();
    const lines: string[] = [ctx.t.myCourses.header];

    for (const uc of userCourses) {
      const course = await getCourseById(uc.course_id);
      if (!course) continue;

      const total = await getLessonCount(course.id);
      const completed = await getCompletedCount(userId, course.id);
      const bar = progressBar(completed, total);

      lines.push(`${course.title}`);
      lines.push(`${bar} ${ctx.t.myCourses.progress(completed, total)}\n`);

      const label = completed > 0 && completed < total
        ? ctx.t.myCourses.continueCourse(course.title)
        : course.title;

      keyboard.text(label, `course:${course.id}`).row();
    }

    keyboard.text(ctx.t.common.home, 'home');

    await cleanAndSend(ctx, lines.join('\n'), {
      reply_markup: keyboard,
    });
  });
}
