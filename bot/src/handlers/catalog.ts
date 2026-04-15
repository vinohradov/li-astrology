import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { uk } from '../locales/uk.js';
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

    keyboard.text(uk.common.home, 'home');

    await cleanAndSend(ctx, uk.catalog.title, {
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
    if (lessonCount > 0) text += `Уроків: ${lessonCount}\n`;
    text += `Ціна: ${price}`;

    const keyboard = new InlineKeyboard();

    if (owned) {
      keyboard.text(uk.catalog.goToCourse, `course:${courseId}`).row();
      keyboard.text(`✅ ${uk.catalog.owned}`, 'noop').row();
    } else {
      keyboard.text(uk.catalog.buy(price), `buy:${courseId}`).row();
      const landingUrl = COURSE_LANDING_URL[course.slug];
      if (landingUrl) {
        keyboard.url('ℹ️ Про курс (на сайті)', landingUrl).row();
      }
      keyboard.text(uk.catalog.promoCode, `promo:${courseId}`).row();
    }

    keyboard.text(uk.common.back, 'catalog');

    await cleanAndSend(ctx, text, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  });
}
