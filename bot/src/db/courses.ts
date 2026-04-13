import { supabase } from './client.js';

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price_uah: number;
  sort_order: number;
  is_active: boolean;
  intro_html: string | null;
}

export async function getActiveCourses(): Promise<Course[]> {
  const { data } = await supabase
    .from('courses')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  return data ?? [];
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const { data } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .single();

  return data;
}

export async function getCourseById(id: string): Promise<Course | null> {
  const { data } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();

  return data;
}
