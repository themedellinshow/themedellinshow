import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { contentApi, experiencesApi, reviewsApi } from '../api';
import type { Event, Experience, Guide, PublicReview } from '../api/types';
import { formatDate } from '../lib/format';
import { ExperienceCard } from '../components/ExperienceCard';
import { IconArrow, IconCalendar, IconChat, IconExplore, IconSearch, IconStar, IconUsers } from '../components/Icons';
import { EmptyState, Spinner, Stars } from '../components/ui';

export function HomePage() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<Experience[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [latestReviews, setLatestReviews] = useState<PublicReview[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    experiencesApi
      .list({ featured: true, limit: 6, sortBy: 'rating', sortOrder: 'desc' })
      .then((r) => setFeatured(r.items))
      .catch(() => setFeatured([]));
    contentApi
      .upcomingEvents(14)
      .then((r) => setEvents(r))
      .catch(() => setEvents([]));
    contentApi
      .guides({ featured: true, limit: 4 })
      .then((r) => setGuides(r.items))
      .catch(() => setGuides([]));
    reviewsApi
      .latest(6)
      .then((r) => setLatestReviews(r))
      .catch(() => setLatestReviews([]));
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/experiences?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="page page-flush">
      <section className="hero">
        <h1>Medellín, tu próxima aventura</h1>
        <p>Experiencias únicas, guías locales y el concierge con Héctor.</p>
        <form className="hero-search" onSubmit={submitSearch}>
          <IconSearch width={20} height={20} style={{ color: 'var(--color-text-muted)' }} />
          <input
            placeholder="¿Qué quieres vivir hoy?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar experiencias"
          />
          <button className="btn btn-primary btn-sm" type="submit" aria-label="Buscar">
            Buscar
          </button>
        </form>
      </section>

      <div className="page">
        <div className="chip-row" style={{ marginBottom: 'var(--space-4)' }}>
          <Link to="/experiences?category=tour" className="chip">Tours</Link>
          <Link to="/experiences?category=nightlife" className="chip">Vida nocturna</Link>
          <Link to="/experiences?category=food" className="chip">Gastronomía</Link>
          <Link to="/experiences?category=culture" className="chip">Cultura</Link>
          <Link to="/map" className="chip">🗺️ Mapa</Link>
        </div>

        <section className="band meet-hector">
          <div className="avatar avatar-lg">
            <img src="/icon.svg" alt="" />
          </div>
          <div className="meet-hector-body">
            <span className="badge badge-accent">Tu local en Medellín</span>
            <h2>Conoce a Héctor</h2>
            <p>
              Medellinero de corazón: te arma el plan perfecto, desde tours culturales hasta la
              vida nocturna que solo los locales conocen. Escríbele y te responde al toque.
            </p>
            <Link to="/concierge" className="btn btn-accent btn-sm">
              <IconChat width={16} height={16} /> Hablar con Héctor
            </Link>
          </div>
        </section>

        <div className="section-title">
          <span>Experiencias destacadas</span>
          <Link to="/experiences" className="more">Ver todas</Link>
        </div>
        {featured === null ? (
          <Spinner />
        ) : featured.length === 0 ? (
          <EmptyState title="Aún no hay experiencias destacadas" message="Las mejores de Medellín aparecerán aquí pronto." />
        ) : (
          <div className="exp-list">
            {featured.map((exp) => (
              <ExperienceCard key={exp.id} experience={exp} featured />
            ))}
          </div>
        )}

        <div className="section-title">
          <span>What's happening</span>
          <span className="more" style={{ fontWeight: 400 }}>Lo que pasa en Medellín</span>
        </div>
        {events === null ? (
          <Spinner />
        ) : events.length === 0 ? (
          <EmptyState title="Sin eventos próximos" message="Cuando se publiquen los verás aquí." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.slice(0, 5).map((ev) => (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className="card card-flat"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: 'var(--color-primary-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCalendar width={24} height={24} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{ev.titleEs || ev.titleEn}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>{formatDate(ev.startsAt)}</div>
                </div>
                <IconArrow width={18} height={18} style={{ color: 'var(--color-text-muted)' }} />
              </Link>
            ))}
          </div>
        )}

        <div className="section-title">
          <span>Reviews</span>
          <span className="more" style={{ fontWeight: 400 }}>Viajeros como tú ya lo vivieron</span>
        </div>
        {latestReviews === null ? (
          <Spinner />
        ) : latestReviews.length === 0 ? (
          <EmptyState title="Testimonios en camino" message="Las primeras reseñas verificadas se publican aquí." />
        ) : (
          <div className="testimonial-list">
            {latestReviews.map((r) => (
              <article key={r.id} className="testimonial">
                <Stars value={r.rating} />
                <p className="testimonial-text">“{r.content}”</p>
                <div className="testimonial-meta">
                  <span className="avatar avatar-sm">
                    <IconUsers width={14} height={14} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{r.reviewerFirstName}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>
                      {r.reviewerCountry || 'Viaje verificado'}
                      {r.verified && r.reviewerCountry ? ' · Verificada' : r.verified ? 'Verificada' : ''}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)', marginTop: 8 }}>
                  <IconStar width={12} height={12} style={{ verticalAlign: -2, color: 'var(--color-warning)' }} />
                  {r.experienceTitleEs || r.experienceTitleEn || 'Experiencia'}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="section-title">
          <span>Guías de Héctor</span>
          <Link to="/guides" className="more">Ver más</Link>
        </div>
        {guides === null ? (
          <Spinner />
        ) : guides.length === 0 ? (
          <EmptyState title="Guías en camino" message="Las guías locales se publican aquí." />
        ) : (
          guides.slice(0, 4).map((g) => (
            <Link key={g.id} to={`/guides/${g.slug}`} className="guide-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              {g.coverImageUrl ? <img src={g.coverImageUrl} alt="" /> : <div style={{ width: 84, height: 84, borderRadius: 12, background: 'var(--color-surface-muted)' }} />}
              <div className="body">
                <h3>{g.titleEs}</h3>
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>{g.summaryEs}</p>
              </div>
            </Link>
          ))
        )}

        <section className="show-band">
          <span className="badge badge-accent">The Medellín Show</span>
          <h2>No es solo un tour, es un show</h2>
          <p>
            Experiencias curadas por locales, con pago seguro y reembolsos protegidos. Si Héctor
            dice que vale la pena, vale la pena.
          </p>
          <div className="show-band-cta">
            <Link to="/experiences" className="btn btn-primary">Explorar experiencias</Link>
            <Link to="/map" className="btn btn-ghost">
              <IconExplore width={16} height={16} /> Ver mapa
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}