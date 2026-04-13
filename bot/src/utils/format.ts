/** Convert kopiykas to "1 199 грн" */
export function formatPrice(kopiykas: number): string {
  const uah = kopiykas / 100;
  const formatted = uah.toLocaleString('uk-UA', { maximumFractionDigits: 0 });
  return `${formatted} грн`;
}

/** Progress bar: "🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜ 30%" */
export function progressBar(completed: number, total: number, length = 10): string {
  if (total === 0) return '⬜'.repeat(length);
  const filled = Math.round((completed / total) * length);
  const empty = length - filled;
  const pct = Math.round((completed / total) * 100);
  return '🟩'.repeat(filled) + '⬜'.repeat(empty) + ` ${pct}%`;
}
