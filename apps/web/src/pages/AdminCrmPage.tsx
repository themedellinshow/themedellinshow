import { useCallback, useEffect, useState } from 'react';
import { usersApi } from '../api';
import { crmApi } from '../api';
import { ApiError } from '../api/client';
import type { CrmContact, CrmInteraction, CrmLeadSource, CrmLifecycleStage } from '../api/types';
import { formatCop } from '../lib/format';
import { useAuthStore } from '../store/auth';
import { Button, EmptyState, Field, Input, Select, Spinner } from '../components/ui';

const STAGES: CrmLifecycleStage[] = ['lead', 'prospect', 'customer', 'repeat_customer', 'inactive'];
const SOURCES: CrmLeadSource[] = ['organic', 'referral', 'social', 'ads', 'concierge', 'partner', 'other'];
const INTERACTION_TYPES = ['email_sent', 'email_opened', 'whatsapp_sent', 'whatsapp_replied', 'concierge_chat', 'booking_created', 'booking_completed', 'review_submitted', 'note'];
const INTERACTION_CHANNELS = ['email', 'whatsapp', 'sms', 'app', 'concierge', 'manual'];

const STAGE_BADGE: Record<CrmLifecycleStage, string> = {
  lead: 'badge-muted',
  prospect: 'badge-warning',
  customer: 'badge-success',
  repeat_customer: 'badge-success',
  inactive: 'badge-danger',
};

