import { useCallback, useEffect, useRef, useState } from 'react';
import { get, parseError } from '../services/api';
import type { Meta } from '../types';

interface State<T> {
  data: T | null;
  meta?: Meta;
  loading: boolean;
  error: string | null;
}

/** GET a resource; re-fetches when url/params change, and optionally on an interval. */
export function useFetch<T>(
  url: string | null,
  params?: Record<string, unknown>,
  opts: { interval?: number } = {}
) {
  const [state, setState] = useState<State<T>>({ data: null, loading: !!url, error: null });
  const key = JSON.stringify([url, params]);
  const alive = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (!url) return;
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const clean = Object.fromEntries(
          Object.entries(params || {}).filter(([, v]) => v !== '' && v !== undefined && v !== null)
        );
        const r = await get<T>(url, clean);
        if (alive.current) setState({ data: r.data, meta: r.meta, loading: false, error: null });
      } catch (e) {
        if (alive.current && !silent) setState((s) => ({ ...s, loading: false, error: parseError(e).message }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!opts.interval) return;
    const id = setInterval(() => load(true), opts.interval);
    return () => clearInterval(id);
  }, [load, opts.interval]);

  return { ...state, reload: () => load(false), refresh: () => load(true) };
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
