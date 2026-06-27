import type { LocationGeocodedAddress } from 'expo-location';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalize commas, newlines, and extra spaces for single-line address fields. */
export function normalizeAddressDisplay(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ', ')
    .replace(/,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function detachGluedCity(line1: string, city: string): { line1: string; city: string } {
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

function abbreviateRegion(region: string): string {
  const trimmed = region.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return trimmed;
}

export function formatGeocodedAddress(parts: LocationGeocodedAddress): string {
  if (parts.formattedAddress?.trim()) {
    return normalizeAddressDisplay(parts.formattedAddress);
  }

  const streetNumber = parts.streetNumber?.trim() ?? '';
  const street = parts.street?.trim() ?? '';
  let line1 = [streetNumber, street].filter(Boolean).join(' ');

  let city = (parts.city ?? parts.subregion ?? parts.district ?? '').trim();
  const region = abbreviateRegion(parts.region ?? '');
  const postalCode = parts.postalCode?.trim().slice(0, 5) ?? '';

  if (line1 && city) {
    ({ line1, city } = detachGluedCity(line1, city));
  }

  if (!line1 && parts.name?.trim()) {
    line1 = parts.name.trim();
  }

  const regionPart = [region, postalCode].filter(Boolean).join(' ');
  return normalizeAddressDisplay([line1, city, regionPart].filter(Boolean).join(', '));
}
