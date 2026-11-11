import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a client-side Supabase client using the browser's cookies.
 * Safe for use in client components ('use client').
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
