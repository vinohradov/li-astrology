import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { getActiveCourses, getCourseById } from '../db/courses.js';
import { hasAccess } from '../db/purchases.js';
import { getLessonCount } from '../db/lessons.js';
import { formatPrice } from '../utils/format.js';
import { cleanAndSend } from '../utils/chat.js';

// Maps a course slug to its marketing landing page on li-astrology.com.ua.
// Courses without a public page (e.g. upcoming ones) are omitted so the
// "Про курс" button is hidden for them.
const COURSE_LANDING_URL: Record<string, string> = {
  intensiv: 'https://li-astrology.com.ua/intensiv/',
  'aspekty-basic': 'https://li-astrology.com.ua/aspekty/',
  'aspekty-pro': 'https://li-astrology.com.ua/aspekty/',
};

export function registerCatalogHandler(bot: Bot<BotContext>) {
  bot.callbackQuery('catalog', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    const courses = await getActiveCourses();

    const keyboard = new InlineKeyboard();

    for (const course of courses) {
      const owned = await hasAccess(userId, course.id);
      const price = formatPrice(course.price_uah);
      const label = owned
        ? `✅ ${course.title}`
        : `${course.title} — ${price}`;

      keyboard.text(label, `catalog_detail:${course.id}`).row();
    }

    keyboard.text(ctx.t.common.home, 'home');

    await cleanAndSend(ctx, ctx.t.catalog.title, {
      reply_markup: keyboard,
    });
  });

  bot.callbackQuery(/^catalog_detail:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const courseId = ctx.match[1];
    const userId = ctx.from.id;

    const course = await getCourseById(courseId);
    if (!course) return;

    const lessonCount = await getLessonCount(courseId);
    const owned = await hasAccess(userId, courseId);
    const price = formatPrice(course.price_uah);

    let text = `<b>${course.title}</b>\n\n`;
    if (course.description) text += `${course.description}\n\n`;
    if (lessonCount > 0) text += `${ctx.t.catalog.lessonsCount(lessonCount)}\n`;
    text += `${ctx.t.catalog.priceLabel} ${price}`;

    const keyboard = new InlineKeyboard();

    if (owned) {
      keyboard.text(ctx.t.catalog.goToCourse, `course:${courseId}`).row();
      keyboard.text(`✅ ${ctx.t.catalog.owned}`, 'noop').row();
    } else {
      keyboard.text(ctx.t.catalog.buy(price), `buy:${courseId}`).row();
      const landingUrl = COURSE_LANDING_URL[course.slug];
      if (landingUrl) {
        keyboard.url(ctx.t.catalog.aboutOnSite, landingUrl).row();
      }
      keyboard.text(ctx.t.catalog.promoCode, `promo:${courseId}`).row();
    }

    keyboard.text(ctx.t.common.back, 'catalog');

    await cleanAndSend(ctx, text, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  });
}
