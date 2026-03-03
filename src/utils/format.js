export function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function formatTripStatus(status) {
  return status === "open" ? "🟢 Abierto" : "🔴 Cerrado";
}

export function formatOccupancy(confirmed, capacity) {
  if (!capacity || capacity <= 0) return 0;
  return Math.round(((confirmed || 0) / capacity) * 100);
}
