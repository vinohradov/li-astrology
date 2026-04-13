import { supabase } from './client.js';

export interface UserCourse {
  id: string;
  user_id: number;
  course_id: string;
  purchased_at: string;
  expires_at: string | null;
  payment_id: string | null;
  amount_paid: number | null;
}

export async function getUserCourses(userId: number): Promise<UserCourse[]> {
  const { data } = await supabase
    .from('user_courses')
    .select('*')
    .eq('user_id', userId);

  return data ?? [];
}

export async function hasAccess(userId: number, courseId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_courses')
    .select('id, expires_at')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .single();

  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
}

export async function grantAccess(params: {
  userId: number;
  courseId: string;
  paymentId?: string;
  amountPaid?: number;
}) {
  const { error } = await supabase
    .from('user_courses')
    .upsert(
      {
        user_id: params.userId,
        course_id: params.courseId,
        payment_id: params.paymentId ?? null,
        amount_paid: params.amountPaid ?? null,
        purchased_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_id' }
    );

  if (error) console.error('grantAccess error:', error);
}
