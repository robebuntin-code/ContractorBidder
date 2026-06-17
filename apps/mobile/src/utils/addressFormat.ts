import type { LocationGeocodedAddress } from 'expo-location';

export function formatGeocodedAddress(parts: LocationGeocodedAddress): string {
  const line1 = [parts.streetNumber, parts.street].filter(Boolean).join(' ');
  return [line1, parts.city, parts.region, parts.postalCode].filter(Boolean).join(', ');
}
