import { useCallback } from "react";
import { supabase } from "../supabase";

export function useSessionToken() {
  return useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }, []);
}
