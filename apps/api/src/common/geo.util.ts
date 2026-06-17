/**
 * Geospatial helpers. The privacy model requires that precise homeowner
 * locations are hidden until bid acceptance, so jobs store both a precise
 * point and a coarse point snapped to a ~1km grid used for discovery.
 */

const EARTH_RADIUS_KM = 6371;

/** Degrees of latitude per kilometer (constant). */
const DEG_LAT_PER_KM = 1 / 110.574;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Snap a coordinate to a coarse grid of roughly `gridKm` kilometers. This
 * anonymizes the exact location while keeping it useful for radius matching.
 * Longitude degrees-per-km depend on latitude, so we scale accordingly.
 */
export function toCoarse({ lat, lng }: LatLng, gridKm = 1): LatLng {
  const latStep = DEG_LAT_PER_KM * gridKm;
  const lngStep = gridKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1e-6);
  const snap = (value: number, step: number) => Math.round(value / step) * step;
  return {
    lat: Number(snap(lat, latStep).toFixed(5)),
    lng: Number(snap(lng, lngStep).toFixed(5)),
  };
}

/** Great-circle distance between two points in kilometers (Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bounding box around a point for a given radius, used to pre-filter rows in
 * SQL cheaply before computing exact Haversine distance.
 */
export function boundingBox(center: LatLng, radiusKm: number) {
  const latDelta = radiusKm * DEG_LAT_PER_KM;
  const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180) || 1e-6);
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Extract a US ZIP code (5-digit or ZIP+4) from a free-form address string. */
export function extractPostalCode(addressText: string): string | null {
  const match = addressText.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] ?? null;
}
