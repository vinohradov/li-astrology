/** Row shapes the cabinet reads through RLS. Mirrors supabase tables (see docs in
 *  .claude/dosc/CABINET_IMPLEMENTATION_PLAN.md §0). */

export type MediaType = 'video' | 'audio' | 'document';

/** One entry of lessons.media. The bot uses file_id; the cabinet uses the hosted fields
 *  once Phase 4 fills them. Addressed by (lesson_id, index in the array). */
export type MediaItem = {
  type: MediaType;
  file_id?: string;
  url?: string;
  title?: string;
  bunny_video_id?: string;
  storage_path?: string;
  size_bytes?: number;
  duration_s?: number;
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  /** Kopiykas (119900 = 1199 UAH). */
  price_uah: number;
  sort_order: number;
  is_active: boolean;
  intro_html: string | null;
};

export type LessonOutline = {
  id: string;
  course_id: string;
  position: number;
  title: string;
  content_type: string;
  compact: boolean;
  material: boolean;
  is_free_preview: boolean;
};

export type Lesson = LessonOutline & {
  text_html: string | null;
  media: MediaItem[] | null;
};

export type Progress = {
  lesson_id: string;
  completed: boolean;
  opened_at: string | null;
  completed_at: string | null;
};

export type Me = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  lang: string | null;
};
