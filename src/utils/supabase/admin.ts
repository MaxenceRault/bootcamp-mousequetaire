import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";

export const createAdminClient = () => {
  const { supabaseUrl, supabaseSecretKey } = getConfig();
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
