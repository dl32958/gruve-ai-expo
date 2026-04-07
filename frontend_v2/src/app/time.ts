export function formatRunTimestamp(timestamp: string): string {
  if (!timestamp) return "";

  const normalized = timestamp.replace("T", " ").slice(0, 16);
  if (normalized.length === 16) return normalized;

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
