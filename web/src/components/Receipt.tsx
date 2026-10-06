import { CheckCircle2, Printer } from 'lucide-react';
import { PAYMENT_METHODS } from '@/lib/constants';
import { bs, dateTime, rateStr, usd } from '@/lib/format';
import { useSettings } from '@/lib/hooks';
import type { PaymentLine } from '@/lib/types';
import { Button, Modal } from './ui';

export interface ReceiptData {
  title: string;
  number: string | number;
  client?: string | null;
  items: { label: string; detail?: string; usd: number }[];
  totalUsd: number;
  rate: number;
  payments: PaymentLine[];
  changeUsd?: number;
  createdAt?: string;
}

export function ReceiptModal({ data, onClose }: { data: ReceiptData | null; onClose: () => void }) {
  const { data: settings } = useSettings();
  if (!data) return null;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-400" /> Operación registrada
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Imprimir recibo
          </Button>
        </>
      }
    >
      <div id="print-area" className="rounded-2xl border border-dashed border-line bg-surface-2 p-5 font-mono text-[13px] leading-relaxed">
        <div className="text-center">
          <p className="font-display text-base font-bold">{settings?.gym_name}</p>
          {settings?.gym_rif && <p className="text-xs text-muted">RIF {settings.gym_rif}</p>}
          {settings?.gym_address && <p className="text-xs text-muted">{settings.gym_address}</p>}
          <p className="mt-2 text-xs uppercase tracking-widest">
            {data.title} · Nº {String(data.number).padStart(6, '0')}
          </p>
          <p className="text-xs text-muted">{dateTime(data.createdAt ?? new Date().toISOString().replace('T', ' '))}</p>
        </div>
        {data.client && <p className="mt-3 border-t border-dashed border-line pt-3">Cliente: {data.client}</p>}
        <div className="mt-3 space-y-1 border-t border-dashed border-line pt-3">
          {data.items.map((it, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span>
                {it.label}
                {it.detail && <span className="block text-xs text-muted">{it.detail}</span>}
              </span>
              <span className="tabular">{usd(it.usd)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-dashed border-line pt-3">
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{usd(data.totalUsd)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Bs</span>
            <span>{bs(data.totalUsd * data.rate)}</span>
          </div>
          <p className="text-xs text-muted">Tasa BCV: {rateStr(data.rate)} Bs/$</p>
        </div>
        <div className="mt-3 space-y-0.5 border-t border-dashed border-line pt-3 text-xs">
          {data.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {PAYMENT_METHODS[p.method].label}
                {p.reference ? ` #${p.reference}` : ''}
              </span>
              <span>{PAYMENT_METHODS[p.method].currency === 'USD' ? usd(p.amount) : bs(p.amount)}</span>
            </div>
          ))}
          {!!data.changeUsd && (
            <div className="flex justify-between font-semibold">
              <span>Vuelto</span>
              <span>
                {usd(data.changeUsd)} / {bs(data.changeUsd * data.rate)}
              </span>
            </div>
          )}
        </div>
        {settings?.receipt_footer && <p className="mt-4 text-center text-xs text-muted">{settings.receipt_footer}</p>}
      </div>
    </Modal>
  );
}
