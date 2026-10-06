import { lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import type { Role } from './lib/types';
import { LoginPage } from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const Enrollments = lazy(() => import('./pages/Enrollments'));
const Renewals = lazy(() => import('./pages/Renewals'));
const Plans = lazy(() => import('./pages/Plans'));
const Payments = lazy(() => import('./pages/Payments'));
const Store = lazy(() => import('./pages/Store'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { can } = useAuth();
  return can(...roles) ? children : <Navigate to="/" replace />;
}

const STAFF: Role[] = ['admin', 'recepcion'];

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner className="size-7" />
      </div>
    );
  }
  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="asistencias" element={<Attendance />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="clientes/:id" element={<ClientDetail />} />
        <Route path="inscripciones" element={<Guard roles={STAFF}><Enrollments /></Guard>} />
        <Route path="renovaciones" element={<Guard roles={STAFF}><Renewals /></Guard>} />
        <Route path="planes" element={<Plans />} />
        <Route path="pagos" element={<Guard roles={STAFF}><Payments /></Guard>} />
        <Route path="tienda" element={<Guard roles={STAFF}><Store /></Guard>} />
        <Route path="reportes" element={<Guard roles={['admin']}><Reports /></Guard>} />
        <Route path="usuarios" element={<Guard roles={['admin']}><Users /></Guard>} />
        <Route path="configuracion" element={<Guard roles={['admin']}><SettingsPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
