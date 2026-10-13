import { ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useDebounced, useFetch } from '../hooks/useFetch';
import { del, parseError, patch, post } from '../services/api';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Pagination, SkeletonRows } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'stops';
  options?: { value: string; label: string }[];
  required?: boolean;
  createOnly?: boolean;
  placeholder?: string;
  hint?: string;
  full?: boolean;
}

export interface FilterDef {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

type Values = Record<string, any>;

/* ---------- Generic table with search / sort / filter / pagination ---------- */
export function useListState(defaultSort = '-createdAt') {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(defaultSort);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const debounced = useDebounced(search);
  return {
    search,
    setSearch: (s: string) => {
      setSearch(s);
      setPage(1);
    },
    page,
    setPage,
    sort,
    setSort,
    filters,
    setFilter: (k: string, v: string) => {
      setFilters((f) => ({ ...f, [k]: v }));
      setPage(1);
    },
    params: { search: debounced, page, sort, limit: 10, ...filters },
  };
}

export function Toolbar({
  state,
  filters,
  placeholder = 'Search…',
  extra,
}: {
  state: ReturnType<typeof useListState>;
  filters?: FilterDef[];
  placeholder?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder={placeholder}
          value={state.search}
          onChange={(e) => state.setSearch(e.target.value)}
          aria-label="Search"
        />
      </div>
      {filters?.map((f) => (
        <select
          key={f.name}
          aria-label={f.label}
          className="input w-auto"
          value={state.filters[f.name] || ''}
          onChange={(e) => state.setFilter(f.name, e.target.value)}
        >
          <option value="">{f.label}: All</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {extra}
    </div>
  );
}

export function DataTable<T extends { _id: string }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  state,
  meta,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
}: {
  columns: Column<T>[];
  rows: T[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  state: ReturnType<typeof useListState>;
  meta?: { page: number; pages: number; total: number };
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const toggleSort = (key: string) =>
    state.setSort(state.sort === key ? `-${key}` : key);
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && !rows) return <SkeletonRows />;
  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        title={state.search || Object.values(state.filters).some(Boolean) ? 'No matching records' : emptyTitle}
        description={emptyDescription}
      />
    );
  }
  return (
    <div className={loading ? 'opacity-60 transition-opacity' : ''}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-medium ${c.className || ''}`} scope="col">
                  {c.sortable ? (
                    <button
                      className="inline-flex items-center gap-1 uppercase hover:text-navy-700"
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.header}
                      {state.sort === c.key && <ArrowUp className="h-3 w-3" />}
                      {state.sort === `-${c.key}` && <ArrowDown className="h-3 w-3" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <motion.tr
                key={r._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-slate-50/70"
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle text-slate-700 ${c.className || ''}`}>
                    {c.render ? c.render(r) : String((r as any)[c.key] ?? '—')}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <Pagination page={meta.page} pages={meta.pages} total={meta.total} onChange={state.setPage} />}
    </div>
  );
}

/* ---------- Route stops editor ---------- */
function StopsEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  const set = (i: number, patch: Record<string, unknown>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-12 items-center gap-2">
          <input
            aria-label="Sequence"
            type="number"
            min={1}
            className="input col-span-2"
            value={s.sequence}
            onChange={(e) => set(i, { sequence: Number(e.target.value) })}
          />
          <input
            aria-label="Stop name"
            className="input col-span-4"
            placeholder="Stop name"
            value={s.name}
            onChange={(e) => set(i, { name: e.target.value })}
          />
          <input
            aria-label="Pickup time"
            type="time"
            className="input col-span-2"
            value={s.pickupTime || ''}
            onChange={(e) => set(i, { pickupTime: e.target.value })}
          />
          <input
            aria-label="Drop time"
            type="time"
            className="input col-span-3"
            value={s.dropTime || ''}
            onChange={(e) => set(i, { dropTime: e.target.value })}
          />
          <button
            type="button"
            aria-label="Remove stop"
            className="col-span-1 rounded p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
            disabled={value.length <= 1}
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Sequence · Stop · Pickup time · Drop time</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...value, { sequence: value.length + 1, name: '', pickupTime: '', dropTime: '' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add stop
        </Button>
      </div>
    </div>
  );
}

