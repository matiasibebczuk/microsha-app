import { apiUrl } from "../api";
import { getOrSetCached } from "./cache";
import { fetchWithRetry } from "./fetchWithRetry";

async function fetchJson(path, { headers = {}, signal } = {}) {
  const res = await fetchWithRetry(apiUrl(path), {
    method: "GET",
    cache: "no-store",
    headers,
    signal,
  });

  if (!res.ok) {
    throw new Error(`Prefetch failed: ${path}`);
  }

  return res.json();
}

const PREWARM_MAX_ATTEMPTS = 15;
const PREWARM_INTERVAL_MS = 4000;

export async function prewarmApi(signal, onAttempt) {
  for (let attempt = 1; attempt <= PREWARM_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) return false;
    try {
      const res = await fetch(apiUrl("/ping"), {
        method: "GET",
        cache: "no-store",
        signal,
      });
      if (res.ok) return true;
    } catch {
      // backend dormido o red caída — reintenta
    }
    onAttempt?.(attempt);
    if (attempt < PREWARM_MAX_ATTEMPTS) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, PREWARM_INTERVAL_MS);
        signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
      });
    }
  }
  return false;
}

export async function prefetchStaffData(role, token, signal) {
  if (!role || !token) return;

  const authHeaders = { Authorization: `Bearer ${token}` };
  const tasks = [
    getOrSetCached(
      `staff:trips:${role}`,
      () => fetchJson("/trips", { headers: authHeaders, signal }),
      20_000
    ),
  ];

  if (role === "admin") {
    tasks.push(
      getOrSetCached(
        "admin:history:page-1",
        () => fetchJson("/admin/history", { headers: authHeaders, signal }),
        20_000
      )
    );
  }

  await Promise.allSettled(tasks);
}

export async function prefetchPassengerData(passengerToken, signal) {
  if (!passengerToken) return;

  await Promise.allSettled([
    getOrSetCached(
      `passenger:trips:${passengerToken}`,
      () =>
        fetchJson("/trips", {
          headers: {
            "x-passenger-token": passengerToken,
          },
          signal,
        }),
      20_000
    ),
  ]);
}
