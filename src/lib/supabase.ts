import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function getConfigurationError(): string | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y completa los valores de tu proyecto Supabase.';
  }

  try {
    const url = new URL(supabaseUrl);
    const isHttps = url.protocol === 'https:';
    const isLocalHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if (!isHttps && !isLocalHttp) {
      return 'VITE_SUPABASE_URL debe usar HTTPS (se permite HTTP únicamente en localhost).';
    }
  } catch {
    return 'VITE_SUPABASE_URL no es una URL válida.';
  }

  return null;
}

export const supabaseConfigurationError = getConfigurationError();

export const supabase = supabaseConfigurationError === null && supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;
