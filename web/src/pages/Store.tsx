import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Ban, Minus, Package, PackagePlus, Pencil, Plus, Search, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import { ClientPicker, type PickedClient } from '@/components/ClientPicker';
import { emptyLine, PaymentForm, summarize, toPayload, type DraftLine } from '@/components/PaymentForm';
import { ReceiptModal, type ReceiptData } from '@/components/Receipt';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingBlock, Modal, Money, PageHeader, Segmented, Switch, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PAYMENT_METHODS } from '@/lib/constants';
import { addDays, bs, dateTime, fullName, todayStr, usd } from '@/lib/format';
import { useAction, useBs, useDebounced } from '@/lib/hooks';
import type { PaymentMethod, Product } from '@/lib/types';

type CartItem = { product: Product; qty: number };

function Pos() {
  const { rate, toBs } = useBs();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [client, setClient] = useState<PickedClient | null>(null);
  const [paying, setPaying] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const debounced = useDebounced(q, 150);

  const { data: products = [], isLoading } = useQuery({ queryKey: ['products', 'pos'], queryFn: () => api.get<Product[]>('/store/products', { active: 1 }) });
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const visible = products.filter((p) => (!cat || p.category === cat) && (!debounced || `${p.name} ${p.sku ?? ''}`.toLowerCase().includes(debounced.toLowerCase())));

  const total = cart.reduce((s, i) => s + i.product.price_usd * i.qty, 0);
  const add = (p: Product) =>
    setCart((c) => {
      const found = c.find((i) => i.product.id === p.id);
      if (found) return c.map((i) => (i.product.id === p.id ? { ...i, qty: Math.min(i.qty + 1, p.stock) } : i));
      return [...c, { product: p, qty: 1 }];
    });
  const setQty = (id: number, qty: number) => setCart((c) => c.flatMap((i) => (i.product.id === id ? (qty <= 0 ? [] : [{ ...i, qty: Math.min(qty, i.product.stock) }]) : [i])));

  const sell = useAction(
    () => api.post<{ id: number; totalUsd: number; rate: number; changeUsd: number }>('/store/sales', { client_id: client?.id ?? null, items: cart.map((i) => ({ product_id: i.product.id, qty: i.qty })), payments: toPayload(lines) }),
    {
      success: 'Venta registrada',
      invalidate: [['products'], ['sales'], ['dashboard'], ['payments']],
      onSuccess: (r) => {
        setReceipt({
          title: 'Venta',
          number: r.id,
          client: client ? `${fullName(client)} · ${client.document}` : null,
          items: cart.map((i) => ({ label: `${i.qty} × ${i.product.name}`, usd: i.product.price_usd * i.qty })),
          totalUsd: r.totalUsd,
          rate: r.rate,
          payments: toPayload(lines).map((l) => ({ ...l, reference: l.reference ?? undefined })),
          changeUsd: r.changeUsd,
        });
        setCart([]);
        setClient(null);
        setPaying(false);
        setLines([emptyLine()]);
      },
    },
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="sm:w-72"><Input icon={<Search className="size-4" />} placeholder="Buscar producto o SKU…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {['', ...categories].map((c) => (
              <button key={c || 'all'} onClick={() => setCat(c)} className={clsx('h-10 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition', cat === c ? 'bg-fg text-bg' : 'bg-surface-2 text-muted hover:text-fg')}>
                {c || 'Todos'}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? <LoadingBlock /> : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
            {visible.map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id)?.qty ?? 0;
              const out = p.stock - inCart <= 0;
              return (
                <button key={p.id} disabled={out} onClick={() => add(p)} className={clsx('group relative rounded-2xl border bg-surface p-4 text-left transition active:scale-[0.98]', inCart ? 'border-accent' : 'border-line hover:border-muted/40', out && 'opacity-50')}>
                  {inCart > 0 && <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg">{inCart}</span>}
                  <div className="mb-3 grid size-10 place-items-center rounded-xl bg-surface-2 text-muted group-hover:text-accent-ink"><Package className="size-5" /></div>
                  <p className="line-clamp-2 min-h-10 text-sm font-medium">{p.name}</p>
                  <p className="mt-2 font-display text-lg font-bold tabular">{usd(p.price_usd)}</p>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="tabular">{bs(toBs(p.price_usd))}</span>
                    <span className={p.stock <= p.min_stock ? 'text-amber-400' : ''}>{p.stock === 0 ? 'Agotado' : `${p.stock} disp.`}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Card className="flex h-fit flex-col xl:sticky xl:top-24">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <ShoppingCart className="size-5 text-accent-ink" />
          <p className="font-display font-semibold">Carrito</p>
          {cart.length > 0 && <button className="ml-auto text-xs text-muted hover:text-red-400" onClick={() => setCart([])}>Vaciar</button>}
        </div>
        {cart.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="size-6" />} title="Carrito vacío" description="Toca un producto para agregarlo" />
        ) : (
          <div className="max-h-[42vh] divide-y divide-line overflow-y-auto">
            {cart.map((i) => (
              <div key={i.product.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.product.name}</p>
                  <p className="text-xs text-muted tabular">{usd(i.product.price_usd)} c/u</p>
                </div>
                <div className="flex items-center rounded-xl border border-line">
                  <button className="p-1.5 text-muted hover:text-fg" onClick={() => setQty(i.product.id, i.qty - 1)}>{i.qty === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}</button>
                  <span className="w-7 text-center text-sm font-semibold tabular">{i.qty}</span>
                  <button className="p-1.5 text-muted hover:text-fg disabled:opacity-30" disabled={i.qty >= i.product.stock} onClick={() => setQty(i.product.id, i.qty + 1)}><Plus className="size-3.5" /></button>
                </div>
                <p className="w-16 text-right text-sm font-semibold tabular">{usd(i.product.price_usd * i.qty)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-4 border-t border-line p-5">
          <ClientPicker value={client} onChange={setClient} placeholder="Cliente (opcional)" />
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted">Total</span>
            <Money value={total} size="xl" align="right" />
          </div>
          <Button size="lg" className="w-full" disabled={!cart.length || !rate} onClick={() => setPaying(true)}>Cobrar</Button>
        </div>
      </Card>

      {paying && (
        <Modal open onClose={() => setPaying(false)} size="sm" title="Cobrar venta" subtitle={`${cart.reduce((s, i) => s + i.qty, 0)} artículos`}
          footer={<><Button variant="outline" onClick={() => setPaying(false)}>Volver</Button><Button disabled={!summarize(lines, total, rate).complete} loading={sell.isPending} onClick={() => sell.mutate(undefined)}>Confirmar venta</Button></>}>
          <PaymentForm lines={lines} onChange={setLines} totalUsd={total} rate={rate} />
        </Modal>
      )}
      <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [d, setD] = useState({
    name: product?.name ?? '', sku: product?.sku ?? '', category: product?.category ?? 'General',
    price_usd: String(product?.price_usd ?? ''), cost_usd: String(product?.cost_usd ?? ''),
    stock: String(product?.stock ?? 0), min_stock: String(product?.min_stock ?? 0), active: product ? !!product.active : true,
  });
  const { data: cats = [] } = useQuery({ queryKey: ['products', 'categories'], queryFn: () => api.get<string[]>('/store/categories') });
  const { toBs } = useBs();
  const save = useAction(() => (product ? api.put(`/store/products/${product.id}`, d) : api.post('/store/products', d)), { success: 'Producto guardado', invalidate: [['products']], onSuccess: onClose });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(undefined); };
  const margin = Number(d.price_usd) ? ((Number(d.price_usd) - Number(d.cost_usd || 0)) / Number(d.price_usd)) * 100 : 0;
  const n = (v: string) => v.replace(',', '.');

  return (
    <Modal open onClose={onClose} title={product ? 'Editar producto' : 'Nuevo producto'}
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form="product-form" loading={save.isPending}>Guardar</Button></>}>
      <form id="product-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *" className="sm:col-span-2"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required autoFocus /></Field>
        <Field label="SKU / código"><Input value={d.sku} onChange={(e) => setD({ ...d, sku: e.target.value })} /></Field>
        <Field label="Categoría *">
          <Input list="cats" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} required />
          <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Precio de venta ($) *" hint={`≈ ${bs(toBs(Number(d.price_usd) || 0))}`}><Input inputMode="decimal" value={d.price_usd} onChange={(e) => setD({ ...d, price_usd: n(e.target.value) })} required /></Field>
        <Field label="Costo ($)" hint={`Margen: ${margin.toFixed(0)}%`}><Input inputMode="decimal" value={d.cost_usd} onChange={(e) => setD({ ...d, cost_usd: n(e.target.value) })} /></Field>
        <Field label="Stock actual"><Input type="number" min={0} value={d.stock} onChange={(e) => setD({ ...d, stock: e.target.value })} /></Field>
        <Field label="Stock mínimo (alerta)"><Input type="number" min={0} value={d.min_stock} onChange={(e) => setD({ ...d, min_stock: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Switch checked={d.active} onChange={(v) => setD({ ...d, active: v })} label="Disponible para la venta" /></div>
      </form>
    </Modal>
  );
}

function Inventory() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [restock, setRestock] = useState<Product | null>(null);
  const [delta, setDelta] = useState('');
  const debounced = useDebounced(q);
  const { data = [], isLoading } = useQuery({ queryKey: ['products', 'all', debounced], queryFn: () => api.get<Product[]>('/store/products', { q: debounced }) });
  const adjust = useAction(() => api.post(`/store/products/${restock!.id}/stock`, { delta: Number(delta) }), { success: 'Stock actualizado', invalidate: [['products'], ['dashboard']], onSuccess: () => { setRestock(null); setDelta(''); } });
  const value = data.reduce((s, p) => s + p.cost_usd * p.stock, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="w-72"><Input icon={<Search className="size-4" />} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">Valor de inventario (costo): <b className="text-fg tabular">{usd(value)}</b></span>
          {can('admin') && <Button icon={<Plus className="size-4" />} onClick={() => setEditing(null)}>Producto</Button>}
        </div>
      </div>
      {isLoading ? <LoadingBlock /> : !data.length ? <EmptyState title="Sin productos" /> : (
        <Table>
          <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th className="hidden md:table-cell">Costo</th><th>Stock</th><th /></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                <td><p className="font-medium">{p.name}</p><p className="text-xs text-muted">{p.sku ?? '—'}</p></td>
                <td className="text-muted">{p.category}</td>
                <td><Money value={p.price_usd} size="sm" /></td>
                <td className="hidden tabular text-muted md:table-cell">{usd(p.cost_usd)}</td>
                <td><Badge tone={p.stock === 0 ? 'red' : p.stock <= p.min_stock ? 'amber' : 'green'}>{p.stock} uds</Badge></td>
                <td>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Ajustar stock" onClick={() => setRestock(p)}><PackagePlus className="size-4" /></Button>
                    {can('admin') && <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(p)}><Pencil className="size-4" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing !== undefined && <ProductModal product={editing} onClose={() => setEditing(undefined)} />}
      {restock && (
        <Modal open onClose={() => setRestock(null)} size="sm" title="Ajustar stock" subtitle={`${restock.name} · actual: ${restock.stock}`}
          footer={<><Button variant="outline" onClick={() => setRestock(null)}>Cancelar</Button><Button disabled={!Number(delta)} loading={adjust.isPending} onClick={() => adjust.mutate(undefined)}>Aplicar</Button></>}>
          <Field label="Cantidad a sumar (use negativo para restar)" hint={Number(delta) ? `Nuevo stock: ${restock.stock + Number(delta)}` : undefined}>
            <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} autoFocus placeholder="+24" />
          </Field>
        </Modal>
      )}
    </Card>
  );
}

interface SaleRow { id: number; total_usd: number; total_bs: number; rate: number; created_at: string; cancelled_at: string | null; summary: string; methods: string | null; first_name: string | null; last_name: string | null; created_by_name: string }

function Sales() {
  const { can } = useAuth();
  const t = todayStr();
  const [from, setFrom] = useState(addDays(t, -6));
  const [to, setTo] = useState(t);
  const { data = [], isLoading } = useQuery({ queryKey: ['sales', from, to], queryFn: () => api.get<SaleRow[]>('/store/sales', { from, to }) });
  const cancel = useAction((id: number) => api.post(`/store/sales/${id}/cancel`), { success: 'Venta anulada y stock restituido', invalidate: [['sales'], ['products'], ['payments'], ['dashboard']] });
  const valid = data.filter((s) => !s.cancelled_at);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="flex gap-2"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" value={to} max={t} onChange={(e) => setTo(e.target.value)} /></div>
        <p className="text-sm text-muted">{valid.length} ventas · <b className="text-fg">{usd(valid.reduce((s, x) => s + x.total_usd, 0))}</b> · {bs(valid.reduce((s, x) => s + x.total_bs, 0))}</p>
      </div>
      {isLoading ? <LoadingBlock /> : !data.length ? <EmptyState title="Sin ventas en el período" /> : (
        <Table>
          <thead><tr><th>Nº</th><th>Fecha</th><th>Detalle</th><th>Pago</th><th className="text-right">Total</th><th /></tr></thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className={s.cancelled_at ? 'opacity-50' : ''}>
                <td className="tabular text-muted">#{String(s.id).padStart(5, '0')}</td>
                <td className="whitespace-nowrap text-muted">{dateTime(s.created_at)}</td>
                <td><p className="max-w-80 truncate">{s.summary}</p><p className="text-xs text-muted">{s.first_name ? fullName(s) : 'Cliente general'} · {s.created_by_name}</p></td>
                <td className="text-xs text-muted">{s.methods?.split(',').map((m) => PAYMENT_METHODS[m as PaymentMethod]?.label).join(', ')}</td>
                <td>{s.cancelled_at ? <div className="text-right"><Badge tone="red">Anulada</Badge></div> : <Money value={s.total_usd} bsValue={s.total_bs} size="sm" align="right" />}</td>
                <td className="text-right">{can('admin') && !s.cancelled_at && <Button variant="ghost" size="icon" title="Anular venta" onClick={() => confirm('¿Anular esta venta? El stock será devuelto.') && cancel.mutate(s.id)}><Ban className="size-4" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export default function Store() {
  const [tab, setTab] = useState<'pos' | 'inventario' | 'ventas'>('pos');
  return (
    <>
      <PageHeader
        title="Tienda"
        subtitle="Punto de venta, inventario y ventas"
        icon={<ShoppingBag className="size-5" />}
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'pos', label: 'Punto de venta' }, { value: 'inventario', label: 'Inventario' }, { value: 'ventas', label: 'Ventas' }]} />}
      />
      {tab === 'pos' ? <Pos /> : tab === 'inventario' ? <Inventory /> : <Sales />}
    </>
  );
}
