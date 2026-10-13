import { FormEvent, useState } from 'react';
import { Download, FileText, Plus, Trash2, UserPlus } from 'lucide-react';
import { DataTable, Toolbar, useListState } from '../../components/CrudPage';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, SkeletonRows } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { del, downloadReport, get, parseError, patch, post } from '../../services/api';
import type { AttendanceRecord, Assignment, Complaint, DriverProfile, Problem, RouteDoc, StudentProfile, TransportRequest, Trip, Vehicle } from '../../types';
import { fmtDate, fmtDateTime, fmtTime, titleCase, todayISO } from '../../utils/format';
import { ProfileForm, PasswordForm } from '../shared/ProfilePage';
import { LocationChangesAdmin, RequestMap } from './AdminLocations';

const opt = (arr: string[]) => arr.map((s) => ({ value: s, label: titleCase(s) }));

function FormError({ msg }: { msg: string }) {
  return msg ? (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{msg}</div>
  ) : null;
}

/* ---------- Transport requests ---------- */
export function AdminRequests() {
  const toast = useToast();
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<TransportRequest[]>('/transport-requests', state.params, { interval: 30000 });
  const [reviewing, setReviewing] = useState<TransportRequest | null>(null);
  const [tab, setTab] = useState<'requests' | 'changes'>('requests');
  const [mapFor, setMapFor] = useState<TransportRequest | null>(null);
  const { data: assignments } = useFetch<Assignment[]>(reviewing ? '/assignments' : null, { status: 'active', limit: 100 });
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [assignment, setAssignment] = useState('');
  const [stop, setStop] = useState('');
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const openReview = (r: TransportRequest) => {
    setReviewing(r);
    setDecision('approved');
    setAssignment('');
    setStop('');
    setRemarks('');
    setErr('');
  };
  const chosen = assignments?.find((a) => a._id === assignment);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await patch(`/transport-requests/${reviewing!._id}/review`, {
        decision,
        remarks: remarks || undefined,
        ...(decision === 'approved' && assignment ? { assignment, stop: stop || undefined } : {}),
      });
      toast.success(`Request ${decision}. Student notified.`);
      setReviewing(null);
      reload();
    } catch (e2) {
      setErr(parseError(e2).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Transport requests" subtitle="Approve or reject student requests, assign a bus and review location changes." />
      <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-sm" role="tablist">
        {([['requests', 'Requests'], ['changes', 'Location changes']] as const).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 font-medium transition ${tab === k ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === 'changes' && <LocationChangesAdmin />}
      <div className={tab === 'changes' ? 'hidden' : 'card overflow-hidden'}>
        <Toolbar state={state} placeholder="Search location…" filters={[{ name: 'status', label: 'Status', options: opt(['pending', 'approved', 'rejected', 'cancelled']) }]} />
        <DataTable<TransportRequest>
          columns={[
            { key: 'createdAt', header: 'Date', sortable: true, render: (r) => fmtDate(r.createdAt) },
            { key: 'student', header: 'Student', render: (r) => `${r.student?.name} (${r.student?.studentId})` },
            { key: 'pickupLocation', header: 'Pickup', render: (r) => <div className="max-w-[220px]"><div>{r.pickupLocation}</div>{r.pickup?.latitude !== undefined && <div className="text-xs text-slate-500">{r.pickup.latitude.toFixed(5)}, {r.pickup.longitude!.toFixed(5)}</div>}</div> },
            { key: 'dropLocation', header: 'Drop', render: (r) => <div className="max-w-[220px]"><div>{r.dropLocation}</div>{r.drop?.latitude !== undefined && <div className="text-xs text-slate-500">{r.drop.latitude.toFixed(5)}, {r.drop.longitude!.toFixed(5)}</div>}</div> },
            { key: 'map', header: 'Map', render: (r) => <Button size="sm" variant="secondary" onClick={() => setMapFor(r)}>View map</Button> },
            { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge value={r.status} /> },
            { key: 'a', header: '', className: 'text-right', render: (r) => r.status === 'pending' ? <Button size="sm" onClick={() => openReview(r)}>Review</Button> : <span className="text-xs text-slate-400">{r.remarks}</span> },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No transport requests"
        />
      </div>
      <Modal open={!!reviewing} title="Review transport request" onClose={() => setReviewing(null)} wide>
        {reviewing && (
          <form onSubmit={submit} className="space-y-4">
            <FormError msg={err} />
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium">{reviewing.student.name} · {reviewing.student.studentId} · Class {reviewing.student.className}-{reviewing.student.division}</div>
              <div className="mt-1">Pickup: {reviewing.pickupLocation}</div>
              <div>Drop: {reviewing.dropLocation}</div>
              <div className="mt-3"><RequestMap r={reviewing} /></div>
              {reviewing.notes && <div className="mt-1 text-slate-500">Notes: {reviewing.notes}</div>}
            </div>
            <Field label="Decision">
              <select className="input" value={decision} onChange={(e) => setDecision(e.target.value as any)}>
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </Field>
            {decision === 'approved' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assign to bus" hint="Optional — you can also assign later from Assignments">
                  <select className="input" value={assignment} onChange={(e) => { setAssignment(e.target.value); setStop(''); }}>
                    <option value="">Approve without a bus</option>
                    {assignments?.map((a) => (
                      <option key={a._id} value={a._id} disabled={a.riders.length >= a.vehicle.capacity}>
                        {a.vehicle.busNumber} · {a.route.name} · {a.driver.name} ({a.riders.length}/{a.vehicle.capacity})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Stop">
                  <select className="input" value={stop} onChange={(e) => setStop(e.target.value)} disabled={!chosen}>
                    <option value="">Select stop…</option>
                    {chosen?.route.stops.map((s) => <option key={s.sequence}>{s.name}</option>)}
                  </select>
                </Field>
              </div>
            )}
            <Field label="Remarks">
              <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button type="submit" loading={saving} variant={decision === 'rejected' ? 'danger' : 'primary'}>
                {decision === 'approved' ? 'Approve' : 'Reject'} request
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal open={!!mapFor} title="Requested locations" onClose={() => setMapFor(null)} wide>
        {mapFor && <RequestMap r={mapFor} />}
      </Modal>
    </>
  );
}

/* ---------- Assignments ---------- */
export function AdminAssignments() {
  const toast = useToast();
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<Assignment[]>('/assignments', state.params);
  const [formOpen, setFormOpen] = useState<null | 'create' | Assignment>(null);
  const [managing, setManaging] = useState<string | null>(null);
  const [ending, setEnding] = useState<Assignment | null>(null);

  return (
    <>
      <PageHeader
        title="Bus assignments"
        subtitle="Match a vehicle with a driver and route, then add students."
        actions={<Button onClick={() => setFormOpen('create')}><Plus className="h-4 w-4" /> New assignment</Button>}
      />
      <div className="card overflow-hidden">
        <Toolbar state={state} filters={[{ name: 'status', label: 'Status', options: opt(['active', 'ended']) }]} extra={null} placeholder="Filter…" />
        <DataTable<Assignment>
          columns={[
            { key: 'vehicle', header: 'Bus', render: (a) => `${a.vehicle?.busNumber} · ${a.vehicle?.registrationNumber}` },
            { key: 'driver', header: 'Driver', render: (a) => a.driver?.name },
            { key: 'route', header: 'Route', render: (a) => a.route?.name },
            { key: 'riders', header: 'Students', render: (a) => `${a.riders.length}/${a.vehicle?.capacity}` },
            { key: 'status', header: 'Status', sortable: true, render: (a) => <Badge value={a.status} /> },
            {
              key: 'a', header: 'Actions', className: 'text-right whitespace-nowrap',
              render: (a) => a.status === 'active' ? (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setManaging(a._id)}>Students</Button>
                  <Button size="sm" variant="ghost" onClick={() => setFormOpen(a)}>Change</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEnding(a)}>End</Button>
                </div>
              ) : <span className="text-xs text-slate-400">Ended {fmtDate(a.endDate)}</span>,
            },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No assignments yet"
          emptyDescription="Create an assignment to link a bus, driver and route."
        />
      </div>

      <AssignmentForm
        target={formOpen}
        onClose={() => setFormOpen(null)}
        onSaved={() => { setFormOpen(null); reload(); }}
      />
      <RidersModal id={managing} onClose={() => { setManaging(null); reload(); }} />
      <ConfirmDialog
        open={!!ending}
        danger
        title="End assignment"
        confirmLabel="End assignment"
        message={<>End the assignment of bus <strong>{ending?.vehicle.busNumber}</strong>? Students will no longer be on this bus; past trips and attendance remain in history.</>}
        onCancel={() => setEnding(null)}
        onConfirm={async () => {
          try {
            await post(`/assignments/${ending!._id}/end`);
            toast.success('Assignment ended');
            reload();
          } catch (e) {
            toast.error(parseError(e).message);
          }
          setEnding(null);
        }}
      />
    </>
  );
}

function AssignmentForm({ target, onClose, onSaved }: { target: null | 'create' | Assignment; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const open = target !== null;
  const editing = target && target !== 'create' ? target : null;
  const { data: vehicles } = useFetch<Vehicle[]>(open ? '/vehicles' : null, { limit: 100, sort: 'busNumber' });
  const { data: drivers } = useFetch<DriverProfile[]>(open ? '/drivers' : null, { status: 'active', limit: 100, sort: 'name' });
  const { data: routes } = useFetch<RouteDoc[]>(open ? '/routes/options' : null);
  const [v, setV] = useState({ vehicle: '', driver: '', route: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  // reset when the dialog target changes
  const targetKey = editing ? editing._id : target;
  if (key !== String(targetKey)) {
    setKey(String(targetKey));
    setV(editing ? { vehicle: editing.vehicle._id, driver: editing.driver._id, route: editing.route._id } : { vehicle: '', driver: '', route: '' });
    setErr('');
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.vehicle || !v.driver || !v.route) return setErr('Select a bus, a driver and a route');
    setSaving(true);
    setErr('');
    try {
      if (editing) await patch(`/assignments/${editing._id}`, v);
      else await post('/assignments', v);
      toast.success(editing ? 'Assignment updated' : 'Assignment created');
      onSaved();
    } catch (e2) {
      setErr(parseError(e2).message);
    } finally {
      setSaving(false);
    }
  };

  const usable = (vh: Vehicle) => vh.status === 'available' && (!vh.assignment || vh.assignment._id === editing?._id);
  const freeDriver = (d: DriverProfile) => !d.assignment || d.assignment._id === editing?._id;

  return (
    <Modal open={open} title={editing ? 'Change assignment' : 'New assignment'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FormError msg={err} />
        <Field label="Bus" required>
          <select className="input" value={v.vehicle} onChange={(e) => setV({ ...v, vehicle: e.target.value })}>
            <option value="">Select bus…</option>
            {vehicles?.map((vh) => (
              <option key={vh._id} value={vh._id} disabled={!usable(vh)}>
                {vh.busNumber} · {vh.registrationNumber} · {vh.capacity} seats{!usable(vh) ? ` (${vh.assignment ? 'assigned' : vh.status})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Driver" required>
          <select className="input" value={v.driver} onChange={(e) => setV({ ...v, driver: e.target.value })}>
            <option value="">Select driver…</option>
            {drivers?.map((d) => (
              <option key={d._id} value={d._id} disabled={!freeDriver(d)}>
                {d.name} · {d.licenseNumber}{!freeDriver(d) ? ' (already assigned)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Route" required>
          <select className="input" value={v.route} onChange={(e) => setV({ ...v, route: e.target.value })}>
            <option value="">Select route…</option>
            {routes?.map((r) => <option key={r._id} value={r._id}>{r.name} ({r.stops.length} stops)</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Create assignment'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function RidersModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const toast = useToast();
  const { data: a, loading, error, reload } = useFetch<Assignment>(id ? `/assignments/${id}` : null);
  const { data: students } = useFetch<StudentProfile[]>(id ? '/students' : null, { status: 'active', limit: 100, sort: 'name' });
  const [student, setStudent] = useState('');
  const [stop, setStop] = useState('');
  const [busy, setBusy] = useState(false);
  const onBus = new Set(a?.riders.map((r) => r.student._id));

  const add = async () => {
    if (!student) return toast.error('Select a student');
    setBusy(true);
    try {
      await post(`/assignments/${id}/riders`, { student, stop: stop || undefined });
      toast.success('Student added');
      setStudent('');
      setStop('');
      reload();
    } catch (e) {
      toast.error(parseError(e).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (sid: string) => {
    try {
      await del(`/assignments/${id}/riders/${sid}`);
      toast.success('Student removed');
      reload();
    } catch (e) {
      toast.error(parseError(e).message);
    }
  };

  return (
    <Modal open={!!id} title={a ? `Students · Bus ${a.vehicle.busNumber} (${a.riders.length}/${a.vehicle.capacity})` : 'Students'} onClose={onClose} wide>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !a ? <SkeletonRows rows={3} /> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <Field label="Student">
                <select className="input" value={student} onChange={(e) => setStudent(e.target.value)}>
                  <option value="">Select student…</option>
                  {students?.map((s) => <option key={s._id} value={s._id} disabled={onBus.has(s._id)}>{s.name} · {s.studentId}{onBus.has(s._id) ? ' (on this bus)' : s.transport ? ` (on ${s.transport.vehicle.busNumber})` : ''}</option>)}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Stop">
                <select className="input" value={stop} onChange={(e) => setStop(e.target.value)}>
                  <option value="">Select stop…</option>
                  {a.route.stops.map((s) => <option key={s.sequence}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex items-end">
              <Button onClick={add} loading={busy} className="w-full"><UserPlus className="h-4 w-4" /> Add</Button>
            </div>
          </div>
          {a.riders.length === 0 ? (
            <EmptyState title="No students on this bus" />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {a.riders.map((r) => (
                <li key={r.student._id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{r.student.name}</div>
                    <div className="text-xs text-slate-500">{r.student.studentId} · Stop: {r.stop || '—'}</div>
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${r.student.name}`} onClick={() => remove(r.student._id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ---------- Trips ---------- */
export function AdminTrips() {
  const toast = useToast();
  const state = useListState('-date');
  const [date, setDate] = useState('');
  const { data, meta, loading, error, reload } = useFetch<Trip[]>('/trips', { ...state.params, date });
  const [creating, setCreating] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const { data: asg } = useFetch<Assignment[]>(creating ? '/assignments' : null, { status: 'active', limit: 100 });
  const [form, setForm] = useState({ assignment: '', date: todayISO() });
  const [saving, setSaving] = useState(false);
  const { data: detail, loading: dl } = useFetch<Trip>(viewId ? `/trips/${viewId}` : null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.assignment) return toast.error('Select a bus assignment');
    setSaving(true);
    try {
      await post('/trips', form);
      toast.success('Trip scheduled');
      setCreating(false);
      reload();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Trips" subtitle="Daily trips created by drivers or scheduled by you." actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Schedule trip</Button>} />
      <div className="card overflow-hidden">
        <Toolbar
          state={state}
          placeholder="Filter…"
          filters={[{ name: 'status', label: 'Status', options: opt(['scheduled', 'in_progress', 'completed', 'cancelled']) }]}
          extra={<input type="date" aria-label="Date" className="input w-auto" value={date} onChange={(e) => { setDate(e.target.value); state.setPage(1); }} />}
        />
        <DataTable<Trip>
          columns={[
            { key: 'date', header: 'Date', sortable: true, render: (t) => fmtDate(t.date) },
            { key: 'vehicle', header: 'Bus', render: (t) => t.vehicle?.busNumber },
            { key: 'driver', header: 'Driver', render: (t) => t.driver?.name },
            { key: 'route', header: 'Route', render: (t) => t.route?.name },
            { key: 'summary', header: 'Progress', render: (t) => t.summary ? `${t.summary.pickedUp}/${t.summary.total} picked · ${t.summary.dropped} dropped` : '—' },
            { key: 'status', header: 'Status', sortable: true, render: (t) => <Badge value={t.status} /> },
            { key: 'a', header: '', className: 'text-right', render: (t) => <Button size="sm" variant="secondary" onClick={() => setViewId(t._id)}>Details</Button> },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No trips yet"
        />
      </div>

      <Modal open={creating} title="Schedule trip" onClose={() => setCreating(false)}>
        <form onSubmit={create} className="space-y-4">
          <Field label="Bus assignment" required>
            <select className="input" value={form.assignment} onChange={(e) => setForm({ ...form, assignment: e.target.value })}>
              <option value="">Select…</option>
              {asg?.map((a) => <option key={a._id} value={a._id}>{a.vehicle.busNumber} · {a.route.name} · {a.driver.name}</option>)}
            </select>
          </Field>
          <Field label="Date" required>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Schedule</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewId} title="Trip details" onClose={() => setViewId(null)} wide>
        {dl || !detail ? <SkeletonRows rows={3} /> : (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              {fmtDate(detail.date)} · Bus {detail.vehicle.busNumber} · {detail.driver.name} · {detail.route.name} · <Badge value={detail.status} />
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Stop</th><th className="px-3 py-2">Pickup</th><th className="px-3 py-2">Drop</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.attendance?.map((a) => (
                    <tr key={a._id}>
                      <td className="px-3 py-2">{a.student.name}</td>
                      <td className="px-3 py-2">{a.stop || '—'}</td>
                      <td className="px-3 py-2"><Badge value={a.pickupStatus} /> <span className="text-xs text-slate-400">{fmtTime(a.pickupAt)}</span></td>
                      <td className="px-3 py-2"><Badge value={a.dropStatus} /> <span className="text-xs text-slate-400">{fmtTime(a.dropAt)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ---------- Attendance monitoring ---------- */
export function AdminAttendance() {
  const toast = useToast();
  const state = useListState('-date');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, meta, loading, error, reload } = useFetch<AttendanceRecord[]>('/attendance', { ...state.params, from, to }, { interval: 30000 });
  const [edit, setEdit] = useState<AttendanceRecord | null>(null);
  const [pickup, setPickup] = useState('pending');
  const [drop, setDrop] = useState('pending');

  return (
    <>
      <PageHeader title="Attendance monitoring" subtitle="Pickup and drop-off records across all buses." />
      <div className="card overflow-hidden">
        <Toolbar
          state={state}
          placeholder="Filter…"
          filters={[
            { name: 'pickupStatus', label: 'Pickup', options: opt(['pending', 'picked_up', 'absent', 'not_available']) },
            { name: 'dropStatus', label: 'Drop', options: opt(['pending', 'dropped']) },
          ]}
          extra={
            <>
              <input type="date" aria-label="From date" className="input w-auto" value={from} onChange={(e) => { setFrom(e.target.value); state.setPage(1); }} />
              <input type="date" aria-label="To date" className="input w-auto" value={to} onChange={(e) => { setTo(e.target.value); state.setPage(1); }} />
            </>
          }
        />
        <DataTable<AttendanceRecord>
          columns={[
            { key: 'date', header: 'Date', sortable: true, render: (r) => fmtDate(r.date) },
            { key: 'student', header: 'Student', render: (r) => `${r.student?.name} (${r.student?.studentId})` },
            { key: 'bus', header: 'Bus', render: (r) => r.vehicle?.busNumber || '—' },
            { key: 'driver', header: 'Driver', render: (r) => r.driver?.name || '—' },
            { key: 'pickupStatus', header: 'Pickup', sortable: true, render: (r) => <><Badge value={r.pickupStatus} /> <span className="text-xs text-slate-400">{fmtTime(r.pickupAt)}</span></> },
            { key: 'dropStatus', header: 'Drop', sortable: true, render: (r) => <><Badge value={r.dropStatus} /> <span className="text-xs text-slate-400">{fmtTime(r.dropAt)}</span></> },
            { key: 'a', header: '', className: 'text-right', render: (r) => <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setPickup(r.pickupStatus); setDrop(r.dropStatus); }}>Correct</Button> },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No attendance records"
          emptyDescription="Records are created when drivers open their daily trip."
        />
      </div>
      <Modal open={!!edit} title="Correct attendance" onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600">{edit.student.name} · {fmtDate(edit.date)}</div>
            <Field label="Pickup status">
              <select className="input" value={pickup} onChange={(e) => setPickup(e.target.value)}>{opt(['pending', 'picked_up', 'absent', 'not_available']).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </Field>
            <Field label="Drop status">
              <select className="input" value={drop} onChange={(e) => setDrop(e.target.value)}>{opt(['pending', 'dropped']).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  await patch(`/attendance/${edit._id}`, { pickupStatus: pickup, dropStatus: drop });
                  toast.success('Attendance updated');
                  setEdit(null);
                  reload();
                } catch (e) { toast.error(parseError(e).message); }
              }}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ---------- Complaints ---------- */
export function AdminComplaints() {
  const toast = useToast();
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<Complaint[]>('/complaints', state.params, { interval: 30000 });
  const [sel, setSel] = useState<Complaint | null>(null);
  const [status, setStatus] = useState('in_review');
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <>
      <PageHeader title="Complaints" subtitle="Review and resolve student and driver complaints." />
      <div className="card overflow-hidden">
        <Toolbar
          state={state}
          placeholder="Search complaints…"
          filters={[
            { name: 'status', label: 'Status', options: opt(['open', 'in_review', 'resolved', 'rejected']) },
            { name: 'role', label: 'From', options: opt(['student', 'driver']) },
            { name: 'category', label: 'Category', options: opt(['driver', 'vehicle', 'route', 'timing', 'safety', 'other']) },
          ]}
        />
        <DataTable<Complaint>
          columns={[
            { key: 'createdAt', header: 'Date', sortable: true, render: (c) => fmtDate(c.createdAt) },
            { key: 'user', header: 'From', render: (c) => `${c.user?.name || '—'} (${c.role})` },
            { key: 'subject', header: 'Subject', sortable: true },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'status', header: 'Status', sortable: true, render: (c) => <Badge value={c.status} /> },
            { key: 'a', header: '', className: 'text-right', render: (c) => <Button size="sm" variant="secondary" onClick={() => { setSel(c); setStatus(c.status === 'open' ? 'in_review' : c.status); setResponse(c.adminResponse || ''); }}>Review</Button> },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No complaints"
        />
      </div>
      <Modal open={!!sel} title="Review complaint" onClose={() => setSel(null)}>
        {sel && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-900">{sel.subject}</div>
              <div className="mt-1 whitespace-pre-wrap text-slate-600">{sel.description}</div>
              <div className="mt-2 text-xs text-slate-400">{sel.user?.name} · {fmtDateTime(sel.createdAt)}</div>
            </div>
            <Field label="Status">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {opt(['open', 'in_review', 'resolved', 'rejected']).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Response to the user">
              <textarea className="input" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSel(null)}>Cancel</Button>
              <Button loading={saving} onClick={async () => {
                setSaving(true);
                try {
                  await patch(`/complaints/${sel._id}`, { status, adminResponse: response || undefined });
                  toast.success('Complaint updated. User notified.');
                  setSel(null);
                  reload();
                } catch (e) { toast.error(parseError(e).message); } finally { setSaving(false); }
              }}>Update complaint</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ---------- Vehicle problems ---------- */
export function AdminProblems() {
  const toast = useToast();
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<Problem[]>('/vehicle-problems', state.params, { interval: 30000 });
  const [sel, setSel] = useState<Problem | null>(null);
  const [status, setStatus] = useState('in_review');
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('none');
  const [saving, setSaving] = useState(false);

  return (
    <>
      <PageHeader title="Vehicle problems" subtitle="Breakdowns, delays and incidents reported by drivers." />
      <div className="card overflow-hidden">
        <Toolbar
          state={state}
          placeholder="Search description…"
          filters={[
            { name: 'status', label: 'Status', options: opt(['reported', 'in_review', 'resolved', 'dismissed']) },
            { name: 'type', label: 'Type', options: opt(['breakdown', 'traffic_delay', 'accident', 'mechanical_issue', 'other']) },
          ]}
        />
        <DataTable<Problem>
          columns={[
            { key: 'createdAt', header: 'Date', sortable: true, render: (p) => fmtDateTime(p.createdAt) },
            { key: 'vehicle', header: 'Bus', render: (p) => <>{p.vehicle?.busNumber} <Badge value={p.vehicle?.status} /></> },
            { key: 'driver', header: 'Driver', render: (p) => p.driver?.name },
            { key: 'type', header: 'Type', sortable: true, render: (p) => titleCase(p.type) },
            { key: 'severity', header: 'Severity', sortable: true, render: (p) => <Badge value={p.severity} /> },
            { key: 'status', header: 'Status', sortable: true, render: (p) => <Badge value={p.status} /> },
            { key: 'a', header: '', className: 'text-right', render: (p) => <Button size="sm" variant="secondary" onClick={() => { setSel(p); setStatus(p.status === 'reported' ? 'in_review' : p.status); setNotes(p.adminNotes || ''); setAction('none'); }}>Review</Button> },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No problem reports"
        />
      </div>
      <Modal open={!!sel} title="Review problem report" onClose={() => setSel(null)}>
        {sel && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-900">{titleCase(sel.type)} · Bus {sel.vehicle.busNumber}</div>
              <div className="mt-1 text-slate-600">{sel.description}</div>
              {sel.delayMinutes ? <div className="mt-1 text-xs text-slate-500">Delay: {sel.delayMinutes} min</div> : null}
              <div className="mt-2 text-xs text-slate-400">Reported by {sel.driver.name} · {fmtDateTime(sel.createdAt)}</div>
            </div>
            <Field label="Status">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {opt(['reported', 'in_review', 'resolved', 'dismissed']).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Vehicle availability">
              <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="none">No change (currently {sel.vehicle.status})</option>
                <option value="mark_unavailable">Mark vehicle unavailable</option>
                <option value="mark_available">Mark vehicle available</option>
              </select>
            </Field>
            <Field label="Admin notes">
              <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSel(null)}>Cancel</Button>
              <Button loading={saving} onClick={async () => {
                setSaving(true);
                try {
                  await patch(`/vehicle-problems/${sel._id}`, { status, adminNotes: notes || undefined, vehicleAction: action });
                  toast.success('Report updated');
                  setSel(null);
                  reload();
                } catch (e) { toast.error(parseError(e).message); } finally { setSaving(false); }
              }}>Update report</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ---------- Reports ---------- */
const REPORTS = [
  { value: 'students', label: 'Student transport', dated: 'Registered date' },
  { value: 'drivers', label: 'Drivers', dated: 'Created date' },
  { value: 'vehicles', label: 'Vehicles', dated: 'Created date' },
  { value: 'attendance', label: 'Attendance', dated: 'Trip date' },
  { value: 'requests', label: 'Transport requests', dated: 'Request date' },
  { value: 'complaints', label: 'Complaints', dated: 'Submitted date' },
  { value: 'vehicle-problems', label: 'Vehicle problems', dated: 'Reported date' },
];

export function AdminReports() {
  const toast = useToast();
  const [type, setType] = useState('students');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<{ title: string; columns: { key: string; label: string }[]; rows: Record<string, string | number>[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const generate = async (e?: FormEvent) => {
    e?.preventDefault();
    if (from && to && from > to) return setError('"From" date must not be after "To" date');
    setLoading(true);
    setError('');
    try {
      const r = await get<any>(`/reports/${type}`, { from: from || undefined, to: to || undefined });
      setReport(r.data);
    } catch (err) {
      setError(parseError(err).message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const exportAs = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    try {
      await downloadReport(type, format, { from: from || undefined, to: to || undefined });
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setExporting('');
    }
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate reports from live data and export them." />
      <form onSubmit={generate} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <Field label="Report type">
          <select className="input" value={type} onChange={(e) => { setType(e.target.value); setReport(null); }}>
            {REPORTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="From"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button type="submit" loading={loading}><FileText className="h-4 w-4" /> Generate</Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={!report} loading={exporting === 'csv'} onClick={() => exportAs('csv')}><Download className="h-4 w-4" /> CSV</Button>
          <Button type="button" variant="secondary" disabled={!report} loading={exporting === 'pdf'} onClick={() => exportAs('pdf')}><Download className="h-4 w-4" /> PDF</Button>
        </div>
      </form>
      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={() => generate()} /> : loading ? <SkeletonRows /> : !report ? (
          <EmptyState title="No report generated" description="Choose a report type and date range, then click Generate." />
        ) : (
          <>
            <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-navy-900">{report.title}</span> · {report.rows.length} record(s)
              {REPORTS.find((r) => r.value === type) && (from || to) ? ` · ${REPORTS.find((r) => r.value === type)!.dated} ${from || '…'} to ${to || '…'}` : ''}
            </div>
            {report.rows.length === 0 ? <EmptyState title="No records match the selected filters" /> : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>{report.columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        {report.columns.map((c) => <td key={c.key} className="px-4 py-2.5 text-slate-700">{String(r[c.key] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Settings ---------- */
export function AdminSettings() {
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<any[]>('/dashboard/audit-logs', state.params);
  return (
    <>
      <PageHeader title="Profile & settings" subtitle="Your account and the system audit trail." />
      <div className="space-y-6">
        <ProfileForm />
        <PasswordForm />
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 p-4 text-base font-semibold text-navy-900">Audit log</div>
          <Toolbar state={state} placeholder="Search action or entity…" />
          <DataTable<any>
            columns={[
              { key: 'createdAt', header: 'When', render: (l) => fmtDateTime(l.createdAt) },
              { key: 'actor', header: 'User', render: (l) => l.actor?.name || '—' },
              { key: 'actorRole', header: 'Role' },
              { key: 'action', header: 'Action' },
              { key: 'entity', header: 'Entity' },
            ]}
            rows={data}
            loading={loading}
            error={error}
            onRetry={reload}
            state={state}
            meta={meta}
            emptyTitle="No audit entries"
          />
        </div>
      </div>
    </>
  );
}
