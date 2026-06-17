const MILES_TO_METERS = 1609.344;

/** Map viewport that comfortably frames a circular search radius. */
export function regionForRadiusMiles(center: { lat: number; lng: number }, radiusMiles: number) {
  const latDelta = Math.max(0.015, (radiusMiles / 69) * 2.4);
  return {
    lat: center.lat,
    lng: center.lng,
    latDelta,
    lngDelta: latDelta,
  };
}

export function milesToMeters(miles: number): number {
  return miles * MILES_TO_METERS;
}

/** Leaflet bounds that frame the search radius around a center point. */
export function boundsForRadiusMiles(
  center: { lat: number; lng: number },
  radiusMiles: number,
): [[number, number], [number, number]] {
  const { latDelta, lngDelta } = regionForRadiusMiles(center, radiusMiles);
  return [
    [center.lat - latDelta / 2, center.lng - lngDelta / 2],
    [center.lat + latDelta / 2, center.lng + lngDelta / 2],
  ];
}
