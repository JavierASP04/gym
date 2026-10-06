import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserRound, X } from 'lucide-react';
import { api } from '@/lib/api';
import { fullName, initials } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { Avatar, Spinner } from './ui';

export interface PickedClient {
  id: number;
  document: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
}

export function ClientPicker({ value, onChange, placeholder = 'Buscar por cédula o nombre…', autoFocus }: { value: PickedClient | null; onChange: (c: PickedClient | null) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(q, 200);
  const box = useRef<HTMLDivElement>(null);

  const { data = [], isFetching } = useQuery({
    queryKey: ['clients-lookup', debounced],
    queryFn: () => api.get<PickedClient[]>('/clients/lookup', { q: debounced }),
    enabled: debounced.length >= 2,
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => setActive(0), [data]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 p-2.5">
        <Avatar size="sm" name={initials(value.first_name, value.last_name)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fullName(value)}</p>
          <p className="text-xs text-muted">{value.document}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1.5 text-muted hover:bg-surface-3 hover:text-fg" aria-label="Quitar cliente">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  const pick = (c: PickedClient) => {
    onChange(c);
    setQ('');
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        className="field pl-9"
        placeholder={placeholder}
        value={q}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, data.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && data[active]) {
            e.preventDefault();
            pick(data[active]);
          }
        }}
      />
      {isFetching && <Spinner className="absolute right-3 top-2.5 size-4" />}
      {open && debounced.length >= 2 && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-pop">
          {data.length === 0 && !isFetching ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
              <UserRound className="size-4" /> Sin resultados para “{debounced}”
            </p>
          ) : (
            data.map((c, i) => (
              <button
                type="button"
                key={c.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-surface-2' : ''}`}
              >
                <Avatar size="sm" name={initials(c.first_name, c.last_name)} />
                <span className="flex-1 truncate">{fullName(c)}</span>
                <span className="text-xs text-muted tabular">{c.document}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
