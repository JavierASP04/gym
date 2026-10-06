import type { Concept, MembershipStatus, PaymentMethod, Role } from './types';

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; currency: 'USD' | 'VES'; needsRef: boolean }> = {
  efectivo_usd: { label: 'Efectivo $', currency: 'USD', needsRef: false },
  zelle: { label: 'Zelle', currency: 'USD', needsRef: true },
  binance: { label: 'Binance / USDT', currency: 'USD', needsRef: true },
  pago_movil: { label: 'Pago móvil', currency: 'VES', needsRef: true },
  transferencia: { label: 'Transferencia', currency: 'VES', needsRef: true },
  punto_venta: { label: 'Punto de venta', currency: 'VES', needsRef: false },
  efectivo_bs: { label: 'Efectivo Bs', currency: 'VES', needsRef: false },
};

export const METHOD_COLORS: Record<PaymentMethod, string> = {
  efectivo_usd: '#22c55e',
  zelle: '#8b5cf6',
  binance: '#f59e0b',
  pago_movil: '#38bdf8',
  transferencia: '#6366f1',
  punto_venta: '#ec4899',
  efectivo_bs: '#14b8a6',
};

export const CONCEPTS: Record<Concept, { label: string; color: string }> = {
  inscripcion: { label: 'Inscripción', color: '#c6f432' },
  renovacion: { label: 'Renovación', color: '#38bdf8' },
  tienda: { label: 'Tienda', color: '#f59e0b' },
  otro: { label: 'Otros', color: '#a78bfa' },
};

export const STATUS: Record<MembershipStatus, { label: string; tone: Tone }> = {
  activa: { label: 'Activa', tone: 'green' },
  por_vencer: { label: 'Por vencer', tone: 'amber' },
  gracia: { label: 'En gracia', tone: 'orange' },
  vencida: { label: 'Vencida', tone: 'red' },
  programada: { label: 'Programada', tone: 'blue' },
  cancelada: { label: 'Anulada', tone: 'gray' },
  sin_plan: { label: 'Sin plan', tone: 'gray' },
};

export const ROLES: Record<Role, string> = {
  admin: 'Administrador',
  recepcion: 'Recepción',
  entrenador: 'Entrenador',
};

export type Tone = 'green' | 'amber' | 'orange' | 'red' | 'blue' | 'gray' | 'violet' | 'lime';

export const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
