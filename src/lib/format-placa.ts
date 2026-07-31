/**
 * Formats a Brazilian vehicle plate with a dash.
 * Accepts ABC1D23, ABC1234, abc1d23 etc.
 * Returns formatted: ABC-1D23 or ABC-1234
 */
export function formatPlaca(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  return clean.slice(0, 3) + "-" + clean.slice(3, 7);
}

/**
 * Strips the dash for storage/search purposes.
 */
export function cleanPlaca(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
