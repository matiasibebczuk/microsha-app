const SESSION_STORAGE_KEY = "microsha-session-window";
export const SESSION_WINDOW_MS = 10 * 60 * 1000; // legacy, no usar directamente
export const SESSION_WINDOW_PASSENGER_MS = 30 * 60 * 1000;  // 30 min
export const SESSION_WINDOW_STAFF_MS = 90 * 60 * 1000;       // 90 min

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSessionWindow() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function saveSessionWindow(payload) {
  if (!canUseStorage()) return;

  const durationMs = payload.kind === "passenger"
    ? SESSION_WINDOW_PASSENGER_MS
    : SESSION_WINDOW_STAFF_MS;

  const next = {
    ...payload,
    expiresAt: Date.now() + durationMs,
  };

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
}

export function readSessionWindow() {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") {
    clearSessionWindow();
    return null;
  }

  const expiresAt = Number(parsed.expiresAt || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearSessionWindow();
    return null;
  }

  return parsed;
}

export function getSessionWindowRemainingMs() {
  const saved = readSessionWindow();
  if (!saved) return 0;
  return Math.max(0, Number(saved.expiresAt) - Date.now());
}
