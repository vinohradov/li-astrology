import { supabase } from './client.js';

export interface Lesson {
  id: string;
  course_id: string;
  position: number;
  title: string;
  content_type: string;
  text_html: string | null;
  media: Array<{ type: string; file_id?: string; url?: string }>;
  tg_message_id: number | null;
  is_free_preview: boolean;
  compact: boolean;
  material: boolean;
}

export async function getLessonsByCourse(courseId: string): Promise<Lesson[]> {
  const { data } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('position');

  return data ?? [];
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  const { data } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', id)
    .single();

  return data;
}

export async function getLessonCount(courseId: string): Promise<number> {
  const { count } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);

  return count ?? 0;
}