export function AdminCrmPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [role, setRole] = useState<string | null>(null);
  const [accessError, setAccessError] = useState(false);

  const [contacts, setContacts] = useState<CrmContact[] | null>(null);
  const [meta, setMeta] = useState<{ page: number; total: number; totalPages: number } | null>(null);
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    leadSource: 'organic' as CrmLeadSource,
    tags: '',
    emailOptIn: true,
    whatsappOptIn: true,
    smsOptIn: false,
  });
  const [creating, setCreating] = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<CrmInteraction[] | null>(null);
  const [newTag, setNewTag] = useState('');
  const [interaction, setInteraction] = useState({ type: 'note', channel: 'manual', content: '' });
  const [busyContact, setBusyContact] = useState<string | null>(null);

  const load = useCallback((page = 1) => {
    setLoading(true);
    setError(null);
    crmApi
      .list({
        lifecycleStage: (stage || undefined) as CrmLifecycleStage | undefined,
        leadSource: (source || undefined) as CrmLeadSource | undefined,
        tag: tag || undefined,
        page,
        limit: 25,
      })
      .then((r) => {
        setContacts((prev) => (page === 1 ? r.items : [...(prev ?? []), ...r.items]));
        setMeta({ page: r.meta.page, total: r.meta.total, totalPages: r.meta.totalPages });
      })
      .catch((e) => {
        if (e instanceof ApiError) setError(e.message);
        else setError('No se pudo cargar el CRM.');
      })
      .finally(() => setLoading(false));
  }, [stage, source, tag]);

  useEffect(() => {
    usersApi
      .me()
      .then((u) => {
        setUser(u);
        setRole(u.role);
      })
      .catch(() => setAccessError(true));
  }, [setUser]);

  useEffect(() => {
    if (role === 'admin' || role === 'partner') load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, stage, source, tag]);

  async function openContact(id: string) {
    if (expanded === id) {
      setExpanded(null);
      setInteractions(null);
      return;
    }
    setExpanded(id);
    setInteractions(null);
    try {
      setInteractions(await crmApi.interactions(id));
    } catch {
      setInteractions([]);
    }
  }

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await crmApi.create({
        email: form.email,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        country: form.country || undefined,
        leadSource: form.leadSource,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        emailOptIn: form.emailOptIn,
        whatsappOptIn: form.whatsappOptIn,
        smsOptIn: form.smsOptIn,
      });
      setShowCreate(false);
      setForm({ email: '', firstName: '', lastName: '', phone: '', country: '', leadSource: 'organic', tags: '', emailOptIn: true, whatsappOptIn: true, smsOptIn: false });
      load(1);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo crear el contacto.');
    } finally {
      setCreating(false);
    }
  }

  async function changeStage(id: string, lifecycleStage: CrmLifecycleStage) {
    setBusyContact(id);
    setError(null);
    try {
      const updated = await crmApi.updateLifecycle(id, lifecycleStage);
      setContacts((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? null);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setBusyContact(null);
    }
  }

  async function addTag(id: string) {
    if (!newTag.trim()) return;
    setBusyContact(id);
    setError(null);
    try {
      const updated = await crmApi.addTags(id, [newTag.trim()]);
      setContacts((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? null);
      setNewTag('');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setBusyContact(null);
    }
  }

  async function logInteraction(id: string) {
    if (!interaction.content.trim()) return;
    setBusyContact(id);
    setError(null);
    try {
      await crmApi.logInteraction({
        contactId: id,
        type: interaction.type as never,
        channel: interaction.channel as never,
        content: interaction.content,
      });
      setInteraction({ type: 'note', channel: 'manual', content: '' });
      setInteractions(await crmApi.interactions(id));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setBusyContact(null);
    }
  }

  if (accessError && !role) {
    return (
      <div className="page">
        <EmptyState title="Inicia sesión" message="Necesitas una cuenta con rol de administrador para acceder al CRM."
          action={<Button variant="primary" onClick={() => (window.location.href = '/login')}>Entrar</Button>} />
      </div>
    );
  }

  if (role !== 'admin' && role !== 'partner') {
    return (
      <div className="page">
        <EmptyState title="Acceso restringido" message="El panel CRM está disponible solo para administradores y partners." />
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>CRM</h1>
        <Button variant="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Ocultar' : '+ Contacto'}
        </Button>
      </div>
      <p style={{ marginTop: 4, color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>
        {meta ? `${meta.total} contactos · página ${meta.page}/${Math.max(meta.totalPages, 1)}` : 'Contactos registrados en el CRM.'}
      </p>

      {showCreate ? (
        <form className="card" style={{ padding: 'var(--space-4)', marginBottom: 16 }} onSubmit={createContact}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Nuevo contacto</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Email *"><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Origen"><Select value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value as CrmLeadSource })}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
            <Field label="Nombre"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Apellido"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
            <Field label="Teléfono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+57 …" /></Field>
            <Field label="País"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
          </div>
          <Field label="Tags (separados por coma)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, influencer, esquina" /></Field>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <label className="checkbox"><input type="checkbox" checked={form.emailOptIn} onChange={(e) => setForm({ ...form, emailOptIn: e.target.checked })} /> Email</label>
            <label className="checkbox"><input type="checkbox" checked={form.whatsappOptIn} onChange={(e) => setForm({ ...form, whatsappOptIn: e.target.checked })} /> WhatsApp</label>
            <label className="checkbox"><input type="checkbox" checked={form.smsOptIn} onChange={(e) => setForm({ ...form, smsOptIn: e.target.checked })} /> SMS</label>
          </div>
          {error ? <div className="error-box">{error}</div> : null}
          <Button type="submit" variant="accent" size="block" loading={creating}>Crear contacto</Button>
        </form>
      ) : null}

      <div className="crm-filters">
        <Select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">Todas las etapas</option>
          {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </Select>
        <Select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Todo origen</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Input style={{ flex: 1 }} placeholder="Filtrar por tag…" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>

      {error ? <div className="error-box" style={{ marginTop: 12 }}>{error}</div> : null}

      {contacts === null ? (
        <Spinner />
      ) : contacts.length === 0 ? (
        <EmptyState title="Sin contactos" message="Crea el primer contacto o cambia los filtros." />
      ) : (
        contacts.map((c) => {
          const open = expanded === c.id;
          return (
            <div key={c.id} className={`booking-item${open ? ' open' : ''}`}>
              <button type="button" className="crm-row" onClick={() => openContact(c.id)}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700 }}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                </div>
                <span className={`badge ${STAGE_BADGE[c.lifecycleStage] ?? 'badge-muted'}`}>{c.lifecycleStage.replace('_', ' ')}</span>
              </button>

              {open ? (
                <div style={{ padding: '0 12px 12px' }}>
                  <div className="key-value"><span className="k">LTV</span><span className="v money">{formatCop(c.lifetimeValueCop)}</span></div>
                  <div className="key-value"><span className="k">Reservas</span><span className="v">{c.totalBookings}</span></div>
                  <div className="key-value"><span className="k">Marqueting</span><span className="v">{c.emailOptIn ? 'Email' : ''}{c.whatsappOptIn ? ' WhatsApp' : ''}{c.smsOptIn ? ' SMS' : ''}</span></div>
                  {c.tags?.length ? <div className="key-value"><span className="k">Tags</span><span className="v">{c.tags.map((t) => <span key={t} className="badge badge-muted" style={{ marginRight: 4 }}>{t}</span>)}</span></div> : null}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', margin: '12px 0' }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Etapa">
                        <Select value={c.lifecycleStage} disabled={busyContact === c.id} onChange={(e) => changeStage(c.id, e.target.value as CrmLifecycleStage)}>
                          {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="Agregar tag">
                        <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag(c.id)} placeholder="nuevo-tag" />
                      </Field>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => addTag(c.id)} disabled={!newTag.trim()}>+</Button>
                  </div>

                  <div className="section-title" style={{ marginTop: 12 }}><span>Interacciones</span></div>
                  {interactions === null ? (
                    <Spinner />
                  ) : interactions.length === 0 ? (
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>Sin interacciones registradas.</p>
                  ) : (
                    interactions.map((i) => (
                      <div key={i.id} className="interaction">
                        <span className="badge badge-muted">{i.type}</span>
                        <span className="badge">{i.channel}</span>
                        <div style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>
                          {i.content || i.subject || '…'}
                          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)' }}>
                            {new Date(i.createdAt).toLocaleString('es-CO')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Tipo">
                        <Select value={interaction.type} onChange={(e) => setInteraction({ ...interaction, type: e.target.value })}>
                          {INTERACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="Canal">
                        <Select value={interaction.channel} onChange={(e) => setInteraction({ ...interaction, channel: e.target.value })}>
                          {INTERACTION_CHANNELS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </Select>
                      </Field>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                    <Input placeholder="Nota de seguimiento…" value={interaction.content} onChange={(e) => setInteraction({ ...interaction, content: e.target.value })} />
                    <Button variant="outline" onClick={() => logInteraction(c.id)} disabled={!interaction.content.trim()}>Registrar</Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}

      {meta && meta.page < meta.totalPages ? (
        <Button variant="outline" size="block" style={{ marginTop: 12 }} loading={loading} onClick={() => load(meta.page + 1)}>
          Cargar más
        </Button>
      ) : null}
    </div>
  );
}