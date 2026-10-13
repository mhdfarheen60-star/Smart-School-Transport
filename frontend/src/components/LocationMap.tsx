import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Navigation } from 'lucide-react';
import {
  MAPS_AUTH_EVENT,
  DARK_MAP_STYLE,
  directionsUrl,
  hasMapsKey,
  isValidCoord,
  loadGoogleMaps,
  markerIcon,
  placeUrl,
} from '../utils/maps';

export interface MapPoint {
  lat?: number | null;
  lng?: number | null;
  label: string; // single letter shown on the marker
  color: string;
  title: string;
  address?: string;
}

/** Read-only map with one or more labelled markers. Falls back to a coordinate list without a key. */
export default function LocationMap({ points, height = 'h-72' }: { points: MapPoint[]; height?: string }) {
  const div = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!hasMapsKey);
  const valid = points.filter((p) => isValidCoord(p.lat, p.lng));
  useEffect(() => {
    const f = () => setFailed(true);
    window.addEventListener(MAPS_AUTH_EVENT, f);
    return () => window.removeEventListener(MAPS_AUTH_EVENT, f);
  }, []);
  const key = JSON.stringify(valid.map((p) => [p.lat, p.lng, p.label, p.color]));

  useEffect(() => {
    if (!hasMapsKey || valid.length === 0) return;
    let cancelled = false;
    const markers: google.maps.Marker[] = [];
    (async () => {
      try {
        await loadGoogleMaps();
        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
        if (cancelled || !div.current) return;
        const map = new Map(div.current, {
          center: { lat: valid[0].lat!, lng: valid[0].lng! },
          zoom: 15,
          styles: DARK_MAP_STYLE,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        const bounds = new google.maps.LatLngBounds();
        for (const p of valid) {
          const pos = { lat: p.lat!, lng: p.lng! };
          markers.push(
            new google.maps.Marker({
              map,
              position: pos,
              title: p.title,
              icon: markerIcon(p.color),
              label: { text: p.label, color: '#fff', fontWeight: '700', fontSize: '11px' },
            })
          );
          bounds.extend(pos);
        }
        if (valid.length > 1) map.fitBounds(bounds, 48);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      markers.forEach((m) => m.setMap(null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (valid.length === 0) {
    return <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">No coordinates saved for this location.</div>;
  }
  if (failed) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm">
        <div className="mb-2 text-xs text-amber-300">
          {hasMapsKey ? 'Map could not be loaded.' : 'Map preview unavailable (Google Maps key not configured).'} Saved coordinates:
        </div>
        <ul className="space-y-2">
          {valid.map((p) => (
            <li key={p.title} className="flex items-start gap-2 text-white/80">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: p.color }}>
                {p.label}
              </span>
              <span>
                {p.title}
                <span className="block text-xs text-white/50">
                  {p.lat!.toFixed(6)}, {p.lng!.toFixed(6)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <div ref={div} className={`${height} w-full overflow-hidden rounded-lg border border-white/10`} />;
}

/** Buttons that open a saved coordinate in Google Maps (works without an API key). */
export function MapLinks({
  lat,
  lng,
  className = '',
}: {
  lat?: number | null;
  lng?: number | null;
  className?: string;
}) {
  const dir = directionsUrl(lat, lng);
  const place = placeUrl(lat, lng);
  if (!dir || !place) return <span className="text-xs text-white/40">No coordinates saved</span>;
  const cls =
    'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10';
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a href={place} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
      </a>
      <a href={dir} target="_blank" rel="noopener noreferrer" className={cls}>
        <Navigation className="h-3.5 w-3.5" /> Directions
      </a>
    </div>
  );
}
