import { createClient } from '@supabase/supabase-js';
import { site } from '@/config/site';

/**
 * Browser Supabase client for the cabinet. Uses the public anon key; all data
 * access is enforced by RLS (supabase/migrations/0004_cabinet_auth.sql).
 * Only import from client-side code (React islands with client:only).
 */
export const supabase = createClient(site.supabase.url, site.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const functionsUrl = `${site.supabase.url}/functions/v1`;
