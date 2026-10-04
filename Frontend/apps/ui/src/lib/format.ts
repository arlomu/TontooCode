/** Short relative timestamps for the sidebar: now, 5m, 2h, 3d, or a date. */
export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

export function compactNum(n: number): string {
  return compact.format(n);
}

/** Rough token estimate from character counts (no tokenizer client-side). */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}
