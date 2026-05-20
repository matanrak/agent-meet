import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Minimal generic schema so supabase-js accepts arbitrary table/function names
// without generated DB types.  Matches the internal GenericSchema shape.
type FlexibleSchema = {
  Tables: Record<
    string,
    {
      Row: Record<string, unknown>;
      Insert: Record<string, unknown>;
      Update: Record<string, unknown>;
      Relationships: never[];
    }
  >;
  Views: Record<string, never>;
  Functions: Record<
    string,
    { Args: Record<string, unknown>; Returns: unknown }
  >;
};

type AppDb = { app: FlexibleSchema };
type AppClient = SupabaseClient<AppDb>;

declare global {
  var supabaseAdmin: AppClient | undefined;
}

export function getAdmin(): AppClient {
  if (!globalThis.supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required"
      );
    }
    globalThis.supabaseAdmin = createClient<AppDb>(url, key);
  }
  return globalThis.supabaseAdmin;
}

export async function ensureSchema(): Promise<void> {
  const { error } = await getAdmin().rpc("ensure_schema");
  if (error) throw new Error(error.message);
}
