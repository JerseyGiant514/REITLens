import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Support both Node.js (process.env) and Vite (import.meta.env) environments
const getEnvVar = (key: string): string => {
  // Try import.meta.env first (Vite/browser)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = (import.meta.env[key] as string) || '';
    if (val) return val;
  }
  // Fallback to process.env (Node.js / dotenv)
  return process.env[key] || '';
};

// Lazy-initialized singleton to ensure dotenv.config() has run in Node scripts
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

  _supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient('https://placeholder.supabase.co', 'placeholder');

  return _supabase;
}

// Export as a proxy that lazily initializes on first property access
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  }
});
