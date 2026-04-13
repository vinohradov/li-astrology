import { InlineKeyboard } from 'grammy';

export const PAGE_SIZE = 14;

export function paginate<T>(items: T[], page: number): { items: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    totalPages,
  };
}

export function addPaginationButtons(
  keyboard: InlineKeyboard,
  currentPage: number,
  totalPages: number,
  callbackPrefix: string
) {
  if (totalPages <= 1) return;

  const row: Array<{ text: string; callback_data: string }> = [];

  if (currentPage > 1) {
    row.push({ text: '◄', callback_data: `${callbackPrefix}:${currentPage - 1}` });
  }

  row.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });

  if (currentPage < totalPages) {
    row.push({ text: '►', callback_data: `${callbackPrefix}:${currentPage + 1}` });
  }

  for (const btn of row) {
    keyboard.text(btn.text, btn.callback_data);
  }
  keyboard.row();
}
