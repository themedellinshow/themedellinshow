import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingsApi, experiencesApi, paymentsApi } from '../api';
import { ApiError } from '../api/client';
import type { Booking, Experience, Payment } from '../api/types';
import { formatCop, toNum } from '../lib/format';
import { useAuthStore } from '../store/auth';
import { Button, Field, Input, Spinner, Textarea } from '../components/ui';

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [exp, setExp] = useState<Experience | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [bookingDate, setBookingDate] = useState(todayIso());
  const [startTime, setStartTime] = useState('18:00');
  const [participants, setParticipants] = useState(2);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const [creating, setCreating] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useMemo(() => {
    if (!id) return;
    experiencesApi
      .detail(id)
      .then(setExp)
      .catch(() => setLoadError('No se pudo cargar la experiencia.'));
  }, [id]);

  const pricePer = exp ? toNum(exp.priceCop) : 0;
  const subtotal = pricePer * participants;
  const serviceFee = Math.round(subtotal * 0.1);
  const total = subtotal + serviceFee;

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setCreating(true);
    try {
      const b = await bookingsApi.create({
        experienceId: id,
        bookingDate,
        startTime,
        participants,
        contactEmail,
        contactPhone,
        specialRequests,
      });
      setBooking(b);
      try {
        const res = await paymentsApi.initiate(b.id);
        setPayment(res.payment);
      } catch (err) {
        if (err instanceof ApiError) setError(`Reserva creada (${b.bookingReference}). No se pudo iniciar el pago: ${err.message}`);
        else setError('Reserva creada pero el pago no pudo iniciarse.');
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo crear la reserva.');
    } finally {
      setCreating(false);
    }
  }

  async function confirmPayment() {
    if (!payment) return;
    setPaying(true);
    setError(null);
    try {
      await paymentsApi.confirm(payment.id);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('El pago no pudo completarse.');
    } finally {
      setPaying(false);
    }
  }

  if (loadError) {
    return (
      <div className="page">
        <div className="error-box">{loadError}</div>
        <Button variant="outline" size="block" onClick={() => navigate('/experiences')}>Volver</Button>
      </div>
    );
  }
  if (!exp) return <Spinner />;

  if (done && booking) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🎉</div>
          <h1 style={{ margin: '12px 0' }}>¡Reserva y pago confirmados!</h1>
          <p>Referencia: <strong>{booking.bookingReference}</strong></p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            El anfitrión confirmará tu reserva. Te notificaremos por correo.
          </p>
          <div style={{ marginTop: 16 }}>
            <Button variant="outline" size="block" onClick={() => navigate('/profile')}>Ver mis reservas</Button>
          </div>
        </div>
      </div>
    );
  }

  if (booking && payment) {
    const isDemo = payment.providerPaymentId?.startsWith('demo_');
    return (
      <div className="page">
        <h1>Confirmar pago</h1>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="key-value"><span className="k">Referencia</span><span className="v">{booking.bookingReference}</span></div>
          <div className="key-value"><span className="k">Fecha</span><span className="v">{booking.bookingDate}</span></div>
          <div className="key-value"><span className="k">Hora</span><span className="v">{booking.startTime}</span></div>
          <div className="key-value"><span className="k">Participantes</span><span className="v">{booking.participants}</span></div>
          <div className="key-value total"><span className="k">Total a pagar</span><span className="v money">{formatCop(booking.totalCop)}</span></div>
        </div>

        {isDemo ? (
          <div className="notice-box" style={{ marginTop: 12 }}>
            <strong>Modo demostración:</strong> no hay una pasarela de pago configurada (sin clave de Stripe). Esta
            reserva se completará como pago de prueba para validar el flujo completo.
          </div>
        ) : (
          <div className="notice-box" style={{ marginTop: 12 }}>
            Se generó un intento de pago con tu proveedor. En un entorno real aquí se mostraría el checkout de Stripe;
            puedes confirmar el pago con el botón de abajo.
          </div>
        )}

        {error ? <div className="error-box" style={{ marginTop: 12 }}>{error}</div> : null}
        <Button variant="accent" size="block" style={{ marginTop: 16 }} onClick={confirmPayment} loading={paying}>
          {isDemo ? 'Pagar (modo demo)' : 'Confirmar pago'}
        </Button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Reservar</h1>
      <div className="card card-flat" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700 }}>{exp.titleEs || exp.titleEn}</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
          {exp.neighborhood} · {formatCop(exp.priceCop)} por persona
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 16 }}>
          <p style={{ margin: 0 }}>Para reservar necesitas una cuenta.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Link to="/login" className="btn btn-primary" style={{ flex: 1 }}>Entrar</Link>
            <Link to="/register" className="btn btn-outline" style={{ flex: 1 }}>Registrarme</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={createBooking}>
          <Field label="Fecha">
            <Input type="date" required min={todayIso()} value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
          </Field>
          <Field label="Hora de inicio">
            <Input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Participantes" hint={`Mínimo ${exp.minParticipants}, máximo ${exp.maxParticipants}`}>
            <Input
              type="number"
              min={exp.minParticipants}
              max={exp.maxParticipants}
              required
              value={participants}
              onChange={(e) => setParticipants(Number(e.target.value))}
            />
          </Field>
          <Field label="Email de contacto">
            <Input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="tu@email.com" />
          </Field>
          <Field label="WhatsApp / teléfono (opcional)">
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+57 …" />
          </Field>
          <Field label="Peticiones especiales (opcional)">
            <Textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Alergias, accesibilidad, ocasiones especiales…" />
          </Field>

          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 16 }}>
            <div className="summary-line"><span>Subtotal ({participants} × {formatCop(pricePer)})</span><span>{formatCop(subtotal)}</span></div>
            <div className="summary-line"><span>Tarifa de servicio</span><span>{formatCop(serviceFee)}</span></div>
            <div className="summary-line total"><span>Total</span><span>{formatCop(total)}</span></div>
          </div>

          {error ? <div className="error-box">{error}</div> : null}
          <Button type="submit" variant="accent" size="block" loading={creating}>
            Crear reserva
          </Button>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 8 }}>
            El pago se confirma en el siguiente paso.
          </p>
        </form>
      )}
    </div>
  );
}