/* ---------- Form ---------- */
export function EntityForm({
  fields,
  initial,
  isEdit,
  submitLabel,
  onSubmit,
  onCancel,
  validate,
}: {
  fields: FieldDef[];
  initial: Values;
  isEdit: boolean;
  submitLabel: string;
  onSubmit: (v: Values) => Promise<void>;
  onCancel: () => void;
  validate?: (v: Values, isEdit: boolean) => Record<string, string>;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const visible = fields.filter((f) => !(isEdit && f.createOnly));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of visible) {
      const v = values[f.name];
      if (isEdit && f.type === 'password') continue; // blank password on edit = keep current
      if (f.required && (v === undefined || v === null || v === '')) errs[f.name] = `${f.label} is required`;
    }
    Object.assign(errs, validate?.(values, isEdit) || {});
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setFormError('');
    try {
      await onSubmit(values);
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fields);
      setFormError(p.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {formError}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((f) => {
          const err = errors[f.name];
          const common = {
            id: f.name,
            value: values[f.name] ?? '',
            placeholder: f.placeholder,
            className: `input ${err ? 'input-error' : ''}`,
          };
          const set = (v: unknown) => setValues((s) => ({ ...s, [f.name]: v }));
          let control: ReactNode;
          if (f.type === 'select') {
            control = (
              <select {...common} onChange={(e) => set(e.target.value)}>
                <option value="">Select…</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          } else if (f.type === 'textarea') {
            control = <textarea {...common} rows={3} onChange={(e) => set(e.target.value)} />;
          } else if (f.type === 'stops') {
            control = <StopsEditor value={values[f.name] || []} onChange={set} />;
          } else {
            control = (
              <input
                {...common}
                type={f.type || 'text'}
                autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                onChange={(e) => set(e.target.value)}
              />
            );
          }
          return (
            <div key={f.name} className={f.full || f.type === 'stops' || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <Field label={f.label} error={err} hint={f.hint} required={f.required && !(isEdit && f.type === 'password')}>
                {control}
              </Field>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ---------- Full CRUD page ---------- */
export function CrudPage<T extends { _id: string }>({
  title,
  subtitle,
  endpoint,
  singular,
  columns,
  fields,
  filters,
  defaultSort,
  searchPlaceholder,
  toForm,
  toPayload,
  validate,
  rowActions,
  nameOf,
  blankValues,
  headerExtra,
  canCreate = true,
}: {
  title: string;
  subtitle?: string;
  endpoint: string;
  singular: string;
  columns: Column<T>[];
  fields: FieldDef[];
  filters?: FilterDef[];
  defaultSort?: string;
  searchPlaceholder?: string;
  toForm?: (row: T) => Values;
  toPayload?: (v: Values, isEdit: boolean) => Values;
  validate?: (v: Values, isEdit: boolean) => Record<string, string>;
  rowActions?: (row: T, reload: () => void) => ReactNode;
  nameOf: (row: T) => string;
  blankValues?: Values;
  headerExtra?: ReactNode;
  canCreate?: boolean;
}) {
  const toast = useToast();
  const state = useListState(defaultSort);
  const { data, meta, loading, error, reload } = useFetch<T[]>(endpoint, state.params);
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);

  const defaults: Values = blankValues || {};
  const initial: Values = editing
    ? toForm
      ? toForm(editing)
      : Object.fromEntries(fields.map((f) => [f.name, (editing as any)[f.name] ?? '']))
    : { ...Object.fromEntries(fields.map((f) => [f.name, ''])), ...defaults };

  const save = async (values: Values) => {
    const isEdit = !!editing;
    let payload = toPayload ? toPayload(values, isEdit) : { ...values };
    // drop empty strings so optional fields / blank passwords are not sent
    payload = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== ''));
    if (isEdit) await patch(`${endpoint}/${editing!._id}`, payload);
    else await post(endpoint, payload);
    toast.success(`${singular} ${isEdit ? 'updated' : 'created'}`);
    setEditing(null);
    setCreating(false);
    reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const r: any = await del(`${endpoint}/${deleting._id}`);
      toast.success(r?.deactivated ? r.message : `${singular} deleted`);
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(parseError(e).message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const actionCol: Column<T> = {
    key: '_actions',
    header: 'Actions',
    className: 'text-right whitespace-nowrap',
    render: (r) => (
      <div className="flex justify-end gap-1">
        {rowActions?.(r, reload)}
        <Button variant="ghost" size="sm" aria-label={`Edit ${nameOf(r)}`} onClick={() => setEditing(r)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" aria-label={`Delete ${nameOf(r)}`} onClick={() => setDeleting(r)}>
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    ),
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {headerExtra}
            {canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> Add {singular}
              </Button>
            )}
          </>
        }
      />
      <div className="card overflow-hidden">
        <Toolbar state={state} filters={filters} placeholder={searchPlaceholder} />
        <DataTable
          columns={[...columns, actionCol]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          state={state}
          meta={meta}
          emptyTitle={`No ${singular.toLowerCase()} records yet`}
          emptyDescription={canCreate ? `Use "Add ${singular}" to create the first one.` : undefined}
        />
      </div>

      <Modal
        open={creating || !!editing}
        title={editing ? `Edit ${singular}` : `Add ${singular}`}
        wide
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        {(creating || editing) && (
          <EntityForm
            key={editing?._id || 'new'}
            fields={fields}
            initial={initial}
            isEdit={!!editing}
            validate={validate}
            submitLabel={editing ? 'Save changes' : `Create ${singular}`}
            onSubmit={save}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        danger
        loading={busy}
        title={`Delete ${singular}`}
        confirmLabel="Delete"
        message={
          <>
            Are you sure you want to delete <strong>{deleting ? nameOf(deleting) : ''}</strong>? Records with history
            are deactivated instead so past trips and attendance are preserved.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
