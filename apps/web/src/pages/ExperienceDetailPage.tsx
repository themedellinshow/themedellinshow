import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { experiencesApi, reviewsApi } from '../api';
import type { Experience, Review } from '../api/types';
import { formatCop, formatDate, plural } from '../lib/format';
import {
  IconArrow,
  IconBack,
  IconClock,
  IconPin,
  IconUsers,
} from '../components/Icons';
import { Button, EmptyState, Spinner, Stars } from '../components/ui';

export function ExperienceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exp, setExp] = useState<Experience | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    experiencesApi
      .detail(id)
      .then((e) => !cancelled && setExp(e))
      .catch(() => !cancelled && setError('No se pudo cargar la experiencia.'));
    reviewsApi
      .byExperience(id)
      .then((r) => !cancelled && setReviews(r))
      .catch(() => !cancelled && setReviews([]));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <div className="error-box">{error}</div>
        <Button variant="outline" size="block" onClick={() => navigate('/experiences')}>
          Volver a explorar
        </Button>
      </div>
    );
  }

  if (!exp) return <Spinner />;

  const title = exp.titleEs || exp.titleEn;
  const description = exp.descriptionEs || exp.descriptionEn;
  const hours = Math.round(exp.durationMinutes / 60);
  const rating = Number(exp.averageRating ?? 0);

  return (
    <div className="page page-flush">
      <div className="detail-hero">
        {exp.imageUrls?.[0] ? <img src={exp.imageUrls[0]} alt={title} /> : null}
        <button className="detail-back" onClick={() => navigate(-1)} aria-label="Volver">
          <IconBack width={20} height={20} />
        </button>
      </div>

      <div className="detail-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Stars value={rating} />
          <span style={{ fontSize: 'var(--fs-sm)' }}>{rating > 0 ? rating.toFixed(1) : 'Aún sin reseñas'}</span>
          {exp.lgbtqFriendly ? <span className="badge badge-success">LGBTQ+ friendly</span> : null}
        </div>
        <h1 className="detail-title">{title}</h1>
        <p>{description}</p>

        <div className="facts">
          <div className="fact">
            <IconClock width={18} height={18} />
            {hours > 0 ? `${hours} hora${hours === 1 ? '' : 's'}` : `${exp.durationMinutes} min`}
          </div>
          <div className="fact">
            <IconUsers width={18} height={18} />
            {plural(exp.minParticipants, 'persona')} mínimo
          </div>
          {exp.neighborhood ? (
            <div className="fact">
              <IconPin width={18} height={18} />
              {exp.neighborhood}
            </div>
          ) : null}
          {exp.meetingPointEs ? (
            <div className="fact">
              <IconPin width={18} height={18} />
              {exp.meetingPointEs}
            </div>
          ) : null}
        </div>

        {exp.tags && exp.tags.length > 0 ? (
          <div className="tag-row">
            {exp.tags.map((t) => (
              <span key={t} className="tag">#{t}</span>
            ))}
          </div>
        ) : null}

        {exp.host ? (
          <div className="section-title" style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>
            <span>Tu anfitrión</span>
          </div>
        ) : null}
        {exp.host ? (
          <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar">{exp.host.avatarUrl ? <img src={exp.host.avatarUrl} alt="" /> : (exp.host.firstName?.[0] ?? 'H')}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{exp.host.firstName} {exp.host.lastName}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>Host verificado</div>
            </div>
          </div>
        ) : null}

        <div className="section-title">
          <span>Reseñas</span>
        </div>
        {reviews === null ? (
          <Spinner />
        ) : reviews.length === 0 ? (
          <EmptyState title="Sin reseñas todavía" message="Sé el primero en compartir tu experiencia." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.slice(0, 5).map((r) => (
              <div key={r.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <Stars value={r.rating} />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>{formatDate(r.createdAt)}</span>
                </div>
                <p style={{ margin: '8px 0 0' }}>{r.content}</p>
                <div style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
                  {r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : 'Viajero verificad@'}
                  {r.verified ? ' · compra verificada' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="detail-price-row">
        <div>
          <div className="money">{formatCop(exp.priceCop)}</div>
          <div className="per">por persona</div>
        </div>
        <Link to={`/book/${exp.id}`}>
          <Button variant="accent">Reservar <IconArrow width={16} height={16} /></Button>
        </Link>
      </div>
    </div>
  );
}