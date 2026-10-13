import { useMemo, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import LocationMap, { MapLinks } from '../../components/LocationMap';
import { Badge, Button, EmptyState, ErrorState, Modal, PageHeader, Skeleton } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import type { AttendanceRecord, GeoPoint, Stop, Trip } from '../../types';
import { directionsUrl, DROP_COLOR, PICKUP_COLOR } from '../../utils/maps';

type Target = 'pickup' | 'drop';

interface Row {
  student: any;
  stop?: string;
  seq: number;
  pickup?: GeoPoint;
  drop?: GeoPoint;
  attendance?: AttendanceRecord;
}

/** Builds rows (ordered by route stop sequence) for the driver's own assignment only. */
export function useDriverRows() {
  const mine = useFetch<any>('/assignments/mine', undefined, { interval: 30000 });
  const trip = useFetch<Trip | null>('/trips/today', undefined, { interval: 30000 });
  const rows = useMemo<Row[]>(() => {
    const a = mine.data;
    if (!a) return [];
    const seq = new Map<string, number>((a.route.stops as Stop[]).map((s) => [s.name, s.sequence]));
    const att = new Map<string, AttendanceRecord>((trip.data?.attendance || []).map((x) => [x.student._id, x]));
    return (a.riders as any[])
      .map((r) => ({
        student: r.student,
        stop: r.stop,
        seq: seq.get(r.stop || '') ?? 999,
        pickup: r.locations?.pickup,
        drop: r.locations?.drop,
        attendance: att.get(r.student._id),
      }))
      .sort((x, y) => x.seq - y.seq || x.student.name.localeCompare(y.student.name));
  }, [mine.data, trip.data]);
  return { mine, trip, rows };
}

/** Next stop = first student (in route order) not yet picked up, else first picked-up not yet dropped. */
export function nextStop(rows: Row[]): { row: Row; target: Target } | null {
  const hasCoords = (p?: GeoPoint) => p?.latitude !== undefined && p?.longitude !== undefined;
  const pend = rows.find((r) => (r.attendance?.pickupStatus ?? 'pending') === 'pending' && hasCoords(r.pickup));
  if (pend) return { row: pend, target: 'pickup' };
  const toDrop = rows.find((r) => r.attendance?.pickupStatus === 'picked_up' && r.attendance.dropStatus !== 'dropped' && hasCoords(r.drop));
  return toDrop ? { row: toDrop, target: 'drop' } : null;
}

export function DriverLocationDialog({ row, target, onClose }: { row: Row | null; target: Target; onClose: () => void }) {
  if (!row) return null;
  const p = target === 'pickup' ? row.pickup : row.drop;
  return (
    <Modal open title={`${target === 'pickup' ? 'Pickup' : 'Drop-off'} · ${row.student.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="text-sm">
          <div className="font-medium text-white">{p?.address || '—'}</div>
          {p?.latitude !== undefined && (
            <div className="text-xs text-white/50">{p.latitude.toFixed(6)}, {p.longitude!.toFixed(6)}</div>
          )}
          {row.stop && <div className="mt-1 text-xs text-white/50">Assigned stop: {row.stop}</div>}
        </div>
        <LocationMap
          height="h-[45vh] min-h-[260px]"
          points={[
            {
              lat: p?.latitude,
              lng: p?.longitude,
              label: target === 'pickup' ? 'P' : 'D',
              color: target === 'pickup' ? PICKUP_COLOR : DROP_COLOR,
              title: `${target === 'pickup' ? 'Pickup' : 'Drop-off'}: ${p?.address || ''}`,
            },
          ]}
        />
        <MapLinks lat={p?.latitude} lng={p?.longitude} />
      </div>
    </Modal>
  );
}

export default function DriverStudentsPage() {
  const { mine, trip, rows } = useDriverRows();
  const [view, setView] = useState<{ row: Row; target: Target } | null>(null);
  const next = nextStop(rows);
  const nextUrl = next ? directionsUrl((next.target === 'pickup' ? next.row.pickup : next.row.drop)?.latitude, (next.target === 'pickup' ? next.row.pickup : next.row.drop)?.longitude) : null;

  if (mine.error) return <ErrorState message={mine.error} onRetry={mine.reload} />;
  if (mine.loading && !mine.data) return <Skeleton className="h-64" />;
  const a = mine.data;

  return (
    <>
      <PageHeader
        title="Assigned students"
        subtitle={a ? `${rows.length} students on bus ${a.vehicle.busNumber} · ${a.route.name}` : undefined}
        actions={
          <Button
            disabled={!nextUrl}
            onClick={() => nextUrl && window.open(nextUrl, '_blank', 'noopener,noreferrer')}
            title={next ? `Next: ${next.row.student.name} (${next.target})` : 'No remaining stops with saved locations'}
          >
            <Navigation className="h-4 w-4" /> Navigate to next stop
          </Button>
        }
      />
      {next && (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand-50 px-3 py-2 text-sm text-slate-700">
          Next: <strong>{next.row.student.name}</strong> — {next.target === 'pickup' ? 'pickup' : 'drop-off'} at{' '}
          {(next.target === 'pickup' ? next.row.pickup : next.row.drop)?.address}
        </div>
      )}
      {trip.data === null && rows.length > 0 && (
        <div className="mb-4 text-xs text-slate-500">Today’s trip has not been opened yet — statuses show as pending.</div>
      )}
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="No students assigned" description="Students appear here once the administrator assigns them to your bus." />
        ) : (
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['Student', 'Stop', 'Pickup address', 'Drop-off address', 'Pickup', 'Drop', 'Map'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const pu = directionsUrl(r.pickup?.latitude, r.pickup?.longitude);
                return (
                  <tr key={r.student._id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{r.student.name}</div>
                      <div className="text-xs text-slate-500">{r.student.studentId} · {r.student.className}-{r.student.division}</div>
                    </td>
                    <td className="px-4 py-3">{r.stop || '—'}</td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-600">{r.pickup?.address || <span className="text-slate-500">No approved request</span>}</td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-600">{r.drop?.address || '—'}</td>
                    <td className="px-4 py-3"><Badge value={r.attendance?.pickupStatus || 'pending'} /></td>
                    <td className="px-4 py-3"><Badge value={r.attendance?.dropStatus || 'pending'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" disabled={r.pickup?.latitude === undefined} onClick={() => setView({ row: r, target: 'pickup' })}>
                          <MapPin className="h-3.5 w-3.5" /> View Pickup on Map
                        </Button>
                        <Button size="sm" variant="secondary" disabled={r.drop?.latitude === undefined} onClick={() => setView({ row: r, target: 'drop' })}>
                          <MapPin className="h-3.5 w-3.5" /> View Drop Location
                        </Button>
                        <Button size="sm" variant="ghost" disabled={!pu} onClick={() => pu && window.open(pu, '_blank', 'noopener,noreferrer')}>
                          Open in Google Maps
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <DriverLocationDialog row={view?.row || null} target={view?.target || 'pickup'} onClose={() => setView(null)} />
    </>
  );
}
