const MILES_TO_METERS = 1609.344;

/** Map viewport that comfortably frames a circular search radius. */
export function regionForRadiusMiles(center: { lat: number; lng: number }, radiusMiles: number) {
  const latDelta = Math.max(0.015, (radiusMiles / 69) * 2.4);
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: latDelta,
    longitudeDelta: latDelta,
  };
}

export function milesToMeters(miles: number): number {
  return miles * MILES_TO_METERS;
}
