import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSafeClawBrowserSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { detectSessionInUrl: false }
  });
}
