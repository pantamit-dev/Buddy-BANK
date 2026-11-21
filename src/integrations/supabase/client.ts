import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/shared/types/database.types";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock_anon_key";

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
