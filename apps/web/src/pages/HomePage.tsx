import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { contentApi, experiencesApi } from '../api';
import type { Event, Experience, Guide } from '../api/types';
import { formatDate } from '../lib/format';
import { ExperienceCard } from '../components/ExperienceCard';
import { IconCalendar, IconSearch } from '../components/Icons';
import { EmptyState, Spinner } from '../components/ui';

export function HomePage() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<Experience[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [guides, setGuides] = useState<Guide[] | null>(null);
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
          <span>Próximos eventos</span>
          <Link to="/experiences" className="more" />
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
              </Link>
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
      </div>
    </div>
  );
}