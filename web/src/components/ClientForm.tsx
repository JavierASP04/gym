import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import type { Client } from '@/lib/types';
import { Button, Field, Input, Modal, Select, Switch, Textarea } from './ui';

type Draft = Omit<Client, 'id' | 'created_at' | 'active'> & { active: boolean };

const blank: Draft = {
  document: '',
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  birth_date: '',
  gender: null,
  address: '',
  emergency_contact: '',
  notes: '',
  active: true,
};

export function ClientFormModal({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client | null; onSaved?: (c: { id: number } & Draft) => void }) {
  const [d, setD] = useState<Draft>(() => (client ? { ...blank, ...client, active: !!client.active } : blank));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const save = useAction(
    (body: Draft) => (client ? api.put<{ ok: true }>(`/clients/${client.id}`, body).then(() => ({ id: client.id })) : api.post<{ id: number }>('/clients', body)),
    {
      success: client ? 'Cliente actualizado' : 'Cliente registrado',
      invalidate: [['clients'], ['client'], ['clients-lookup']],
      onSuccess: (r) => {
        onSaved?.({ ...d, id: r.id });
        onClose();
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(d);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={client ? 'Editar cliente' : 'Nuevo cliente'}
      subtitle="Los campos con * son obligatorios"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="client-form" loading={save.isPending}>{client ? 'Guardar cambios' : 'Registrar cliente'}</Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Cédula / documento *" hint="Ej: V12345678">
          <Input value={d.document} onChange={(e) => set('document', e.target.value.toUpperCase())} required autoFocus />
        </Field>
        <Field label="Teléfono">
          <Input value={d.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="0414-1234567" inputMode="tel" />
        </Field>
        <Field label="Nombres *">
          <Input value={d.first_name} onChange={(e) => set('first_name', e.target.value)} required />
        </Field>
        <Field label="Apellidos *">
          <Input value={d.last_name} onChange={(e) => set('last_name', e.target.value)} required />
        </Field>
        <Field label="Correo">
          <Input type="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nacimiento">
            <Input type="date" value={d.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value)} />
          </Field>
          <Field label="Sexo">
            <Select value={d.gender ?? ''} onChange={(e) => set('gender', (e.target.value || null) as Draft['gender'])}>
              <option value="">—</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="O">Otro</option>
            </Select>
          </Field>
        </div>
        <Field label="Dirección" className="sm:col-span-2">
          <Input value={d.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Contacto de emergencia">
          <Input value={d.emergency_contact ?? ''} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="Nombre y teléfono" />
        </Field>
        <Field label="Notas / condiciones médicas">
          <Textarea value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={2} className="min-h-10" />
        </Field>
        {client && (
          <div className="sm:col-span-2">
            <Switch checked={d.active} onChange={(v) => set('active', v)} label="Cliente activo" />
          </div>
        )}
      </form>
    </Modal>
  );
}
