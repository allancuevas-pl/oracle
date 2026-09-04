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
  // Only a genuinely absent value is "—". A price of 0 is a real number and
  // must render as $0 (see src/utils/number.js for the same rule on inputs).
  if (val == null || !Number.isFinite(val)) return fallback;
  // Two decimals, trailing zeros trimmed: $3.75M, not $3.8M. Five components
  // had each forked their own copy to get this precision, which meant the
  // same sale showed as $3.75M on one screen and $3.8M on another. For a
  // valuation tool the precise form is the correct one, so it lives here now.
  // Sign goes before the dollar: -$3.75M, not $-3.75M. Net profit can be
  // negative and it is read at a glance.
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1_000_000) {
    return sign + '$' + (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  }
  if (abs >= 1_000) return sign + '$' + Math.round(abs / 1_000) + 'K';
  return sign + '$' + abs.toLocaleString();
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
