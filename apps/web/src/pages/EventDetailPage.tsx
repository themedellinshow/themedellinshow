import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi } from '../api';
import type { Event } from '../api/types';
import { formatCop, formatDateTime } from '../lib/format';
import { IconBack, IconPin } from '../components/Icons';
import { Spinner } from '../components/ui';

export function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    contentApi
      .eventDetail(id)
      .then(setEvent)
      .catch(() => setError('Evento no encontrado.'));
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <div className="error-box">{error}</div>
        <Link to="/" className="btn btn-outline btn-block">Volver al inicio</Link>
      </div>
    );
  }
  if (!event) return <Spinner />;

  return (
    <div className="page page-flush">
      <div className="detail-hero" style={{ aspectRatio: '16/10' }}>
        {event.coverImageUrl ? <img src={event.coverImageUrl} alt="" /> : null}
        <Link to="/" className="detail-back" aria-label="Volver">
          <IconBack width={20} height={20} />
        </Link>
      </div>
      <div className="detail-body">
        <span className="badge badge-accent">{event.category}</span>
        <h1 style={{ margin: '8px 0', fontSize: 'var(--fs-xl)' }}>{event.titleEs}</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>
          {formatDateTime(event.startsAt)}
        </p>
        <p>{event.descriptionEs}</p>
        {event.venueName || event.neighborhood ? (
          <div className="fact">
            <IconPin width={18} height={18} />
            {[event.venueName, event.neighborhood].filter(Boolean).join(' · ')}
          </div>
        ) : null}
        {event.minPriceCop ? (
          <div className="section-title"><span>Precio</span></div>
        ) : null}
        {event.minPriceCop ? (
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            {event.ticketed && event.ticketUrl ? (
              <a href={event.ticketUrl} target="_blank" rel="noreferrer" className="btn btn-accent btn-block">
                Comprar boleto · desde {formatCop(event.minPriceCop)}
              </a>
            ) : (
              <span className="money">{formatCop(event.minPriceCop)}</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}