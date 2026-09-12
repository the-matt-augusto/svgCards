const HEX_REGEX = /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

/**
 * Validates whether a given string is a safe 3-digit or 6-digit hex color (without #).
 */
export function safeHex(val: string | null | undefined): boolean {
  if (!val) return false;
  return HEX_REGEX.test(val);
}

/**
 * Normalizes a hex color string to include a leading '#' if valid, or falls back to a default.
 */
export function normalizeHex(val: string | null | undefined, fallback = '#8b949e'): string {
  if (!val) return fallback;
  const stripped = val.replace(/^#/, '');
  return safeHex(stripped) ? `#${stripped}` : fallback;
}
