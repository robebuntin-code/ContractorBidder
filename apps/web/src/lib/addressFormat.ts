/** Normalize commas, newlines, and odd spaces for single-line address fields. */
export function normalizeAddressDisplay(value: string): string {
  return value
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ', ')
    .replace(/,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split "123 Main StAtlanta" when city is known but glued to the street line. */
export function detachGluedCity(line1: string, city: string): { line1: string; city: string } {
  const trimmedCity = city.trim();
  if (!line1 || !trimmedCity) return { line1: line1.trim(), city: trimmedCity };

  const glued = line1.match(
    new RegExp(`^(.+?)(?<![\\s,])${escapeRegExp(trimmedCity)}$`, 'i'),
  );
  if (glued) {
    return {
      line1: glued[1].trim().replace(/,\s*$/, ''),
      city: trimmedCity,
    };
  }

  return { line1: line1.trim(), city: trimmedCity };
}
