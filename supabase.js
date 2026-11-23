import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.ELFA_CONFIG || {};
export const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes('YOUR_PROJECT'));
export const supabase = configured ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

export function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
