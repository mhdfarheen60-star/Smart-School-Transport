import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Bus, CalendarCheck, CheckCircle2, MessageSquareWarning, Phone, Send, User, XCircle } from 'lucide-react';
import { DataTable, Toolbar, useListState } from '../../components/CrudPage';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { parseError, patch, post } from '../../services/api';
import type { AttendanceRecord, Complaint, NotificationDoc, Stop, TransportRequest as TReq } from '../../types';
import { fmtDate, fmtDateTime, fmtTime } from '../../utils/format';
import LocationPicker from '../../components/LocationPicker';
import type { LocationValue } from '../../utils/maps';
import { LocationsPanel } from './LocationsPanel';

/* ---------- Dashboard ---------- */
export function StudentDashboard() {
  const { data, loading, error, reload } = useFetch<any>('/dashboard/student', undefined, { interval: 30000 });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  const { student, transport, pendingRequest, lastRequest, unreadNotifications, notifications, attendance, openComplaints } = data;
  return (
    <>
      <PageHeader title={`Hello, ${student.name.split(' ')[0]}`} subtitle={`Student ID ${student.studentId} · Class ${student.className}-${student.division}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pickups" value={attendance.pickedUp} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Absent" value={attendance.absent} icon={<XCircle className="h-5 w-5" />} tone="red" />
        <StatCard label="Unread alerts" value={unreadNotifications} icon={<Bell className="h-5 w-5" />} tone="amber" />
        <StatCard label="Open complaints" value={openComplaints} icon={<MessageSquareWarning className="h-5 w-5" />} tone="navy" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-navy-900">Transport status</h2>
          {transport ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info label="Bus" value={`${transport.vehicle.busNumber} · ${transport.vehicle.registrationNumber}`} />
              <Info label="Driver" value={`${transport.driver.name} · ${transport.driver.phone}`} />
              <Info label="Route" value={transport.route} />
              <Info label="Stop / Pickup time" value={`${transport.stop || '—'} · ${transport.pickupTime || '—'}`} />
            </dl>
          ) : pendingRequest ? (
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              Your request submitted on {fmtDate(pendingRequest.createdAt)} is <strong>pending</strong> admin review.
            </div>
          ) : (
            <EmptyState
              title="No transport assigned"
              description={lastRequest?.status === 'rejected' ? `Last request was rejected${lastRequest.remarks ? `: ${lastRequest.remarks}` : ''}.` : 'Submit a transport request to get started.'}
              action={<Link to="/student/request"><Button>Request transport</Button></Link>}
            />
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-base font-semibold text-navy-900">Latest updates</h2>
          {notifications.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {notifications.map((n: NotificationDoc) => (
                <li key={n._id} className="text-sm">
                  <div className="font-medium text-slate-800">{n.title}</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(n.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/student/notifications" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">View all</Link>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

/* ---------- Transport request ---------- */
export function TransportRequestPage() {
  const toast = useToast();
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<TReq[]>('/transport-requests', state.params);
  const [v, setV] = useState({ notes: '' });
  const [pickup, setPickup] = useState<LocationValue | undefined>();
  const [drop, setDrop] = useState<LocationValue | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<TReq | null>(null);
  const hasPending = data?.some((r) => r.status === 'pending');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pickup) errs.pickupLocation = 'Select your pickup location on the map';
    if (!drop) errs.dropLocation = 'Select your drop location on the map';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await post('/transport-requests', {
        pickupLocation: pickup,
        dropLocation: drop,
        ...(v.notes ? { notes: v.notes } : {}),
      });
      toast.success('Transport request submitted');
      setV({ notes: '' });
      setPickup(undefined);
      setDrop(undefined);
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
      <PageHeader title="Transport request" subtitle="Request school bus transport. The administrator will review and assign a bus." />
      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="card space-y-4 p-5 lg:col-span-2" noValidate>
          <h2 className="text-base font-semibold text-navy-900">New request</h2>
          {hasPending && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">You already have a pending request.</div>
          )}
          <LocationPicker
            label="Pickup location"
            kind="pickup"
            value={pickup}
            other={drop}
            error={errors.pickupLocation}
            disabled={hasPending}
            onChange={(l) => { setPickup(l); setErrors((e) => ({ ...e, pickupLocation: '' })); }}
          />
          <LocationPicker
            label="Drop location"
            kind="drop"
            value={drop}
            other={pickup}
            error={errors.dropLocation}
            disabled={hasPending}
            onChange={(l) => { setDrop(l); setErrors((e) => ({ ...e, dropLocation: '' })); }}
          />
          <Field label="Notes">
            <textarea className="input" rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
          <Button type="submit" loading={saving} disabled={hasPending} className="w-full">
            <Send className="h-4 w-4" /> Submit request
          </Button>
        </form>
        <div className="card overflow-hidden lg:col-span-3">
          <div className="border-b border-slate-200 p-4 text-base font-semibold text-navy-900">My requests</div>
          <DataTable<TReq>
            columns={[
              { key: 'createdAt', header: 'Date', render: (r) => fmtDate(r.createdAt) },
              { key: 'pickupLocation', header: 'Pickup', render: (r) => <span title={r.pickup?.latitude !== undefined ? `${r.pickup.latitude}, ${r.pickup.longitude}` : undefined}>{r.pickupLocation}</span> },
              { key: 'dropLocation', header: 'Drop', render: (r) => <span title={r.drop?.latitude !== undefined ? `${r.drop.latitude}, ${r.drop.longitude}` : undefined}>{r.dropLocation}</span> },
              { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
              { key: 'remarks', header: 'Admin remarks', render: (r) => r.remarks || '—' },
              {
                key: 'a', header: '', render: (r) =>
                  r.status === 'pending' ? <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>Cancel</Button> : null,
              },
            ]}
            rows={data}
            loading={loading}
            error={error}
            onRetry={reload}
            state={state}
            meta={meta}
            emptyTitle="No requests yet"
          />
        </div>
      </div>
      <ConfirmDialog
        open={!!cancelling}
        title="Cancel request"
        message="Cancel this pending transport request?"
        confirmLabel="Cancel request"
        danger
        onCancel={() => setCancelling(null)}
        onConfirm={async () => {
          try {
            await patch(`/transport-requests/${cancelling!._id}/cancel`);
            toast.success('Request cancelled');
            reload();
          } catch (e) {
            toast.error(parseError(e).message);
          }
          setCancelling(null);
        }}
      />
    </>
  );
}

/* ---------- Assigned transport ---------- */
export function MyTransportPage() {
  const { data, loading, error, reload } = useFetch<any>('/assignments/mine', undefined, { interval: 30000 });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-64" />;
  if (!data) {
    return (
      <>
        <PageHeader title="My transport" />
        <div className="card">
          <EmptyState
            title="No transport assigned yet"
            description="Once the administrator approves your request and assigns a bus, the details will appear here."
            action={<Link to="/student/request"><Button>Request transport</Button></Link>}
          />
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="My transport" subtitle="Your bus, driver and route details." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Bus className="h-5 w-5" /></div>
            <div>
              <div className="text-base font-semibold text-navy-900">Bus {data.vehicle.busNumber}</div>
              <div className="text-xs text-slate-500">{data.vehicle.registrationNumber}{data.vehicle.model ? ` · ${data.vehicle.model}` : ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy-50 text-navy-700"><User className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{data.driver.name}</div>
              <a href={`tel:${data.driver.phone}`} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                <Phone className="h-3 w-3" /> {data.driver.phone}
              </a>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <Info label="Your stop" value={data.stop || '—'} />
            <Info label="Pickup time" value={data.pickupTime || '—'} />
            <Info label="Drop time" value={data.dropTime || '—'} />
            <Info label="Route" value={data.route.name} />
          </dl>
        </div>
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Route · stop by stop</h2>
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6">
            {data.route.stops.map((s: Stop) => {
              const mine = s.name === data.stop;
              return (
                <li key={s.sequence} className="relative">
                  <span className={`absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${mine ? 'border-brand-600 bg-brand-600' : 'border-white/30 bg-[#0c0c0c]'}`} />
                  <div className={`text-sm font-medium ${mine ? 'text-brand-700' : 'text-slate-800'}`}>
                    {s.sequence}. {s.name} {mine && <span className="ml-1 text-xs">(your stop)</span>}
                  </div>
                  <div className="text-xs text-slate-500">Pickup {s.pickupTime || '—'} · Drop {s.dropTime || '—'}</div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <LocationsPanel />
    </>
  );
}

/* ---------- Attendance history ---------- */
export function StudentAttendancePage() {
  const state = useListState('-date');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, meta, loading, error, reload } = useFetch<AttendanceRecord[]>('/attendance', { ...state.params, from, to });
  return (
    <>
      <PageHeader title="Attendance history" subtitle="Pickup and drop-off status by date." />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <Field label="From"><input type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); state.setPage(1); }} /></Field>
          <Field label="To"><input type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); state.setPage(1); }} /></Field>
        </div>
        <DataTable<AttendanceRecord>
          columns={[
            { key: 'date', header: 'Date', sortable: true, render: (r) => fmtDate(r.date) },
            { key: 'bus', header: 'Bus', render: (r) => r.vehicle?.busNumber || '—' },
            { key: 'stop', header: 'Stop', render: (r) => r.stop || '—' },
            { key: 'pickupStatus', header: 'Pickup', sortable: true, render: (r) => <Badge value={r.pickupStatus} /> },
            { key: 'pickupAt', header: 'Pickup time', render: (r) => fmtTime(r.pickupAt) },
            { key: 'dropStatus', header: 'Drop-off', sortable: true, render: (r) => <Badge value={r.dropStatus} /> },
            { key: 'dropAt', header: 'Drop time', render: (r) => fmtTime(r.dropAt) },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No attendance records yet"
          emptyDescription="Records appear after the driver marks your pickup."
        />
      </div>
      <CalendarCheck className="hidden" />
    </>
  );
}

/* ---------- Complaints (student + driver) ---------- */
export function ComplaintsPage() {
  const toast = useToast();
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<Complaint[]>('/complaints', state.params, { interval: 30000 });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ subject: '', description: '', category: 'other' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.subject.trim().length < 3) errs.subject = 'Subject is too short';
    if (v.description.trim().length < 10) errs.description = 'Please describe the issue (min 10 characters)';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await post('/complaints', v);
      toast.success('Complaint submitted');
      setOpen(false);
      setV({ subject: '', description: '', category: 'other' });
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
      <PageHeader title="Complaints" subtitle="Submit and track your complaints." actions={<Button onClick={() => setOpen(true)}>New complaint</Button>} />
      <div className="card overflow-hidden">
        <Toolbar
          state={state}
          placeholder="Search complaints…"
          filters={[{ name: 'status', label: 'Status', options: ['open', 'in_review', 'resolved', 'rejected'].map((s) => ({ value: s, label: s.replace('_', ' ') })) }]}
        />
        <DataTable<Complaint>
          columns={[
            { key: 'createdAt', header: 'Date', render: (r) => fmtDate(r.createdAt) },
            { key: 'subject', header: 'Subject', sortable: true },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge value={r.status} /> },
            { key: 'adminResponse', header: 'Response', render: (r) => r.adminResponse || '—' },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No complaints submitted"
        />
      </div>
      <Modal open={open} title="Submit a complaint" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Category">
            <select className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
              {['driver', 'vehicle', 'route', 'timing', 'safety', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Subject" error={errors.subject} required>
            <input className="input" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} />
          </Field>
          <Field label="Description" error={errors.description} required>
            <textarea className="input" rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
