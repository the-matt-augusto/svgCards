/**
 * Formats a number with compact SI suffixes (k, M) for display in cards.
 */
export function formatNumber(num: number): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1000000) {
    return sign + (abs / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (abs >= 1000) {
    return sign + (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(num);
}

/**
 * Formats a signed reputation change value (e.g. +100, -25).
 */
export function formatRepChange(change: number): string {
  if (change >= 0) {
    return `+${formatNumber(change)}`;
  }
  return formatNumber(change);
}
