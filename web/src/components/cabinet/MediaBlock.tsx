import { site } from '@/config/site';
import type { MediaItem } from '@/lib/cabinet-types';
import { t } from '@/lib/cabinet-strings';
import { buttonClass } from './ui';

/**
 * How a lessons.media entry can be delivered on the web:
 *  - 'bunny'    → Bunny Stream video (Phase 4: signed embed URL from the media-url function)
 *  - 'file'     → Supabase Storage audio/document (Phase 4: signed URL from media-url)
 *  - 'url'      → external link already stored in the item
 *  - 'telegram' → only a Telegram file_id exists; point the user to the bot
 * Until Phase 4 ships, 'bunny' and 'file' render the same placeholder as 'telegram'.
 */
export function mediaKind(item: MediaItem): 'bunny' | 'file' | 'url' | 'telegram' {
  if (item.bunny_video_id) return 'bunny';
  if (item.storage_path) return 'file';
  if (item.url) return 'url';
  return 'telegram';
}

const ICONS = { video: '🎬', audio: '🎧', document: '📄' } as const;

type Props = { item: MediaItem; lessonId: string; ordinal: number };

export default function MediaBlock({ item, lessonId, ordinal }: Props) {
  const typeLabel = t.lesson[item.type] ?? t.lesson.document;
  const title = item.title ?? `${typeLabel} ${ordinal}`;
  const kind = mediaKind(item);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:flex-row sm:items-center">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-plum-deep text-xl" aria-hidden="true">
        {ICONS[item.type] ?? '📄'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        {kind !== 'url' && <div className="mt-1 text-sm text-ink-muted">{t.lesson.inBot}</div>}
      </div>
      {kind === 'url' ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}>
          Дивитись
        </a>
      ) : (
        <a
          href={`${site.bot.url}?start=lesson_${lessonId}`}
          target="_blank"
          rel="noopener"
          className={buttonClass('outline', 'sm')}
        >
          {t.lesson.openInBot}
        </a>
      )}
    </div>
  );
}
