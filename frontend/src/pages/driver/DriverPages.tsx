import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, Bus, CheckCircle2, Navigation, Phone, Play, Users, XCircle } from 'lucide-react';
import { DataTable, useListState } from '../../components/CrudPage';
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { parseError, patch, post } from '../../services/api';
import type { AttendanceRecord, Problem, Stop, Trip } from '../../types';
import { fmtDate, fmtTime, titleCase } from '../../utils/format';
import LocationMap from '../../components/LocationMap';
import { directionsUrl, PICKUP_COLOR } from '../../utils/maps';

/* ---------- Dashboard ---------- */
export function DriverDashboard() {
  const { data, loading, error, reload } = useFetch<any>('/dashboard/driver', undefined, { interval: 30000 });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  }
  const { driver, assignment, trip, progress, unreadNotifications, openProblems, date } = data;
  return (
    <>
      <PageHeader title={`Hello, ${driver.name.split(' ')[0]}`} subtitle={`Today · ${fmtDate(date)}`} />
      {!assignment ? (
        <div className="card">
          <EmptyState title="No bus assigned" description="The administrator has not assigned you to a bus yet. You will be notified when this happens." />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Students on bus" value={assignment.studentCount} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Picked up today" value={`${progress.pickedUp}/${progress.total}`} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
            <StatCard label="Absent today" value={progress.absent} icon={<XCircle className="h-5 w-5" />} tone="red" />
            <StatCard label="Dropped off" value={`${progress.dropped}/${progress.total}`} icon={<Navigation className="h-5 w-5" />} tone="navy" />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-navy-900">Assigned bus</h2>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Bus className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Bus {assignment.vehicle.busNumber}</div>
                  <div className="text-xs text-slate-500">{assignment.vehicle.registrationNumber} · capacity {assignment.vehicle.capacity}</div>
                </div>
              </div>
              <div className="mt-3"><Badge value={assignment.vehicle.status} /></div>
              <div className="mt-4 text-sm text-slate-600">Route: <strong>{assignment.route.name}</strong></div>
              <div className="mt-4 flex gap-2">
                <Link to="/driver/trip"><Button><Play className="h-4 w-4" /> {trip ? 'Open trip' : 'Start today’s trip'}</Button></Link>
              </div>
              <div className="mt-4 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Bell className="h-3 w-3" /> {unreadNotifications} unread</span>
                <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {openProblems} open reports</span>
              </div>
            </div>
            <div className="card p-5 lg:col-span-2">
              <h2 className="mb-4 text-base font-semibold text-navy-900">Today’s schedule</h2>
              <ol className="space-y-3">
                {assignment.route.stops.map((s: Stop) => (
                  <li key={s.sequence} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{s.sequence}. {s.name}</span>
                    <span className="text-xs text-slate-500">Pickup {s.pickupTime || '—'} · Drop {s.dropTime || '—'}</span>
                  </li>
                ))}
              </ol>
              {trip && (
                <div className="mt-4 text-sm text-slate-600">
                  Trip status: <Badge value={trip.status} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Today’s trip: pickup / drop ---------- */
export function TodayTripPage() {
  const toast = useToast();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const open = async () => {
    setLoading(true);
    setError('');
    try {
      setTrip(await post<Trip>('/trips/today'));
    } catch (e) {
      setError(parseError(e).message);
    } finally {
      setLoading(false);
    }
  };

  // Open (or re-open) the trip when the page is first shown.
  useEffect(() => {
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mark = async (rec: AttendanceRecord, kind: 'pickup' | 'drop', status: string) => {
    setBusyId(rec._id + kind + status);
    try {
      const updated = await patch<AttendanceRecord>(`/attendance/${rec._id}/${kind}`, { status });
      setTrip((t) =>
        t ? { ...t, status: t.status === 'scheduled' ? 'in_progress' : t.status, attendance: t.attendance!.map((a) => (a._id === rec._id ? { ...a, ...updated } : a)) } : t
      );
      toast.success(`${rec.student.name}: ${titleCase(status)}`);
    } catch (e) {
      toast.error(parseError(e).message);
    } finally {
      setBusyId('');
    }
  };

  const setStatus = async (status: 'in_progress' | 'completed') => {
    try {
      await patch(`/trips/${trip!._id}/status`, { status });
      toast.success(status === 'completed' ? 'Trip completed' : 'Trip started');
      open();
    } catch (e) {
      toast.error(parseError(e).message);
    }
  };

  if (loading && !trip) return <Skeleton className="h-72" />;
  if (error) {
    return (
      <>
        <PageHeader title="Today’s trip" />
        <div className="card"><ErrorState message={error} onRetry={open} /></div>
      </>
    );
  }
  if (!trip) return null;
  const closed = trip.status === 'completed' || trip.status === 'cancelled';
  const att = trip.attendance || [];

  return (
    <>
      <PageHeader
        title="Today’s trip"
        subtitle={`${trip.route.name} · Bus ${trip.vehicle.busNumber} · ${fmtDate(trip.date)}`}
        actions={
          <>
            <Badge value={trip.status} />
            {trip.status === 'scheduled' && <Button variant="secondary" onClick={() => setStatus('in_progress')}><Play className="h-4 w-4" /> Start trip</Button>}
            {!closed && <Button onClick={() => setStatus('completed')}>Complete trip</Button>}
          </>
        }
      />
      {att.length === 0 ? (
        <div className="card"><EmptyState title="No students on this bus" description="Ask the administrator to assign students to your bus." /></div>
      ) : (
        <div className="grid gap-3">
          {att.map((a) => (
            <div key={a._id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{a.student.name}</div>
                <div className="text-xs text-slate-500">
                  {a.student.studentId} · Class {a.student.className}-{a.student.division} · Stop: {a.stop || '—'}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <a href={`tel:${a.student.parentPhone}`} className="inline-flex items-center gap-1 text-brand-600"><Phone className="h-3 w-3" /> {a.student.parentPhone}</a>
                  <Badge value={a.pickupStatus} label={`Pickup: ${titleCase(a.pickupStatus)}`} />
                  <Badge value={a.dropStatus} label={`Drop: ${titleCase(a.dropStatus)}`} />
                  {a.pickupAt && <span>{fmtTime(a.pickupAt)}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={a.pickupStatus === 'picked_up' ? 'primary' : 'secondary'} disabled={closed} loading={busyId === a._id + 'pickuppicked_up'} onClick={() => mark(a, 'pickup', 'picked_up')}>Picked up</Button>
                <Button size="sm" variant="secondary" disabled={closed} loading={busyId === a._id + 'pickupabsent'} onClick={() => mark(a, 'pickup', 'absent')}>Absent</Button>
                <Button size="sm" variant="secondary" disabled={closed} loading={busyId === a._id + 'pickupnot_available'} onClick={() => mark(a, 'pickup', 'not_available')}>Not available</Button>
                <Button size="sm" disabled={closed || a.pickupStatus !== 'picked_up' || a.dropStatus === 'dropped'} loading={busyId === a._id + 'dropdropped'} onClick={() => mark(a, 'drop', 'dropped')}>Dropped</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Route & vehicle ---------- */
export function DriverRoutePage() {
  const { data, loading, error, reload } = useFetch<any>('/assignments/mine');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-64" />;
  if (!data) {
    return (
      <>
        <PageHeader title="Route & vehicle" />
        <div className="card"><EmptyState title="No route assigned" /></div>
      </>
    );
  }
  const countByStop = new Map<string, number>();
  const studentsByStop = new Map<string, any[]>();
  for (const r of data.riders) studentsByStop.set(r.stop || '', [...(studentsByStop.get(r.stop || '') || []), r]);
  const pickupPoints = data.riders
    .filter((r: any) => r.locations?.pickup?.latitude !== undefined)
    .map((r: any, i: number) => ({
      lat: r.locations.pickup.latitude,
      lng: r.locations.pickup.longitude,
      label: String(i + 1),
      color: PICKUP_COLOR,
      title: r.student.name + ' — ' + r.locations.pickup.address,
    }));
  for (const r of data.riders) countByStop.set(r.stop || '', (countByStop.get(r.stop || '') || 0) + 1);
  return (
    <>
      <PageHeader title="Route & vehicle" subtitle={data.route.name} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="text-base font-semibold text-navy-900">Vehicle</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row k="Bus number" v={data.vehicle.busNumber} />
            <Row k="Registration" v={data.vehicle.registrationNumber} />
            <Row k="Model" v={data.vehicle.model || '—'} />
            <Row k="Capacity" v={`${data.riders.length}/${data.vehicle.capacity}`} />
            <div className="flex items-center justify-between"><dt className="text-slate-500">Status</dt><dd><Badge value={data.vehicle.status} /></dd></div>
          </dl>
        </div>
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Stops</h2>
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6">
            {data.route.stops.map((s: Stop) => (
              <li key={s.sequence} className="relative">
                <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-brand-600 bg-[#0c0c0c]" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-800">{s.sequence}. {s.name}</div>
                  <div className="text-xs text-slate-500">
                    Pickup {s.pickupTime || '—'} · Drop {s.dropTime || '—'} · {countByStop.get(s.name) || 0} students
                  </div>
                </div>
                {(studentsByStop.get(s.name) || []).map((r: any) => (
                  <div key={r.student._id} className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="text-slate-700">{r.student.name}</span>
                    <span className="truncate">{r.locations?.pickup?.address || 'No saved location'}</span>
                    {r.locations?.pickup?.latitude !== undefined && (
                      <a className="text-brand-600 hover:underline" target="_blank" rel="noopener noreferrer" href={directionsUrl(r.locations.pickup.latitude, r.locations.pickup.longitude) || '#'}>Directions</a>
                    )}
                  </div>
                ))}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="card mt-6 p-5">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Student pickup points</h2>
        {pickupPoints.length === 0 ? (
          <p className="text-sm text-slate-500">No students on this bus have saved pickup coordinates yet.</p>
        ) : (
          <LocationMap points={pickupPoints} height="h-[420px]" />
        )}
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-900">{v}</dd>
    </div>
  );
}

/* ---------- Problem reporting ---------- */
export function DriverProblemsPage() {
  const toast = useToast();
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<Problem[]>('/vehicle-problems', state.params, { interval: 30000 });
  const [v, setV] = useState({ type: 'breakdown', severity: 'medium', description: '', delayMinutes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.description.trim().length < 5) errs.description = 'Describe the problem (min 5 characters)';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await post('/vehicle-problems', {
        type: v.type,
        severity: v.severity,
        description: v.description,
        ...(v.delayMinutes ? { delayMinutes: Number(v.delayMinutes) } : {}),
      });
      toast.success('Problem reported. The administrator has been notified.');
      setV({ type: 'breakdown', severity: 'medium', description: '', delayMinutes: '' });
      reload();
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fields);
      toast.error(p.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Report a problem" subtitle="Breakdowns, delays, accidents or mechanical issues." />
      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="card space-y-4 p-5 lg:col-span-2" noValidate>
          <Field label="Problem type">
            <select className="input" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
              <option value="breakdown">Breakdown</option>
              <option value="traffic_delay">Traffic delay</option>
              <option value="accident">Accident</option>
              <option value="mechanical_issue">Mechanical issue</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Severity">
              <select className="input" value={v.severity} onChange={(e) => setV({ ...v, severity: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Delay (minutes)">
              <input className="input" type="number" min={0} max={600} value={v.delayMinutes} onChange={(e) => setV({ ...v, delayMinutes: e.target.value })} />
            </Field>
          </div>
          <Field label="Description" error={errors.description} required>
            <textarea className="input" rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <Button type="submit" loading={saving} className="w-full"><AlertTriangle className="h-4 w-4" /> Submit report</Button>
        </form>
        <div className="card overflow-hidden lg:col-span-3">
          <div className="border-b border-slate-200 p-4 text-base font-semibold text-navy-900">My reports</div>
          <DataTable<Problem>
            columns={[
              { key: 'createdAt', header: 'Date', render: (r) => fmtDate(r.createdAt) },
              { key: 'type', header: 'Type', render: (r) => titleCase(r.type) },
              { key: 'severity', header: 'Severity', render: (r) => <Badge value={r.severity} /> },
              { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
              { key: 'adminNotes', header: 'Admin notes', render: (r) => r.adminNotes || '—' },
            ]}
            rows={data}
            loading={loading}
            error={error}
            onRetry={reload}
            state={state}
            meta={meta}
            emptyTitle="No problems reported"
          />
        </div>
      </div>
    </>
  );
}
