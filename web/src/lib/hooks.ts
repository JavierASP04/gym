import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';
import type { Plan, Rate, Settings } from './types';

export function useRate() {
  return useQuery({
    queryKey: ['rate'],
    queryFn: () => api.get<Rate>('/rates/current'),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
  });
}

/** Convierte USD → Bs con la tasa vigente. Devuelve 0 mientras carga. */
export function useBs() {
  const { data } = useRate();
  const rate = data?.rate ?? 0;
  return { rate, toBs: (usd: number) => Math.round(usd * rate * 100) / 100 };
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/settings'), staleTime: 10 * 60_000 });
}

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: () => api.get<Plan[]>('/plans'), staleTime: 60_000 });
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Mutación con toast de éxito/error e invalidación de las queries indicadas. */
export function useAction<TVars, TRes = unknown>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: { success?: string | ((r: TRes) => string); invalidate?: QueryKey[]; onSuccess?: (r: TRes) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      for (const key of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: key });
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useHotkey(key: string, handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === key) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, handler, enabled]);
}
