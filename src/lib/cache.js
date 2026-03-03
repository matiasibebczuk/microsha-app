const memoryCache = new Map();

export function getCached(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

export function setCached(key, value, ttlMs = 30_000) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

export async function getOrSetCached(key, loader, ttlMs = 30_000) {
  const cached = getCached(key);
  if (cached !== null) {
    return cached;
  }

  const loaded = await loader();
  return setCached(key, loaded, ttlMs);
}

export function clearCached(prefix = "") {
  if (!prefix) {
    memoryCache.clear();
    return;
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}
