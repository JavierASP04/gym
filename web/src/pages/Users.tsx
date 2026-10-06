import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { Avatar, Badge, Button, Card, Field, Input, LoadingBlock, Modal, PageHeader, Select, Switch, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { dateTime } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import type { Role, User } from '@/lib/types';

const ROLE_DESC: Record<Role, string> = {
  admin: 'Acceso total: reportes, usuarios, configuración y anulaciones',
  recepcion: 'Inscripciones, renovaciones, pagos, tienda y asistencias',
  entrenador: 'Consulta clientes y registra asistencias',
};

function UserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [d, setD] = useState({ name: user?.name ?? '', username: user?.username ?? '', role: user?.role ?? ('recepcion' as Role), password: '', active: user ? !!user.active : true });
  const save = useAction(() => (user ? api.put(`/users/${user.id}`, d) : api.post('/users', d)), { success: 'Usuario guardado', invalidate: [['users']], onSuccess: onClose });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(undefined); };
  return (
    <Modal open onClose={onClose} title={user ? 'Editar usuario' : 'Nuevo usuario'} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form="user-form" loading={save.isPending}>Guardar</Button></>}>
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre completo *"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Usuario *"><Input value={d.username} onChange={(e) => setD({ ...d, username: e.target.value.toLowerCase() })} required /></Field>
          <Field label={user ? 'Nueva contraseña' : 'Contraseña *'} hint={user ? 'Dejar vacío para no cambiarla' : 'Mínimo 6 caracteres'}>
            <Input type="password" value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} required={!user} minLength={6} />
          </Field>
        </div>
        <Field label="Rol" hint={ROLE_DESC[d.role]}>
          <Select value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as Role })}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        {user && <Switch checked={d.active} onChange={(v) => setD({ ...d, active: v })} label="Usuario activo" />}
      </form>
    </Modal>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const save = useAction(() => api.post('/auth/change-password', { current, next }), { success: 'Contraseña actualizada', onSuccess: onClose });
  return (
    <Modal open onClose={onClose} size="sm" title="Cambiar mi contraseña" footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={next.length < 6} loading={save.isPending} onClick={() => save.mutate(undefined)}>Actualizar</Button></>}>
      <div className="space-y-4">
        <Field label="Contraseña actual"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus /></Field>
        <Field label="Nueva contraseña" hint="Mínimo 6 caracteres"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [pwd, setPwd] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Personal con acceso al sistema y sus permisos"
        icon={<ShieldCheck className="size-5" />}
        actions={<><Button variant="outline" icon={<KeyRound className="size-4" />} onClick={() => setPwd(true)}>Mi contraseña</Button><Button icon={<Plus className="size-4" />} onClick={() => setEditing(null)}>Nuevo usuario</Button></>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {(Object.keys(ROLES) as Role[]).map((r) => (
          <Card key={r} className="p-5">
            <div className="flex items-center justify-between"><p className="font-display font-semibold">{ROLES[r]}</p><Badge tone={r === 'admin' ? 'lime' : r === 'recepcion' ? 'blue' : 'violet'}>{data.filter((u) => u.role === r).length}</Badge></div>
            <p className="mt-1 text-sm text-muted">{ROLE_DESC[r]}</p>
          </Card>
        ))}
      </div>
      <Card>
        {isLoading ? <LoadingBlock /> : (
          <Table>
            <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th className="hidden md:table-cell">Último acceso</th><th /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm" name={u.name.split(' ').map((s) => s[0]).slice(0, 2).join('')} color="var(--surface-3)" />
                      <div><p className="font-medium">{u.name} {u.id === me?.id && <span className="text-xs text-muted">(tú)</span>}</p><p className="text-xs text-muted">@{u.username}</p></div>
                    </div>
                  </td>
                  <td><Badge tone={u.role === 'admin' ? 'lime' : u.role === 'recepcion' ? 'blue' : 'violet'}>{ROLES[u.role]}</Badge></td>
                  <td>{u.active ? <Badge tone="green" dot>Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                  <td className="hidden text-muted md:table-cell">{u.last_login_at ? dateTime(u.last_login_at) : 'Nunca'}</td>
                  <td className="text-right"><Button variant="ghost" size="icon" onClick={() => setEditing(u)}><Pencil className="size-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing !== undefined && <UserModal user={editing} onClose={() => setEditing(undefined)} />}
      {pwd && <PasswordModal onClose={() => setPwd(false)} />}
    </>
  );
}
