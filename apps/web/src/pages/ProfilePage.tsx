import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, bookingsApi, referralsApi, reviewsApi, usersApi } from '../api';
import { ApiError } from '../api/client';
import type { Booking, ReferralInfo, User } from '../api/types';
import { formatCop } from '../lib/format';
import { useAuthStore } from '../store/auth';
import { Button, EmptyState, Field, Input, Spinner, Stars, Textarea } from '../components/ui';

function statusBadge(status: Booking['status']) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'badge-warning', label: 'Pendiente' },
    confirmed: { cls: 'badge-warning', label: 'Confirmada' },
    paid: { cls: 'badge-success', label: 'Pagada' },
    completed: { cls: 'badge-success', label: 'Completada' },
    cancelled: { cls: 'badge-danger', label: 'Cancelada' },
    refunded: { cls: 'badge-muted', label: 'Reembolsada' },
    no_show: { cls: 'badge-muted', label: 'No mostrada' },
  };
  const m = map[status] ?? { cls: 'badge-muted', label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, user: storeUser } = useAuthStore();
  const reset = useAuthStore((s) => s.reset);

  const [me, setMe] = useState<User | null>(storeUser);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const reload = useCallback(() => {
    usersApi
      .me()
      .then((u) => {
        setMe(u);
        useAuthStore.getState().setUser(u);
      })
      .catch(() => undefined);
    bookingsApi
      .mine()
      .then(setBookings)
      .catch(() => setBookings([]));
    referralsApi
      .me()
      .then(setReferral)
      .catch(() => setReferral({ hasProgram: false, totalReferred: 0, totalRewarded: 0 }));
  }, []);

  useEffect(() => {
    if (isAuthenticated) reload();
  }, [isAuthenticated, reload]);

  async function getReferralCode() {
    setReferralBusy(true);
    try {
      const info = await referralsApi.create();
      setReferral(info);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setReferralBusy(false);
    }
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!referral) return;
    try {
      const res = await referralsApi.redeem(redeemCode.trim());
      setNotice(res.message);
      setRedeemCode('');
      reload();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function shareText() {
    if (!referral?.code) return;
    const msg = `¡Ven a Medellín con Héctor! Usa mi código ${referral.code} al registrarte y gana crédito en tu primera experiencia.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'The Medellín Show', text: msg });
      } else {
        await navigator.clipboard?.writeText(msg);
        setNotice('Texto copiado al portapapeles.');
      }
    } catch {
      /* user cancelled share */
    }
  }

  async function cancelBooking(id: string) {
    setCancelBusy(id);
    setError(null);
    try {
      await bookingsApi.cancel(id, 'Cancelada por el viajero');
      reload();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setCancelBusy(null);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewFor) return;
    setReviewBusy(true);
    setError(null);
    try {
      await reviewsApi.create({
        bookingId: reviewFor.id,
        rating,
        content: reviewText,
        language: 'es',
      });
      setNotice('¡Gracias por tu reseña! Está en revisión y se publicará pronto.');
      setReviewFor(null);
      setReviewText('');
      setRating(5);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setReviewBusy(false);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    reset();
    navigate('/');
  }

  if (!isAuthenticated) {
    return (
      <div className="page">
        <EmptyState
          title="Inicia sesión"
          message="Accede para ver tus reservas, códigos de referido y perfil."
          action={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => navigate('/login')}>Entrar</Button>
              <Button variant="outline" onClick={() => navigate('/register')}>Registrarme</Button>
            </div>
          }
        />
      </div>
    );
  }

  const displayName = me ? `${me.firstName} ${me.lastName}` : user?.firstName ?? 'Viajero';

  return (
    <div className="page">
      <div className="profile-head">
        <div className="avatar">{me?.avatarUrl ? <img src={me.avatarUrl} alt="" /> : displayName.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--fs-lg)' }}>{displayName}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>{me?.email}</div>
        </div>
      </div>

      {error ? <div className="error-box" style={{ marginTop: 12 }}>{error}</div> : null}
      {notice ? <div className="notice-box" style={{ marginTop: 12 }}>{notice}</div> : null}

      {/* Referral */}
      <div className="section-title"><span>Invita y gana</span></div>
      {referral === null ? (
        <Spinner />
      ) : referral.hasProgram && referral.code ? (
        <div className="referral-card">
          <div style={{ fontSize: 'var(--fs-sm)', opacity: 0.9 }}>Tu código</div>
          <div className="code">{referral.code}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="outline" size="sm" onClick={shareText} style={{ background: '#fff', border: 'none' }}>
              Compartir
            </Button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 16 }}>
          <p style={{ margin: '0 0 12px' }}>
            Genera tu código y gana crédito cuando tus invitados hagan su primera reserva.
          </p>
          <Button variant="primary" size="block" onClick={getReferralCode} loading={referralBusy}>
            Obtener mi código
          </Button>
        </div>
      )}

      {referral?.code ? (
        <form onSubmit={redeem} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Field label="Tienes un código de referido?">
                <Input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} placeholder="HECTOR-XXXXXX" />
              </Field>
            </div>
            <Button type="submit" variant="outline">Aplicar</Button>
          </div>
        </form>
      ) : null}

      {/* Bookings */}
      <div className="section-title">
        <span>Mis reservas</span>
      </div>
      {bookings === null ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="Aún no tienes reservas"
          message="Explora experiencias y haz tu primera reserva."
          action={<Button variant="accent" onClick={() => navigate('/experiences')}>Explorar</Button>}
        />
      ) : (
        bookings.map((b) => (
          <div key={b.id} className="booking-item">
            <div className="head">
              <div>
                <div style={{ fontWeight: 700 }}>{b.experience?.titleEs ?? b.bookingReference}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
                  {b.bookingDate} · {b.startTime} · {b.participants} pers.
                </div>
              </div>
              {statusBadge(b.status)}
            </div>
            <div className="key-value"><span className="k">Total</span><span className="v">{formatCop(b.totalCop)}</span></div>

            {(['pending', 'confirmed'].includes(b.status) ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => cancelBooking(b.id)}
                loading={cancelBusy === b.id}
              >
                Cancelar reserva
              </Button>
            ) : b.status === 'completed' ? (
              <Button variant="outline" size="sm" onClick={() => setReviewFor(b)}>
                Escribir reseña
              </Button>
            ) : null)}
          </div>
        ))
      )}

      {/* Review modal */}
      {reviewFor ? (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', maxWidth: 'var(--app-max-width)', margin: '0 auto', padding: 'var(--space-5)', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <h3 style={{ marginTop: 0 }}>Reseña de tu experiencia</h3>
            <form onSubmit={submitReview}>
              <Field label="Calificación">
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(i)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                      aria-label={`${i} estrellas`}
                    >
                      <Stars value={i <= rating ? i : 0} />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Tu opinión">
                <Textarea required minLength={20} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Cuéntanos cómo fue…" />
              </Field>
              {error ? <div className="error-box">{error}</div> : null}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="button" variant="outline" onClick={() => setReviewFor(null)} style={{ flex: 1 }}>Cancelar</Button>
                <Button type="submit" variant="primary" loading={reviewBusy} style={{ flex: 2 }}>Enviar reseña</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <hr className="divider" />
      <Button variant="danger" size="block" onClick={logout}>
        Cerrar sesión
      </Button>
    </div>
  );
}