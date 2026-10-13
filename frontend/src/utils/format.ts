export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export const fmtTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';

export const titleCase = (s?: string) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const toInputDate = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');
