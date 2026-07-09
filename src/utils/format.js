/**
 * Shared formatting utilities.
 * Import from here instead of defining locally in each component.
 */

/**
 * Format a dollar amount into a compact, readable string.
 *   5_000_000  → "$5M"
 *   750_000    → "$750K"
 *   1_234      → "$1,234"
 *   null / 0   → fallback (default: "—")
 */
/**
 * Format a millisecond timestamp as "D Mon YY" (e.g. "3 Jun 26").
 * Used for comp audit trail display.
 */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const formatDate = (ms) => {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

export const formatCurrency = (val, fallback = '—') => {
  if (!val) return fallback;
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (val >= 1_000)     return '$' + (val / 1_000).toFixed(0) + 'K';
  return '$' + val.toLocaleString();
};

/**
 * Format a byte count as a human-readable size.
 *   1_048_576 → "1 MB"   ·   2_048 → "2 KB"   ·   null → ""
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
};
