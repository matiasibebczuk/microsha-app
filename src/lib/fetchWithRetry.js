const RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000];

export async function fetchWithRetry(url, options = {}) {
  let lastError;
  const method = String(options?.method || "GET").toUpperCase();
  const isSafeMethod = method === "GET" || method === "HEAD";

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, options);

      // 502/503/504 = backend arrancando, reintenta
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      return res;
    } catch (err) {
      // TypeError (CORS / network) = backend durmiendo, reintenta
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  // Agotó todos los reintentos — si es GET, recarga la página
  if (isSafeMethod && typeof window !== "undefined") {
    window.location.reload();
    // Devuelve una promesa que nunca resuelve para no propagar el error
    return new Promise(() => {});
  }

  throw lastError ?? new Error("Failed to fetch after retries");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
