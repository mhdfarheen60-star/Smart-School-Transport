import { ButtonHTMLAttributes, ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { titleCase } from '../utils/format';

/* ---------- Buttons ---------- */
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-white text-black hover:bg-white/90 focus-visible:ring-white',
  secondary: 'bg-white/5 text-white border border-white/10 hover:bg-white/10 focus-visible:ring-white/40',
  danger: 'bg-[#dc2626] text-white hover:bg-[#ef4444] focus-visible:ring-red-400',
  ghost: 'text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-white/40',
};

export function Button({
  variant = 'primary',
  loading,
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      } ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
const badgeColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  picked_up: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  dropped: 'bg-blue-50 text-blue-700 ring-blue-200',
  completed: 'bg-blue-50 text-blue-700 ring-blue-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  in_review: 'bg-blue-50 text-blue-700 ring-blue-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  open: 'bg-amber-50 text-amber-700 ring-amber-200',
  reported: 'bg-amber-50 text-amber-700 ring-amber-200',
  scheduled: 'bg-slate-100 text-slate-700 ring-slate-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-slate-100 text-slate-700 ring-slate-200',
  maintenance: 'bg-amber-50 text-amber-700 ring-amber-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  absent: 'bg-red-50 text-red-700 ring-red-200',
  unavailable: 'bg-red-50 text-red-700 ring-red-200',
  high: 'bg-red-50 text-red-700 ring-red-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
  ended: 'bg-slate-100 text-slate-600 ring-slate-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  dismissed: 'bg-slate-100 text-slate-600 ring-slate-200',
  not_available: 'bg-orange-50 text-orange-700 ring-orange-200',
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        badgeColors[value] || 'bg-slate-100 text-slate-700 ring-slate-200'
      }`}
    >
      {label || titleCase(value)}
    </span>
  );
}

/* ---------- Form controls ---------- */
export function Field({
  label,
  error,
  hint,
  children,
  required,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && (
        <span className="mt-1 block text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

/* ---------- Layout bits ---------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-navy-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'navy';
}) {
  const tones = {
    blue: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    navy: 'bg-white/10 text-white',
  };
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="card flex items-center gap-4 p-4"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold text-navy-900">{value}</div>
        <div className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      </div>
    </motion.div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-red-500" />
      <p className="text-sm text-slate-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        {total} record{total === 1 ? '' : 's'} · Page {page} of {pages}
      </span>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Modal + confirm ---------- */
export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-white/10 bg-[#0e1014] shadow-2xl outline-none sm:rounded-2xl ${
              wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-navy-900">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="text-sm text-slate-600">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
