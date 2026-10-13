import { FormEvent, useState } from 'react';
import { DataTable, Toolbar, useListState } from '../../components/CrudPage';
import LocationMap, { MapLinks } from '../../components/LocationMap';
import { Badge, Button, Field, Modal } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { parseError, patch } from '../../services/api';
import type { LocationChange, RouteDoc, TransportRequest } from '../../types';
import { fmtDateTime, titleCase } from '../../utils/format';
import { DROP_COLOR, NEUTRAL_COLOR, PICKUP_COLOR } from '../../utils/maps';

const opt = (arr: string[]) => arr.map((s) => ({ value: s, label: titleCase(s) }));

/** Map + address cards for a transport request's pickup and drop points. */
export function RequestMap({ r }: { r: TransportRequest }) {
  const cards = [
    { label: 'Pickup', geo: r.pickup, addr: r.pickupLocation },
    { label: 'Drop', geo: r.drop, addr: r.dropLocation },
  ];
  return (
    <div className="space-y-3">
      <LocationMap
        height="h-[40vh] min-h-[240px]"
        points={[
          { lat: r.pickup?.latitude, lng: r.pickup?.longitude, label: 'P', color: PICKUP_COLOR, title: `Pickup: ${r.pickupLocation}` },
          { lat: r.drop?.latitude, lng: r.drop?.longitude, label: 'D', color: DROP_COLOR, title: `Drop: ${r.dropLocation}` },
        ]}
      />
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="mt-0.5 text-white">{c.addr}</div>
            <div className="text-xs text-white/50">
              {c.geo?.latitude !== undefined
                ? `${c.geo.latitude.toFixed(6)}, ${c.geo.longitude!.toFixed(6)}`
                : 'No coordinates (request created before map selection)'}
            </div>
            <MapLinks className="mt-2" lat={c.geo?.latitude} lng={c.geo?.longitude} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Admin review queue + history for student location change requests. */
export function LocationChangesAdmin() {
  const toast = useToast();
  const state = useListState('-createdAt');
  const { data, meta, loading, error, reload } = useFetch<LocationChange[]>('/location-changes', state.params, {
    interval: 30000,
  });
  const [sel, setSel] = useState<LocationChange | null>(null);
  const { data: routes } = useFetch<RouteDoc[]>(sel ? '/routes/options' : null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [reason, setReason] = useState('');
  const [stop, setStop] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const stopNames = [...new Set((routes || []).flatMap((r) => r.stops.map((s) => s.name)))];

  const open = (c: LocationChange) => {
    setSel(c);
    setDecision('approved');
    setReason('');
    setStop('');
    setErr('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await patch(`/location-changes/${sel!._id}/review`, {
        decision,
        ...(decision === 'rejected' && reason ? { rejectionReason: reason } : {}),
        ...(decision === 'approved' && stop ? { stop } : {}),
      });
      toast.success(
        decision === 'approved' ? 'Change approved. Student and driver notified.' : 'Change rejected. Student notified.'
      );
      setSel(null);
      reload();
    } catch (e2) {
      setErr(parseError(e2).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="card overflow-hidden">
        <Toolbar
          state={state}
          placeholder="Filter…"
          filters={[{ name: 'status', label: 'Status', options: opt(['pending', 'approved', 'rejected', 'cancelled']) }]}
        />
        <DataTable<LocationChange>
          columns={[
            { key: 'createdAt', header: 'Submitted', sortable: true, render: (c) => fmtDateTime(c.createdAt) },
            { key: 'student', header: 'Student', render: (c) => (c.student ? `${c.student.name} (${c.student.studentId})` : '—') },
            { key: 'target', header: 'Type', sortable: true, render: (c) => (c.target === 'pickup' ? 'Pickup' : 'Drop-off') },
            { key: 'previous', header: 'Previous', render: (c) => <span className="block max-w-[200px] truncate" title={c.previous.address}>{c.previous.address}</span> },
            { key: 'proposed', header: 'Proposed', render: (c) => <span className="block max-w-[200px] truncate" title={c.proposed.address}>{c.proposed.address}</span> },
            { key: 'status', header: 'Status', sortable: true, render: (c) => <Badge value={c.status} /> },
            { key: 'reviewed', header: 'Reviewed', render: (c) => (c.reviewedBy ? `${c.reviewedBy.name} · ${fmtDateTime(c.reviewedAt)}` : '—') },
            {
              key: 'a',
              header: '',
              className: 'text-right',
              render: (c) => (
                <Button size="sm" variant={c.status === 'pending' ? 'primary' : 'secondary'} onClick={() => open(c)}>
                  {c.status === 'pending' ? 'Review' : 'View'}
                </Button>
              ),
            },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle="No location change requests"
        />
      </div>

      <Modal open={!!sel} title="Location change" onClose={() => setSel(null)} wide>
        {sel && (
          <form onSubmit={submit} className="space-y-4">
            {err && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {err}
              </div>
            )}
            <div className="text-sm text-slate-600">
              {sel.student?.name} ({sel.student?.studentId}) · {sel.target === 'pickup' ? 'Pickup' : 'Drop-off'} · submitted{' '}
              {fmtDateTime(sel.createdAt)}
              {sel.reason && <div className="mt-1 text-slate-500">Reason: {sel.reason}</div>}
            </div>
            <LocationMap
              height="h-[38vh] min-h-[240px]"
              points={[
                { lat: sel.previous.latitude, lng: sel.previous.longitude, label: 'O', color: NEUTRAL_COLOR, title: `Current: ${sel.previous.address}` },
                { lat: sel.proposed.latitude, lng: sel.proposed.longitude, label: 'N', color: sel.target === 'pickup' ? PICKUP_COLOR : DROP_COLOR, title: `Proposed: ${sel.proposed.address}` },
              ]}
            />
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current</div>
                <div className="text-white">{sel.previous.address}</div>
                <div className="text-xs text-white/50">
                  {sel.previous.latitude !== undefined ? `${sel.previous.latitude.toFixed(6)}, ${sel.previous.longitude!.toFixed(6)}` : 'No coordinates'}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Proposed</div>
                <div className="text-white">{sel.proposed.address}</div>
                <div className="text-xs text-white/50">
                  {sel.proposed.latitude!.toFixed(6)}, {sel.proposed.longitude!.toFixed(6)}
                </div>
                <MapLinks className="mt-2" lat={sel.proposed.latitude} lng={sel.proposed.longitude} />
              </div>
            </div>
            {sel.status !== 'pending' ? (
              <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-slate-600">
                <Badge value={sel.status} />
                {sel.reviewedBy ? ` by ${sel.reviewedBy.name} on ${fmtDateTime(sel.reviewedAt)}` : ''}
                {sel.rejectionReason && <div className="mt-1">Reason: {sel.rejectionReason}</div>}
              </div>
            ) : (
              <>
                <Field label="Decision">
                  <select className="input" value={decision} onChange={(e) => setDecision(e.target.value as 'approved' | 'rejected')}>
                    <option value="approved">Approve (updates the location and notifies the driver)</option>
                    <option value="rejected">Reject</option>
                  </select>
                </Field>
                {decision === 'approved' ? (
                  <Field label="Move student to stop (optional)" hint="Keeps the bus assignment consistent with the new location">
                    <select className="input" value={stop} onChange={(e) => setStop(e.target.value)}>
                      <option value="">Keep current stop</option>
                      {stopNames.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Rejection reason (optional)">
                    <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setSel(null)}>
                    Close
                  </Button>
                  <Button type="submit" loading={saving} variant={decision === 'rejected' ? 'danger' : 'primary'}>
                    {decision === 'approved' ? 'Approve change' : 'Reject change'}
                  </Button>
                </div>
              </>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
