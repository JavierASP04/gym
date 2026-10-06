export type Role = 'admin' | 'recepcion' | 'entrenador';
export type MembershipStatus = 'activa' | 'por_vencer' | 'gracia' | 'vencida' | 'programada' | 'cancelada' | 'sin_plan';
export type Concept = 'inscripcion' | 'renovacion' | 'tienda' | 'otro';
export type PaymentMethod = 'efectivo_usd' | 'zelle' | 'binance' | 'efectivo_bs' | 'pago_movil' | 'transferencia' | 'punto_venta';

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  active?: number;
  last_login_at?: string | null;
  created_at?: string;
}

export interface Rate {
  rate: number;
  source: string;
  rateDate: string | null;
  fetchedAt: string;
  mode: 'auto' | 'manual';
  stale: boolean;
}

export interface Plan {
  id: number;
  name: string;
  description: string | null;
  price_usd: number;
  duration_days: number;
  color: string;
  features: string[];
  active: number;
  active_members?: number;
}

export interface Client {
  id: number;
  document: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  gender: 'M' | 'F' | 'O' | null;
  address: string | null;
  emergency_contact: string | null;
  notes: string | null;
  active: number;
  created_at: string;
}

export interface ClientListRow extends Pick<Client, 'id' | 'document' | 'first_name' | 'last_name' | 'phone' | 'email' | 'active' | 'created_at'> {
  membership_id: number | null;
  end_date: string | null;
  plan_name: string | null;
  plan_color: string | null;
  membership_status: MembershipStatus;
  last_visit: string | null;
}

export interface Membership {
  id: number;
  client_id: number;
  plan_id: number;
  plan_name: string;
  plan_color: string;
  kind: 'inscripcion' | 'renovacion';
  start_date: string;
  end_date: string;
  price_usd: number;
  fee_usd: number;
  discount_usd: number;
  total_usd: number;
  notes: string | null;
  status: MembershipStatus;
  cancelled_at: string | null;
  created_at: string;
  created_by_name?: string;
  document?: string;
  first_name?: string;
  last_name?: string;
  days_left?: number;
}

export interface Payment {
  id: number;
  client_id: number | null;
  membership_id: number | null;
  sale_id: number | null;
  concept: Concept;
  method: PaymentMethod;
  currency: 'USD' | 'VES';
  amount_usd: number;
  amount_bs: number;
  rate: number;
  reference: string | null;
  notes: string | null;
  voided_at: string | null;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  document?: string | null;
  created_by_name?: string | null;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  category: string;
  price_usd: number;
  cost_usd: number;
  stock: number;
  min_stock: number;
  active: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaymentLine {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export type Settings = Record<
  | 'gym_name'
  | 'gym_rif'
  | 'gym_phone'
  | 'gym_address'
  | 'gym_email'
  | 'enrollment_fee_usd'
  | 'grace_days'
  | 'expiring_alert_days'
  | 'rate_mode'
  | 'manual_rate'
  | 'rate_refresh_minutes'
  | 'one_checkin_per_day'
  | 'receipt_footer',
  string
>;
