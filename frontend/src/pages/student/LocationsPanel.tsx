import { useState } from 'react';
import { MapPin, Send } from 'lucide-react';
import LocationPicker from '../../components/LocationPicker';
import { MapLinks } from '../../components/LocationMap';
import { Badge, Button, EmptyState, ErrorState, Field, Modal, SkeletonRows } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { parseError, patch, post } from '../../services/api';
import type { LocationChange, StudentLocations } from '../../types';
import { fmtDateTime } from '../../utils/format';
import { DROP_COLOR, PICKUP_COLOR } from '../../utils/maps';
import type { LocationValue } from '../../utils/maps';

type Target = 'pickup' | 'drop';

/** Student's current approved locations + controlled change requests (admin approval required). */
export function LocationsPanel() {
  const toast = useToast();
  const current = useFetch<StudentLocations | null>('/location-changes/current');
  const history = useFetch<LocationChange[]>('/location-changes', { limit: 20 }, { interval: 30000 });
  const [target, setTarget] = useState<Target | null>(null);
  const [value, setValue] = useState<LocationValue | undefined>();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const loc = current.data;
  const point = (t: Target) => (t === 'pickup' ? loc?.pickup : loc?.drop);
  const pendingFor = (t: Target) => history.data?.some((c) => c.target === t && c.status === 'pending');

  const open = (t: Target) => {
    setTarget(t);
    setValue(undefined);
    setReason('');
    setErr('');
  };

  const submit = async () => {
    if (!value) return setErr('Select the new location on the map first');
    setSaving(true);
    setErr('');
    try {
      await post('/location-changes', { target, location: value, ...(reason ? { reason } : {}) });
      toast.success('Change submitted. Your driver’s route stays the same until the administrator approves it.');
      setTarget(null);
      history.reload();
    } catch (e) {
      setErr(parseError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await patch(`/location-changes/${id}/cancel`);
      toast.success('Change request cancelled');
      history.reload();
    } catch (e) {
      toast.error(parseError(e).message);
    }
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="text-base font-semibold text-navy-900">My pickup & drop locations</h2>
        {current.error ? (
          <ErrorState message={current.error} onRetry={current.reload} />
        ) : current.loading && !loc ? (
          <SkeletonRows rows={2} />
        ) : !loc ? (
          <EmptyState title="No approved locations yet" description="Locations appear here once your transport request is approved." />
        ) : (
          <div className="mt-4 space-y-4">
            {(['pickup', 'drop'] as Target[]).map((t) => {
              const p = point(t)!;
              return (
                <div key={t} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: t === 'pickup' ? PICKUP_COLOR : DROP_COLOR }}>
                      {t === 'pickup' ? 'P' : 'D'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t === 'pickup' ? 'Pickup' : 'Drop-off'}</div>
                      <div className="text-sm font-medium text-white">{p.address}</div>
                      {p.latitude !== undefined && (
                        <div className="text-xs text-white/50">{p.latitude.toFixed(6)}, {p.longitude!.toFixed(6)}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" disabled={pendingFor(t)} onClick={() => open(t)}>
                      <MapPin className="h-4 w-4" /> {pendingFor(t) ? 'Change pending' : 'Request change'}
                    </Button>
                    <MapLinks lat={p.latitude} lng={p.longitude} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4 text-base font-semibold text-navy-900">Location change requests</div>
        {history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : history.loading && !history.data ? (
          <SkeletonRows rows={3} />
        ) : !history.data?.length ? (
          <EmptyState title="No change requests" description="Requests you submit and their decisions will be listed here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.data.map((c) => (
              <li key={c._id} className="p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-white">{c.target === 'pickup' ? 'Pickup' : 'Drop-off'} change</span>
                  <Badge value={c.status} />
                </div>
                <div className="mt-1 text-xs text-white/50">From: {c.previous.address}</div>
                <div className="text-xs text-white/70">To: {c.proposed.address}</div>
                {c.rejectionReason && <div className="mt-1 text-xs text-red-300">Reason: {c.rejectionReason}</div>}
                <div className="mt-1 flex items-center justify-between text-xs text-white/40">
                  <span>{fmtDateTime(c.createdAt)}</span>
                  {c.status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(c._id)}>Cancel request</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!target} title={`Request ${target === 'pickup' ? 'pickup' : 'drop-off'} location change`} onClose={() => setTarget(null)} wide>
        {target && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Your current route is not changed until an administrator approves this request.
            </div>
            {err && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{err}</div>}
            <LocationPicker
              label={target === 'pickup' ? 'New pickup location' : 'New drop location'}
              kind={target}
              value={value}
              other={target === 'pickup' ? loc?.drop.latitude !== undefined ? { address: loc.drop.address, latitude: loc.drop.latitude, longitude: loc.drop.longitude! } : undefined : loc?.pickup.latitude !== undefined ? { address: loc.pickup.address, latitude: loc.pickup.latitude, longitude: loc.pickup.longitude! } : undefined}
              onChange={setValue}
            />
            <Field label="Reason (optional)">
              <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
              <Button loading={saving} onClick={submit}><Send className="h-4 w-4" /> Submit change request</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
