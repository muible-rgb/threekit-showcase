import { LocalStore } from "./local-store";
import { SupabaseStore } from "./supabase-store";
import type { DataStore } from "./types";

let cached: DataStore | null = null;

/**
 * One store per browser session. Falls back to local-only when no Supabase
 * project is configured, which is the default for a fresh checkout and is what
 * makes the demo dataset render every screen with no setup at all.
 */
export function getStore(): DataStore {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  cached = url && key ? new SupabaseStore(url, key) : new LocalStore();
  return cached;
}

export * from "./types";
export { LocalStore } from "./local-store";
