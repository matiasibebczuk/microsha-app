import { supabase, SUPABASE_CONFIG } from "../supabase";

const AUTH_TIMEOUT_MS = 10000;
const AUTH_MAX_ATTEMPTS = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function isRetryableAuthError(error) {
  const text = String(error?.message || "").toLowerCase();
  return (
    text.includes("timeout") ||
    text.includes("network") ||
    text.includes("failed to fetch") ||
    text.includes("fetch")
  );
}

function mapAuthErrorMessage(error) {
  const text = String(error?.message || "").toLowerCase();

  if (text.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (text.includes("email not confirmed") || text.includes("confirm")) {
    return "Tenés que confirmar tu correo antes de iniciar sesión.";
  }
  if (text.includes("timeout") || text.includes("failed to fetch") || text.includes("network")) {
    return "No se pudo conectar con Supabase. Revisá internet, CORS y variables de entorno.";
  }

  return error?.message || "No se pudo iniciar sesión";
}

export async function probeSupabaseConnection() {
  const authSettingsUrl = `${SUPABASE_CONFIG.url.replace(/\/$/, "")}/auth/v1/settings`;

  try {
    const res = await withTimeout(
      fetch(authSettingsUrl, {
        method: "GET",
        headers: {
          apikey: SUPABASE_CONFIG.anonKey,
        },
      }),
      6000,
      "Supabase auth settings"
    );

    return {
      ok: res.ok,
      status: res.status,
      endpoint: authSettingsUrl,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      endpoint: authSettingsUrl,
      error: String(error?.message || error),
    };
  }
}

export async function signInStaff({ email, password }) {
  let lastError = null;

  for (let attempt = 1; attempt <= AUTH_MAX_ATTEMPTS; attempt += 1) {
    try {
      console.info("[auth] signIn attempt", {
        attempt,
        maxAttempts: AUTH_MAX_ATTEMPTS,
        emailDomain: String(email || "").split("@")[1] || "",
      });

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: String(email || "").trim(),
          password,
        }),
        AUTH_TIMEOUT_MS,
        "Supabase signIn"
      );

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      lastError = error;
      console.error("[auth] signIn failed", {
        attempt,
        message: error?.message || "unknown",
      });

      if (!isRetryableAuthError(error) || attempt >= AUTH_MAX_ATTEMPTS) {
        break;
      }

      await sleep(500 * attempt);
    }
  }

  return {
    data: null,
    error: {
      raw: lastError,
      message: mapAuthErrorMessage(lastError),
      isRetryable: isRetryableAuthError(lastError),
    },
  };
}
