// Supabase Dashboard → Project Settings → API dəyərləri.
// Yalnız public anon/publishable açarı yazın. service_role açarını heç vaxt bura qoymayın.
// index.html və admin.html bu faylı import edir, ona görə dəyərləri yalnız burada dəyişmək kifayətdir.
export const SUPABASE_URL = 'https://osivyhfeoqkjhkdwbpuv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_ulAwP2lNqi8TvXCx4vXjNA_ZIJqcmyG';
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
