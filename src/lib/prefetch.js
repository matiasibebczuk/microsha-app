import { apiUrl } from "../api";
import { getOrSetCached } from "./cache";

async function fetchJson(path, { headers = {}, signal } = {}) {
  const res = await fetch(apiUrl(path), {
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

export async function prewarmApi(signal) {
  try {
    await fetch(apiUrl("/ping"), {
      method: "GET",
      cache: "no-store",
      signal,
    });
  } catch {
    return;
  }
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
