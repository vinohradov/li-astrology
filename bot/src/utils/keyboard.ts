import { InlineKeyboard } from 'grammy';
import type { Locale } from '../locales/index.js';

export function mainMenuKeyboard(t: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text(t.menu.myCourses, 'my_courses')
    .row()
    .text(t.menu.catalog, 'catalog')
    .row()
    .text(t.menu.support, 'support')
    .text(t.menu.settings, 'settings');
}
