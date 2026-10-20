import { useEffect, useState } from 'react';
import { site } from '@/config/site';
import { getMediaUrl } from '@/lib/cabinet-api';
import type { MediaItem } from '@/lib/cabinet-types';
import { t } from '@/lib/cabinet-strings';
import { Spinner, buttonClass } from './ui';

/**
 * How a lessons.media entry can be delivered on the web:
 *  - 'bunny'    → Bunny Stream video, played here through a signed embed URL from media-url
 *  - 'file'     → hosted audio/document, played/opened through a signed URL from media-url
 *  - 'url'      → external link already stored in the item
 *  - 'telegram' → only a Telegram file_id exists; point the user to the bot
 */
export function mediaKind(item: MediaItem): 'bunny' | 'file' | 'url' | 'telegram' {
  if (item.bunny_video_id) return 'bunny';
  if (item.storage_path) return 'file';
  if (item.url) return 'url';
  return 'telegram';
}

const ICONS = { video: '🎬', audio: '🎧', document: '📄' } as const;

type Props = { item: MediaItem; lessonId: string; index: number; ordinal: number };

export default function MediaBlock({ item, lessonId, index, ordinal }: Props) {
  const typeLabel = t.lesson[item.type] ?? t.lesson.document;
  const title = item.title ?? `${typeLabel} ${ordinal}`;
  const minutes = item.duration_s ? Math.round(item.duration_s / 60) : 0;
  const duration = minutes ? (
    <span className="ml-2 whitespace-nowrap text-xs font-normal text-ink-muted">{t.lesson.minutes(minutes)}</span>
  ) : null;
  const kind = mediaKind(item);
  const hosted = kind === 'bunny' || kind === 'file';

  // undefined = still asking for the signed URL; null = not available here → bot card.
  const [signedUrl, setSignedUrl] = useState<string | null | undefined>(hosted ? undefined : null);

  useEffect(() => {
    if (!hosted) return;
    let cancelled = false;
    getMediaUrl(lessonId, index)
      .catch(() => null)
      .then((url) => {
        if (!cancelled) setSignedUrl(url);
      });
    return () => {
      cancelled = true;
    };
  }, [hosted, lessonId, index]);

  if (kind === 'bunny' && signedUrl !== null) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-ink/10 bg-cream">
        <div className="aspect-video bg-plum-deep">
          {signedUrl ? (
            <iframe
              src={signedUrl}
              title={title}
              loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          )}
        </div>
        <figcaption className="px-5 py-3 text-sm font-medium">{title}{duration}</figcaption>
      </figure>
    );
  }

  const icon = (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-plum-deep text-xl" aria-hidden="true">
      {ICONS[item.type] ?? '📄'}
    </div>
  );

  if (kind === 'file' && signedUrl !== null) {
    if (item.type === 'audio') {
      return (
        <div className="rounded-2xl border border-ink/10 bg-cream p-5">
          <div className="flex items-center gap-4">
            {icon}
            <div className="min-w-0 flex-1 font-medium">{title}{duration}</div>
          </div>
          {signedUrl ? (
            <audio controls preload="none" src={signedUrl} className="mt-4 w-full" />
          ) : (
            <div className="mt-4 text-sm text-ink-muted">{t.common.loading}</div>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:flex-row sm:items-center">
        {icon}
        <div className="min-w-0 flex-1 font-medium">{title}{duration}</div>
        {signedUrl ? (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}>
            {t.lesson.openFile}
          </a>
        ) : (
          <span className="text-sm text-ink-muted">{t.common.loading}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:flex-row sm:items-center">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}{duration}</div>
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
