import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://sbzrihvdhjvarhyloqps.supabase.co";
const fallbackSupabaseAnonKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNienJpaHZkaGp2YXJoeWxvcXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MTQwNTYsImV4cCI6MjA4NjI5MDA1Nn0.okkqKa7clClyUl4baLe8zyDJ0Tqr8zSmiwdu2fUiSoE";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
	console.warn(
		"Missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY. Using fallback public Supabase config."
	);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
