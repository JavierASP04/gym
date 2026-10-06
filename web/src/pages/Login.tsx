import { useState, type FormEvent } from 'react';
import { Activity, Dumbbell, Eye, EyeOff, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="absolute -bottom-40 -right-40 size-[520px] rounded-full bg-accent/20 blur-[120px]" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-fg">
            <Dumbbell className="size-6" strokeWidth={2.5} />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">IronPulse</span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Tu gimnasio,
            <br />
            <span className="text-accent-ink">en forma.</span>
          </h1>
          <p className="mt-5 text-lg text-muted">
            Inscripciones, renovaciones, asistencias, tienda y pagos mixtos en dólares y bolívares con la tasa BCV del día, todo en un solo lugar.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              ['Tasa BCV', 'automática'],
              ['Pagos', 'mixtos $ / Bs'],
              ['Check-in', 'en 1 segundo'],
            ].map(([a, b]) => (
              <div key={a} className="rounded-2xl border border-line bg-surface-2/70 p-4 backdrop-blur">
                <Activity className="mb-3 size-5 text-accent-ink" />
                <p className="font-semibold">{a}</p>
                <p className="text-sm text-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-muted">© {new Date().getFullYear()} IronPulse · Sistema de gestión para gimnasios</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-pop">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-fg">
              <Dumbbell className="size-5" strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl font-bold">IronPulse</span>
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Bienvenido</h2>
          <p className="mt-1 text-muted">Ingresa con tu usuario para continuar.</p>

          <div className="mt-8 space-y-4">
            <Field label="Usuario">
              <Input icon={<User className="size-4" />} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" placeholder="admin" required />
            </Field>
            <Field label="Contraseña">
              <div className="relative">
                <Input
                  icon={<Lock className="size-4" />}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  required
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-3 text-muted hover:text-fg" aria-label="Mostrar contraseña">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
          </div>
          <Button type="submit" size="lg" loading={loading} className="mt-6 w-full">
            Ingresar
          </Button>
          <p className="mt-6 rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
            Demo: <b className="text-fg">admin</b> / <b className="text-fg">admin123</b>
          </p>
        </form>
      </section>
    </div>
  );
}
