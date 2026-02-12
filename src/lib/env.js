export function getEnv(name, fallback = "") {
  const v = import.meta.env[name];
  if (v === undefined || v === null || v === "") return fallback;
  return v;
}

export const SUPABASE_URL = getEnv("VITE_SUPABASE_URL", "");
export const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY", "");
export const SITE_URL = getEnv("VITE_SITE_URL", "");
