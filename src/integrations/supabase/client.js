import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_SUPABASE_URL) || 
  "https://hnihrwignetxwudoqntp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_SUPABASE_ANON_KEY) || 
  "sb_publishable_678TrTJni7pK0HsdsvpabA_foI6PaWh";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
