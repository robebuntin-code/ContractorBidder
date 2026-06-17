import { boundingBox, extractPostalCode, haversineKm, toCoarse } from './geo.util';

describe('geo.util', () => {
  describe('haversineKm', () => {
    it('returns ~0 for identical points', () => {
      expect(haversineKm({ lat: 40.71, lng: -74 }, { lat: 40.71, lng: -74 })).toBeCloseTo(0, 5);
    });

    it('computes a known distance (NYC -> Philadelphia ~129km)', () => {
      const d = haversineKm({ lat: 40.7128, lng: -74.006 }, { lat: 39.9526, lng: -75.1652 });
      expect(d).toBeGreaterThan(120);
      expect(d).toBeLessThan(140);
    });
  });

  describe('toCoarse', () => {
    it('is approximately stable when re-snapping an already-coarse point', () => {
      const once = toCoarse({ lat: 40.7128, lng: -74.006 });
      const twice = toCoarse(once);
      // Re-snapping should not drift further than a fraction of the grid cell.
      expect(haversineKm(once, twice)).toBeLessThan(0.3);
    });

    it('keeps the coarse point close to the original (<1.5km)', () => {
      const orig = { lat: 40.7128, lng: -74.006 };
      const coarse = toCoarse(orig);
      expect(haversineKm(orig, coarse)).toBeLessThan(1.5);
    });
  });

  describe('boundingBox', () => {
    it('produces a box that contains the center', () => {
      const c = { lat: 40.7128, lng: -74.006 };
      const box = boundingBox(c, 10);
      expect(c.lat).toBeGreaterThanOrEqual(box.minLat);
      expect(c.lat).toBeLessThanOrEqual(box.maxLat);
      expect(c.lng).toBeGreaterThanOrEqual(box.minLng);
      expect(c.lng).toBeLessThanOrEqual(box.maxLng);
    });
  });

  describe('extractPostalCode', () => {
    it('extracts a 5-digit ZIP', () => {
      expect(extractPostalCode('200 Eastern Pkwy, Brooklyn, NY 11238')).toBe('11238');
    });

    it('extracts ZIP from ZIP+4', () => {
      expect(extractPostalCode('123 Main St, Austin, TX 78701-1234')).toBe('78701');
    });

    it('returns null when no ZIP present', () => {
      expect(extractPostalCode('12 Greenwich St, New York, NY')).toBeNull();
    });
  });
});
