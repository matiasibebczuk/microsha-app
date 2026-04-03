const SESSION_STORAGE_KEY = "microsha-session-window";
export const SESSION_WINDOW_MS = 10 * 60 * 1000;

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

  const next = {
    ...payload,
    expiresAt: Date.now() + SESSION_WINDOW_MS,
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
