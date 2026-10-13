import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import {
  AUTH_FAILURE_MESSAGE,
  DARK_MAP_STYLE,
  DROP_COLOR,
  hasMapsKey,
  keyProblem,
  MAPS_AUTH_EVENT,
  isValidCoord,
  loadGoogleMaps,
  LocationValue,
  markerIcon,
  MapsError,
  NEUTRAL_COLOR,
  PICKUP_COLOR,
} from '../utils/maps';
import { Button } from './ui';

export type { LocationValue } from '../utils/maps';

export interface LocationPickerProps {
  label: string;
  value?: LocationValue;
  onChange: (location: LocationValue) => void;
  /** pickup = green marker, drop = red marker */
  kind?: 'pickup' | 'drop';
  /** the other location (shown as a separate, non-draggable marker) */
  other?: LocationValue;
  error?: string;
  disabled?: boolean;
}

interface Suggestion {
  text: string;
  prediction: google.maps.places.PlacePrediction;
}

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India, shown only until a point is chosen

type LoadState = 'loading' | 'ready' | 'nokey' | 'error';

export default function LocationPicker({ label, value, onChange, kind = 'pickup', other, error, disabled }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const color = kind === 'pickup' ? PICKUP_COLOR : DROP_COLOR;

  return (
    <div>
      <div className="mb-1 text-sm font-medium text-slate-700">
        {label} <span className="text-red-500">*</span>
      </div>
      <div className={`rounded-lg border p-3 ${error ? 'border-red-400' : 'border-white/10'} bg-white/[0.03]`}>
        {value ? (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
              {kind === 'pickup' ? 'P' : 'D'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white">{value.address}</div>
              <div className="mt-0.5 text-xs text-white/50">
                {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <MapPin className="h-4 w-4" /> No location selected
          </div>
        )}
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
            <MapPin className="h-4 w-4" /> {value ? 'Change location' : 'Select on map'}
          </Button>
        </div>
      </div>
      {error && (
        <span className="mt-1 block text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
      {createPortal(
      <AnimatePresence>
        {open && (
          <PickerDialog
            key="picker"
            title={label}
            kind={kind}
            initial={value}
            other={other}
            onCancel={() => setOpen(false)}
            onConfirm={(v) => {
              onChange(v);
              setOpen(false);
            }}
          />
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
}

function PickerDialog({
  title,
  kind,
  initial,
  other,
  onCancel,
  onConfirm,
}: {
  title: string;
  kind: 'pickup' | 'drop';
  initial?: LocationValue;
  other?: LocationValue;
  onCancel: () => void;
  onConfirm: (v: LocationValue) => void;
}) {
  const color = kind === 'pickup' ? PICKUP_COLOR : DROP_COLOR;
  const mapDiv = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const places = useRef<google.maps.PlacesLibrary | null>(null);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [state, setState] = useState<LoadState>(hasMapsKey ? 'loading' : 'nokey');
  const [errMsg, setErrMsg] = useState('');
  const [draft, setDraft] = useState<LocationValue | undefined>(initial);
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const [locating, setLocating] = useState(false);
  const [manual, setManual] = useState({ lat: initial ? String(initial.latitude) : '', lng: initial ? String(initial.longitude) : '' });

  /** Reverse-geocode a point into a readable address and update the draft. */
  const setPoint = useCallback(
    async (lat: number, lng: number, known?: { address?: string; placeId?: string }) => {
      if (!isValidCoord(lat, lng)) return;
      if (known?.address) {
        setDraft({ address: known.address, latitude: lat, longitude: lng, placeId: known.placeId });
        return;
      }
      setDraft((d) => ({ address: d?.address || '', latitude: lat, longitude: lng, placeId: undefined }));
      setResolving(true);
      setGeoMsg('');
      try {
        const r = await geocoder.current!.geocode({ location: { lat, lng } });
        const best = r.results[0];
        setDraft({
          address: best?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          latitude: lat,
          longitude: lng,
          placeId: best?.place_id,
        });
        if (!best) setGeoMsg('No street address found here. You can edit the address below.');
      } catch {
        setDraft({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, latitude: lat, longitude: lng });
        setGeoMsg('Could not look up the address for this point. Please type it in below.');
      } finally {
        setResolving(false);
      }
    },
    []
  );

  // load API + build map
  useEffect(() => {
    if (!hasMapsKey) return;
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        const [{ Map }, placesLib, { Geocoder }] = await Promise.all([
          google.maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
          google.maps.importLibrary('places') as Promise<google.maps.PlacesLibrary>,
          google.maps.importLibrary('geocoding') as Promise<google.maps.GeocodingLibrary>,
        ]);
        if (cancelled || !mapDiv.current) return;
        places.current = placesLib;
        token.current = new placesLib.AutocompleteSessionToken();
        geocoder.current = new Geocoder();
        const start = initial ? { lat: initial.latitude, lng: initial.longitude } : DEFAULT_CENTER;
        const m = new Map(mapDiv.current, {
          center: start,
          zoom: initial ? 16 : 5,
          styles: DARK_MAP_STYLE,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        map.current = m;

        if (other && isValidCoord(other.latitude, other.longitude)) {
          new google.maps.Marker({
            map: m,
            position: { lat: other.latitude, lng: other.longitude },
            icon: markerIcon(kind === 'pickup' ? DROP_COLOR : PICKUP_COLOR),
            label: { text: kind === 'pickup' ? 'D' : 'P', color: '#fff', fontWeight: '700', fontSize: '11px' },
            title: kind === 'pickup' ? 'Drop-off location' : 'Pickup location',
            zIndex: 1,
          });
        }

        const mk = new google.maps.Marker({
          map: initial ? m : null,
          position: start,
          draggable: true,
          icon: markerIcon(color),
          label: { text: kind === 'pickup' ? 'P' : 'D', color: '#fff', fontWeight: '700', fontSize: '11px' },
          title: 'Drag to the exact point',
          zIndex: 2,
        });
        marker.current = mk;
        mk.addListener('dragend', () => {
          const p = mk.getPosition();
          if (p) setPoint(p.lat(), p.lng());
        });
        m.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          mk.setMap(m);
          mk.setPosition(e.latLng);
          setPoint(e.latLng.lat(), e.latLng.lng());
        });
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setErrMsg(e instanceof MapsError ? e.message : 'Google Maps failed to load.');
      }
    })();
    return () => {
      cancelled = true;
      marker.current?.setMap(null);
      marker.current = null;
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Google reports key / billing / referrer / API-enablement problems asynchronously
  useEffect(() => {
    const onAuthFail = () => {
      setState('error');
      setErrMsg(AUTH_FAILURE_MESSAGE);
    };
    window.addEventListener(MAPS_AUTH_EVENT, onAuthFail);
    return () => window.removeEventListener(MAPS_AUTH_EVENT, onAuthFail);
  }, []);

  // keep marker in sync with draft (from search / geolocation)
  useEffect(() => {
    if (state !== 'ready' || !draft || !map.current || !marker.current) return;
    const pos = { lat: draft.latitude, lng: draft.longitude };
    marker.current.setMap(map.current);
    marker.current.setPosition(pos);
  }, [draft?.latitude, draft?.longitude, state]);

  // autocomplete (Places API New) with debounce
  useEffect(() => {
    if (state !== 'ready' || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { AutocompleteSuggestion } = places.current!;
        const { suggestions: s } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: token.current!,
        });
        setSuggestions(
          s
            .filter((x) => x.placePrediction)
            .slice(0, 6)
            .map((x) => ({ text: x.placePrediction!.text.toString(), prediction: x.placePrediction! }))
        );
      } catch {
        setSuggestions([]);
        setGeoMsg('Address search is unavailable (check that the Places API is enabled for your key). You can still click on the map.');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, state]);

  const choose = async (s: Suggestion) => {
    setSuggestions([]);
    setQuery(s.text);
    setResolving(true);
    try {
      const place = s.prediction.toPlace();
      await place.fetchFields({ fields: ['location', 'formattedAddress', 'id'] });
      if (place.location) {
        const lat = place.location.lat();
        const lng = place.location.lng();
        map.current?.panTo({ lat, lng });
        map.current?.setZoom(17);
        await setPoint(lat, lng, { address: place.formattedAddress || s.text, placeId: place.id });
      }
      token.current = new places.current!.AutocompleteSessionToken(); // new billing session per selection
    } catch {
      setGeoMsg('Could not load that place. Try another suggestion or click on the map.');
    } finally {
      setResolving(false);
    }
  };

  const useMyLocation = () => {
    setGeoMsg('');
    if (!('geolocation' in navigator)) {
      setGeoMsg('Your browser does not support location access. Search or click on the map instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        map.current?.panTo({ lat: latitude, lng: longitude });
        map.current?.setZoom(17);
        setPoint(latitude, longitude);
      },
      (err) => {
        setLocating(false);
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location access in your browser settings, or search / click on the map.'
            : err.code === err.TIMEOUT
            ? 'Finding your location timed out. Please try again or choose a point on the map.'
            : 'Your location is currently unavailable. Search or click on the map instead.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const manualValid = useMemo(() => {
    const lat = Number(manual.lat);
    const lng = Number(manual.lng);
    return manual.lat !== '' && manual.lng !== '' && isValidCoord(lat, lng);
  }, [manual]);

  const canConfirm = !!draft && draft.address.trim().length >= 3 && isValidCoord(draft.latitude, draft.longitude) && !resolving;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Select ${title}`}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        className="flex h-[100dvh] w-full flex-col overflow-hidden border border-white/10 bg-[#0e1014] shadow-2xl sm:h-[90vh] sm:max-w-4xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold text-white">Select {title.toLowerCase()}</h2>
          <button onClick={onCancel} aria-label="Close" className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {state === 'ready' && (
          <div className="relative border-b border-white/10 p-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  className="input pl-9"
                  placeholder="Search for an address or place"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search address"
                  autoComplete="off"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/50" />}
              </div>
              <Button type="button" variant="secondary" onClick={useMyLocation} loading={locating} aria-label="Use my current location">
                {!locating && <Crosshair className="h-4 w-4" />}
                <span className="hidden sm:inline">Use current location</span>
              </Button>
            </div>
            {suggestions.length > 0 && (
              <ul className="absolute left-3 right-3 top-[calc(100%-4px)] z-20 overflow-hidden rounded-lg border border-white/10 bg-[#14171c] shadow-xl" role="listbox">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/10"
                      onClick={() => choose(s)}
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                      {s.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="relative min-h-[260px] flex-1">
          <div ref={mapDiv} className="absolute inset-0" />
          {state === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[#0e1014] text-sm text-white/60">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading map…
            </div>
          )}
          {(state === 'nokey' || state === 'error') && (
            <div className="absolute inset-0 overflow-y-auto bg-[#0e1014] p-4">
              <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {state === 'nokey' ? 'Google Maps is not configured' : 'Google Maps could not be loaded'}
                </div>
                <p className="mt-2 text-amber-100/80">
                  {state === 'nokey'
                    ? keyProblem
                    : errMsg}
                </p>
                <p className="mt-2 text-amber-100/80">
                  Meanwhile you can enter the address and exact coordinates manually below.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-white/80">Address</span>
                  <input
                    className="input"
                    value={draft?.address || ''}
                    onChange={(e) =>
                      setDraft({ address: e.target.value, latitude: Number(manual.lat) || 0, longitude: Number(manual.lng) || 0 })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-white/80">Latitude (-90 to 90)</span>
                  <input className="input" inputMode="decimal" value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-white/80">Longitude (-180 to 180)</span>
                  <input className="input" inputMode="decimal" value={manual.lng} onChange={(e) => setManual({ ...manual, lng: e.target.value })} />
                </label>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!manualValid}
                    onClick={() =>
                      setDraft({
                        address: draft?.address || '',
                        latitude: Number(manual.lat),
                        longitude: Number(manual.lng),
                      })
                    }
                  >
                    Use these coordinates
                  </Button>
                  {(manual.lat !== '' || manual.lng !== '') && !manualValid && (
                    <span className="ml-3 text-xs text-red-400">Enter valid coordinates</span>
                  )}
                </div>
              </div>
            </div>
          )}
          {state === 'ready' && (
            <div className="pointer-events-none absolute left-3 top-3 flex gap-2 text-[11px]">
              <span className="rounded-full bg-black/60 px-2 py-1 text-white/80 backdrop-blur">Click the map or drag the marker</span>
              {other && <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-white/80 backdrop-blur"><span className="h-2 w-2 rounded-full" style={{ background: kind === 'pickup' ? DROP_COLOR : PICKUP_COLOR }} /> {kind === 'pickup' ? 'Drop' : 'Pickup'}</span>}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-black/30 p-4">
          {geoMsg && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" role="alert">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {geoMsg}
            </div>
          )}
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: draft ? color : NEUTRAL_COLOR }}>
                {kind === 'pickup' ? 'P' : 'D'}
              </span>
              <div className="min-w-0 flex-1">
                {draft && state === 'ready' ? (
                  <>
                    <input
                      className="input !py-1.5"
                      aria-label="Selected address"
                      value={draft.address}
                      placeholder={resolving ? 'Finding address…' : 'Address'}
                      onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                    />
                    <div className="mt-1 text-xs text-white/50">
                      {isValidCoord(draft.latitude, draft.longitude) ? `${draft.latitude.toFixed(6)}, ${draft.longitude.toFixed(6)}` : 'Invalid coordinates'}
                      {resolving && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
                    </div>
                  </>
                ) : draft && (state === 'nokey' || state === 'error') ? (
                  <div className="text-sm text-white">
                    {draft.address || <span className="text-white/40">No address yet</span>}
                    <div className="mt-1 text-xs text-white/50">
                      {isValidCoord(draft.latitude, draft.longitude) && (draft.latitude !== 0 || draft.longitude !== 0)
                        ? `${draft.latitude.toFixed(6)}, ${draft.longitude.toFixed(6)}`
                        : 'Coordinates not set'}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/50">Search for an address, click the map, or use your current location.</div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canConfirm || (state !== 'ready' && !(draft && isValidCoord(draft.latitude, draft.longitude) && (draft.latitude !== 0 || draft.longitude !== 0)))}
              onClick={() => draft && onConfirm({ ...draft, address: draft.address.trim() })}
            >
              <Check className="h-4 w-4" /> Confirm {kind === 'pickup' ? 'pickup' : 'drop'} location
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
