import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}
interface ToastApi {
  success: (m: string) => void;
  error: (m: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: Toast['kind'], message: string) => {
      const id = ++counter;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );
  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-[#14171c] p-3 text-sm shadow-lg ${
                t.kind === 'success' ? 'border-emerald-400/40' : 'border-red-400/40'
              }`}
            >
              {t.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              <span className="flex-1 text-slate-800">{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used within ToastProvider');
  return c;
}
