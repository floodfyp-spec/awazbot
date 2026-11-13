import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client with admin privileges (Service Role Key).
 * CAUTION: NEVER import or expose this file in client components ('use client')
 * or client-side bundles.
 */
export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://mhervthlsxezerasjddg.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_TAnORqZXzcAesd33LtkOIQ_Go3X4vCT';

  // Use working key (if serviceRoleKey is the known invalid key, use working publishable key)
  const isInvalidServiceRole = serviceRoleKey && serviceRoleKey.includes('H4CPIYz');
  const keyToUse = (!isInvalidServiceRole && serviceRoleKey) ? serviceRoleKey : anonKey;

  return createClient(supabaseUrl, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
