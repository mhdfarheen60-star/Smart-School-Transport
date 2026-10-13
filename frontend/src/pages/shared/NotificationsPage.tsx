import { useState } from 'react';
import { CheckCheck, Megaphone, Trash2 } from 'lucide-react';
import { Button, EmptyState, ErrorState, Field, Modal, PageHeader, Pagination, SkeletonRows } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { del, parseError, patch, post } from '../../services/api';
import type { NotificationDoc } from '../../types';
import { fmtDateTime, titleCase } from '../../utils/format';

function Broadcast({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ title: '', message: '', type: 'info', audience: 'all' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const r = await post<{ sent: number }>('/notifications', v);
      toast.success(`Notification sent to ${r.sent} user(s)`);
      setV({ title: '', message: '', type: 'info', audience: 'all' });
      onSent();
      onClose();
    } catch (e2) {
      setErr(parseError(e2).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Send notification">
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Audience">
            <select className="input" value={v.audience} onChange={(e) => setV({ ...v, audience: e.target.value })}>
              <option value="all">Students & drivers</option>
              <option value="students">Students only</option>
              <option value="drivers">Drivers only</option>
            </select>
          </Field>
          <Field label="Type">
            <select className="input" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
              <option value="info">General</option>
              <option value="delay">Delay</option>
              <option value="route_change">Route change</option>
              <option value="holiday">Holiday</option>
            </select>
          </Field>
        </div>
        <Field label="Title" required>
          <input className="input" required minLength={2} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Message" required>
          <textarea className="input" rows={4} required minLength={2} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Send</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function NotificationsPage({ canBroadcast = false }: { canBroadcast?: boolean }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const { data, meta, loading, error, reload } = useFetch<NotificationDoc[]>(
    '/notifications',
    { page, limit: 10, unread: unreadOnly ? 'true' : '' },
    { interval: 20000 }
  );

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      reload();
    } catch (e) {
      toast.error(parseError(e).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={meta?.unread ? `${meta.unread} unread` : 'You are all caught up'}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
              Unread only
            </label>
            <Button variant="secondary" onClick={() => run(() => patch('/notifications/read-all'))}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
            {canBroadcast && (
              <Button onClick={() => setOpen(true)}>
                <Megaphone className="h-4 w-4" /> Send notification
              </Button>
            )}
          </>
        }
      />
      <div className="card overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <SkeletonRows />
        ) : !data?.length ? (
          <EmptyState title="No notifications" description="Updates about requests, trips and complaints will appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((n) => (
              <li key={n._id} className={`flex items-start gap-3 px-4 py-4 ${n.read ? '' : 'bg-brand-50'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-300' : 'bg-brand-600'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{n.title}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{titleCase(n.type)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!n.read && (
                    <Button variant="ghost" size="sm" onClick={() => run(() => patch(`/notifications/${n._id}/read`))}>
                      Mark read
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" aria-label="Delete notification" onClick={() => run(() => del(`/notifications/${n._id}`))}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} onChange={setPage} />}
      </div>
      {canBroadcast && <Broadcast open={open} onClose={() => setOpen(false)} onSent={reload} />}
    </>
  );
}
