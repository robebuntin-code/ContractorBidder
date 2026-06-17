import { apiRequest } from './api';

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

export interface GpsReading {
  lat: number;
  lng: number;
  accuracyMeters: number;
}

/** Reject browser fixes worse than ~1.25 miles — common for IP-based desktop guesses. */
export const MAX_GPS_ACCURACY_METERS = 2000;

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  return apiRequest<GeocodeResult>('/geocode/forward', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return apiRequest<GeocodeResult>(`/geocode/reverse?${qs.toString()}`);
}

function geolocationErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return 'Location permission denied. Enter your address and tap Search here.';
  }
  if (err.code === err.TIMEOUT) {
    return 'Location timed out. Enter your address and tap Search here.';
  }
  return 'Could not read your location. Enter your address and tap Search here.';
}

/**
 * Collect several GPS readings via watchPosition and return the most accurate fix.
 * Desktop browsers often return IP-based locations; we reject coarse fixes below.
 */
export function getBestCurrentPosition(options?: {
  maxWaitMs?: number;
  maxAccuracyMeters?: number;
}): Promise<GpsReading> {
  const maxWaitMs = options?.maxWaitMs ?? 15000;
  const maxAccuracyMeters = options?.maxAccuracyMeters ?? MAX_GPS_ACCURACY_METERS;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    let best: GpsReading | null = null;
    let watchId: number | null = null;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      fn();
    };

    const consider = (pos: GeolocationPosition) => {
      const reading: GpsReading = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy,
      };
      if (!best || reading.accuracyMeters < best.accuracyMeters) {
        best = reading;
      }
      if (reading.accuracyMeters <= maxAccuracyMeters) {
        finish(() => resolve(reading));
      }
    };

    const timer = setTimeout(() => {
      if (best) {
        if (best.accuracyMeters <= maxAccuracyMeters) {
          finish(() => resolve(best!));
          return;
        }
        finish(() =>
          reject(
            new Error(
              `Your browser only provided an approximate location (±${Math.max(1, Math.round(best!.accuracyMeters / 1609))} mi). ` +
                'Enter your full address with city and state, then tap Search here.',
            ),
          ),
        );
        return;
      }
      finish(() =>
        reject(
          new Error(
            'Could not get a precise location from your browser. Enter your address and tap Search here.',
          ),
        ),
      );
    }, maxWaitMs);

    watchId = navigator.geolocation.watchPosition(
      consider,
      (err) => finish(() => reject(new Error(geolocationErrorMessage(err)))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs },
    );
  });
}

/** @deprecated Use getBestCurrentPosition */
export function getCurrentPosition(): Promise<GpsReading> {
  return getBestCurrentPosition();
}

export function formatAccuracyMiles(accuracyMeters: number): string {
  const miles = accuracyMeters / 1609.34;
  if (miles < 0.2) return 'within a few hundred feet';
  if (miles < 1) return `±${miles.toFixed(1)} mi`;
  return `±${Math.round(miles)} mi`;
}
