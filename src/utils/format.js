export function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function formatTimeLabel(value) {
  if (!value) return "-";
  const asText = String(value);
  const hhmm = asText.match(/^(\d{1,2}:\d{2})/);
  if (hhmm) {
    const [h, m] = hhmm[1].split(":");
    return `${String(Number(h)).padStart(2, "0")}:${m}`;
  }

  const parsed = new Date(asText);
  if (!Number.isNaN(parsed.getTime())) {
    const hh = String(parsed.getHours()).padStart(2, "0");
    const mm = String(parsed.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return "-";
}

export function formatTripTitle(name, startTime, fallbackId = null) {
  const fallback = fallbackId !== null && fallbackId !== undefined ? `Traslado ${fallbackId}` : "Traslado";
  const rawBase = String(name || fallback).trim();
  const base = rawBase.replace(/\s-\s\d{1,2}:\d{2}$/i, "").trim() || fallback;
  const time = formatTimeLabel(startTime);
  if (!time || time === "-") return base;
  return `${base} - ${time}`;
}

export function formatTripStatus(status) {
  return status === "open" ? "🟢 Abierto" : "🔴 Cerrado";
}

export function formatOccupancy(confirmed, capacity) {
  if (!capacity || capacity <= 0) return 0;
  return Math.round(((confirmed || 0) / capacity) * 100);
}
