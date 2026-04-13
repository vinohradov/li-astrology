import { InlineKeyboard } from 'grammy';

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Мої курси', 'my_courses')
    .row()
    .text('Каталог курсів', 'catalog')
    .row()
    .text('Підтримка', 'support')
    .text('Налаштування', 'settings');
}
