import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authDebug = String(import.meta.env.VITE_DEBUG_AUTH || "").toLowerCase() === "true";

function maskValue(value, keep = 6) {
	const text = String(value || "");
	if (text.length <= keep) return text;
	return `${text.slice(0, keep)}...`;
}

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.");
}

export const SUPABASE_CONFIG = {
	url: supabaseUrl,
	anonKey: supabaseAnonKey,
};

if (authDebug) {
	console.info("[supabase] init", {
		urlHost: (() => {
			try {
				return new URL(supabaseUrl).host;
			} catch {
				return "invalid-url";
			}
		})(),
		anonKeyPrefix: maskValue(supabaseAnonKey),
	});
}

const wrappedFetch = async (input, init) => {
	try {
		return await fetch(input, init);
	} catch (error) {
		console.error("[supabase] network error", {
			message: error?.message || "unknown",
			url: typeof input === "string" ? input : input?.url,
		});
		throw error;
	}
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
		storageKey: "microsha-auth",
	},
	global: {
		fetch: wrappedFetch,
	},
});
