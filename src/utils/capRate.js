/**
 * Suggest an adopted cap rate from a property's linked sales evidence.
 *
 * The team sets the adopted cap rate by hand — this only ever offers a
 * starting point, and only when the evidence actually supports one. It
 * returns null rather than a number with no basis, because a confident-looking
 * suggestion drawn from one comp is worse than no suggestion at all.
 *
 * Median, not mean: cap-rate evidence is a small sample and one outlier
 * (a distressed sale, a mis-keyed figure) would drag an average badly.
 */

/**
 * Cap rates are stored as percentages ("6.5" means 6.5%). A value below this
 * is almost certainly a decimal fraction typed into a percent field (0.055
 * meaning 5.5%) — counting it would drag the median toward zero.
 */
const MIN_PLAUSIBLE_PCT = 0.5;
/** Above this is a data-entry error, not a commercial cap rate. */
const MAX_PLAUSIBLE_PCT = 20;

export function suggestCapRate(salesComps = []) {
  const rates = (salesComps || [])
    .map((c) => c?.capRate)
    .filter(
      (r) =>
        typeof r === 'number' &&
        Number.isFinite(r) &&
        r >= MIN_PLAUSIBLE_PCT &&
        r <= MAX_PLAUSIBLE_PCT,
    )
    .sort((a, b) => a - b);

  if (rates.length === 0) return null;

  const mid = Math.floor(rates.length / 2);
  const median =
    rates.length % 2 === 1 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;

  return {
    median: Math.round(median * 100) / 100,
    count: rates.length,
    min: rates[0],
    max: rates[rates.length - 1],
  };
}
