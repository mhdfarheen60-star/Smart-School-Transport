export interface LocationValue {
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

export const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

/** True when a real-looking key is configured (the .env.example placeholder does not count). */
export const hasMapsKey = !!MAPS_KEY && MAPS_KEY !== 'your_google_maps_api_key';

/** Why Maps is unavailable before any network call is made (null when a key is present). */
export const keyProblem: string | null = hasMapsKey
  ? null
  : MAPS_KEY === 'your_google_maps_api_key'
  ? 'VITE_GOOGLE_MAPS_API_KEY in frontend/.env is still the placeholder value. Replace it with your real Google Maps browser key, then restart the dev server (npm run dev).'
  : 'VITE_GOOGLE_MAPS_API_KEY is missing from frontend/.env. Add it, then restart the dev server (npm run dev) — Vite only reads .env at startup.';

/** Fired when Google rejects the key (invalid key, billing off, referrer not allowed, API not enabled). */
export const MAPS_AUTH_EVENT = 'gmaps-auth-failure';
export const AUTH_FAILURE_MESSAGE =
  'Google rejected the Maps API key. Check that the key is valid, billing is enabled on the Google Cloud project, ' +
  'the Maps JavaScript API is enabled, and this site’s address is allowed in the key’s HTTP referrer restrictions.';

export class MapsError extends Error {
  constructor(public code: 'MISSING_KEY' | 'LOAD_FAILED' | 'AUTH_FAILED', message: string) {
    super(message);
  }
}

let loading: Promise<void> | null = null;
let authFailed = false;

/**
 * Loads the Google Maps JavaScript API once (async, with the bootstrap `importLibrary` loader).
 * Individual libraries (maps / places / geocoding) are then pulled in on demand.
 */
export function loadGoogleMaps(): Promise<void> {
  if (!hasMapsKey) {
    return Promise.reject(new MapsError('MISSING_KEY', 'Google Maps API key is not configured'));
  }
  if (authFailed) return Promise.reject(new MapsError('AUTH_FAILED', AUTH_FAILURE_MESSAGE));
  if (typeof window !== "undefined" && (window as any).google?.maps?.importLibrary) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      (window as any).gm_authFailure = () => {
        authFailed = true;
        window.dispatchEvent(new Event(MAPS_AUTH_EVENT));
      };
      (window as any).__gmapsReady = () => resolve();
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        MAPS_KEY!
      )}&v=weekly&loading=async&libraries=places&callback=__gmapsReady`;
      s.async = true;
      s.onerror = () => {
        loading = null;
        reject(new MapsError('LOAD_FAILED', 'Could not load Google Maps. Check your connection and API key.'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Turn-by-turn directions in the Google Maps app/site. Returns null for invalid coordinates. */
export function directionsUrl(lat?: number | null, lng?: number | null): string | null {
  if (!isValidCoord(lat, lng)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Open the point itself (no routing). */
export function placeUrl(lat?: number | null, lng?: number | null): string | null {
  if (!isValidCoord(lat, lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#14171c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#14171c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b93a1' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2f38' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9aa3b2' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a4250' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1a2e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1f27' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#14261f' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1a1f27' }] },
];

export function markerIcon(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 11,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  };
}

export const PICKUP_COLOR = '#10b981';
export const DROP_COLOR = '#ef4444';
export const NEUTRAL_COLOR = '#9ca3af';
