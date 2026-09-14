/**
 * Convert the Telegram-HTML stored in lessons.text_html / courses.intro_html into
 * web HTML. Telegram uses literal "\n" for line breaks and a small tag set; anything
 * outside the allowlist is escaped so stored content can never inject markup.
 * (Live content uses only <b> and <i> as of 2026-09-14.)
 */
const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'pre', 'blockquote']);

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function tgHtmlToWeb(src: string | null | undefined): string {
  if (!src) return '';
  const html = src.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (match, slash, rawTag, attrs) => {
    const tag = String(rawTag).toLowerCase();
    const closing = slash === '/';
    if (tag === 'tg-spoiler') return closing ? '</span>' : '<span class="tg-spoiler">';
    if (tag === 'a') {
      if (closing) return '</a>';
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '';
      return /^(https?:|tg:|mailto:)/i.test(href)
        ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">`
        : '<a>';
    }
    if (ALLOWED.has(tag)) return closing ? `</${tag}>` : `<${tag}>`;
    return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
  return html.replace(/\r?\n/g, '<br>');
}
