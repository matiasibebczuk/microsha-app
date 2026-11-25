const RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000];

export async function fetchWithRetry(url, options = {}) {
  let lastError;
  const method = String(options?.method || "GET").toUpperCase();
  const isSafeMethod = method === "GET" || method === "HEAD";

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, options);

      // 502/503/504 = backend arrancando o sobrecargado, reintenta
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      // 429 = límite temporal alcanzado: en métodos seguros (GET) reintentar automáticamente
      if (res.status === 429 && isSafeMethod && attempt < RETRY_DELAYS_MS.length) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : null;
        const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(retryAfterSec * 1000, 10000)
          : RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * 1000);

        await delay(waitMs);
        continue;
      }

      return res;
    } catch (err) {
      // TypeError (CORS / network) = backend durmiendo o red caída, reintenta
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * 500));
      }
    }
  }

  throw lastError ?? new Error("Failed to fetch after retries");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
