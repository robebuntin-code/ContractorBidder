import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'DOJOBID-API/1.0 (contractor marketplace; contact@dojobid.local)';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const US_STATE_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
  type?: string;
  class?: string;
  address?: NominatimAddress;
}

function parseUsHints(address: string): { state?: string; zip?: string } {
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch?.[1];

  const abbrMatch = address.match(/,\s*([A-Za-z]{2})(?:\s+\d{5})?(?:\s*,|\s*$)/);
  if (abbrMatch) {
    return { state: abbrMatch[1].toUpperCase(), zip };
  }

  const stateNameMatch = address.match(/,\s*([A-Za-z\s.]+?)(?:\s+\d{5})?(?:\s*,|\s*$)/);
  if (stateNameMatch) {
    const normalized = stateNameMatch[1].trim().toLowerCase().replace(/\./g, '');
    const abbr = US_STATE_ABBR[normalized];
    if (abbr) return { state: abbr, zip };
  }

  return { zip };
}

function normalizeAddressLabel(value: string): string {
  return value
    .replace(/\u00a0|\u202f/g, ' ')
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

function formatAddress(addr: NominatimAddress): string {
  let line1 = [addr.house_number, addr.road].filter(Boolean).join(' ').trim();
  let city = (addr.city ?? addr.town ?? addr.village ?? '').trim();
  if (!city && addr.county) {
    city = addr.county.replace(/\s+County$/i, '').trim();
  }
  if (line1 && city) {
    ({ line1, city } = detachGluedCity(line1, city));
  }
  const state = addr.state ?? '';
  const zip = addr.postcode?.slice(0, 5) ?? '';
  const statePart = [state, zip].filter(Boolean).join(' ');
  return normalizeAddressLabel([line1, city, statePart].filter(Boolean).join(', '));
}

function scoreHit(hit: NominatimHit, hints: { state?: string; zip?: string }): number {
  let score = hit.importance ?? 0;
  const addr = hit.address;
  if (!addr) return score;

  const hitState = addr.state?.toUpperCase();
  if (hints.state && hitState) {
    const wanted = hints.state.toUpperCase();
    if (hitState === wanted || hitState.startsWith(wanted)) score += 20;
    else score -= 15;
  }

  if (hints.zip && addr.postcode?.startsWith(hints.zip)) score += 10;

  if (hit.class === 'place' && hit.type === 'state') score -= 8;
  if (hit.class === 'boundary' && hit.type === 'administrative') score -= 4;
  if (addr.house_number) score += 4;
  if (addr.road) score += 2;

  return score;
}

@Injectable()
export class GeocodingService {
  private async fetchNominatim(path: string): Promise<Response> {
    return fetch(`${NOMINATIM}${path}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en-US',
        'User-Agent': USER_AGENT,
      },
    });
  }

  async forward(address: string): Promise<GeocodeResult> {
    const trimmed = normalizeAddressLabel(address);
    if (trimmed.length < 3) {
      throw new BadRequestException('Please enter a complete address with city and state.');
    }

    const hints = parseUsHints(trimmed);
    const qs = new URLSearchParams({
      format: 'json',
      q: trimmed,
      limit: '8',
      addressdetails: '1',
      countrycodes: 'us',
    });

    const res = await this.fetchNominatim(`/search?${qs.toString()}`);
    if (!res.ok) {
      throw new BadRequestException('Could not look up that address. Please try again.');
    }

    const hits = (await res.json()) as NominatimHit[];
    if (!hits.length) {
      throw new NotFoundException(
        'We could not find that address. Try adding city and state, e.g. "123 Main St, Atlanta, GA".',
      );
    }

    const best = [...hits].sort((a, b) => scoreHit(b, hints) - scoreHit(a, hints))[0];
    const label = best.address ? formatAddress(best.address) : best.display_name;

    return {
      lat: Number(best.lat),
      lng: Number(best.lon),
      label: normalizeAddressLabel(label || trimmed),
    };
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Invalid coordinates.');
    }

    const qs = new URLSearchParams({
      format: 'json',
      lat: String(lat),
      lon: String(lng),
      addressdetails: '1',
      zoom: '18',
    });

    const res = await this.fetchNominatim(`/reverse?${qs.toString()}`);
    if (!res.ok) {
      throw new BadRequestException('Could not determine your address.');
    }

    const data = (await res.json()) as NominatimHit;
    if (!data.address) {
      throw new BadRequestException('Could not determine your address. Please type it manually.');
    }

    return {
      lat,
      lng,
      label: normalizeAddressLabel(formatAddress(data.address) || data.display_name),
    };
  }
}
