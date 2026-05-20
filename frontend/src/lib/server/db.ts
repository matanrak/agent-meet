import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var supabaseAdmin: SupabaseClient | undefined;
}

export function getAdmin(): SupabaseClient {
  if (!globalThis.supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required"
      );
    }
    globalThis.supabaseAdmin = createClient(url, key);
  }
  return globalThis.supabaseAdmin;
}
