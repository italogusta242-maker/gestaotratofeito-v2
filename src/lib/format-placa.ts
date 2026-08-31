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

/**
 * Detecta se é placa Mercosul (padrão AAA0A00, 5º char é letra).
 * Antiga: AAA0000. Retorna false se incompleta/inválida.
 */
export function isPlacaMercosul(raw: string): boolean {
  const c = cleanPlaca(raw);
  if (c.length !== 7) return false;
  return /^[A-Z]{3}\d[A-Z]\d{2}$/.test(c);
}
