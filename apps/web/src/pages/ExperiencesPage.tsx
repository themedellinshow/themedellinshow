import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { experiencesApi } from '../api';
import type { Experience, ExperienceQuery } from '../api/types';
import { EXPERIENCE_CATEGORIES, NEIGHBORHOODS } from '../lib/format';
import { ExperienceCard } from '../components/ExperienceCard';
import { Button, EmptyState, Select, Spinner } from '../components/ui';

const LIMIT = 20;

export function ExperiencesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = searchParams.get('category') ?? '';
  const neighborhood = searchParams.get('neighborhood') ?? '';
  const search = searchParams.get('search') ?? '';
  const sortBy = (searchParams.get('sort') ?? 'created') as ExperienceQuery['sortBy'];
  const lgbtq = searchParams.get('lgbtq') === '1';

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setPage(1);
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const query: ExperienceQuery = {
      category: category || undefined,
      neighborhood: neighborhood || undefined,
      search: search || undefined,
      sortBy,
      lgbtqFriendly: lgbtq || undefined,
      page,
      limit: LIMIT,
    };
    experiencesApi
      .list(query)
      .then((r) => {
        if (cancelled) return;
        setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items]));
        setHasMore(r.items.length === LIMIT && page < r.meta.totalPages);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las experiencias.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, neighborhood, search, sortBy, lgbtq, page]);

  function loadMore() {
    setPage((p) => p + 1);
  }

  return (
    <div className="page page-flush">
      <div className="page filter-bar" style={{ paddingTop: 'var(--space-3)' }}>
        <input
          className="input"
          placeholder="Buscar experiencia…"
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateParam('search', (e.target as HTMLInputElement).value);
          }}
        />
        <div className="chip-row" style={{ marginTop: 12 }}>
          {['Todas', ...EXPERIENCE_CATEGORIES].map((c) => {
            const v = c === 'Todas' ? '' : c;
            return (
              <button
                key={c}
                className={`chip${category === v ? ' chip-active' : ''}`}
                onClick={() => updateParam('category', v)}
              >
                {c === 'nightlife' ? 'Vida nocturna' : c === 'Todas' ? 'Todas' : c}
              </button>
            );
          })}
        </div>
        <div className="chip-row" style={{ marginTop: 8, marginBottom: 12 }}>
          <Select value={sortBy ?? 'created'} onChange={(e) => updateParam('sort', e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
            <option value="created">Recientes</option>
            <option value="rating">Mejor valoradas</option>
            <option value="price">Precio</option>
            <option value="popular">Populares</option>
          </Select>
          <Select value={neighborhood} onChange={(e) => updateParam('neighborhood', e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
            <option value="">Todos los barrios</option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="page">
        {error ? <div className="error-box">{error}</div> : null}
        {!error && items.length === 0 && !loading ? (
          <EmptyState title="Sin resultados" message="Prueba con otros filtros o términos de búsqueda." />
        ) : (
          <div className="exp-list" style={{ opacity: loading && page === 1 ? 0.4 : 1 }}>
            {items.map((exp) => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </div>
        )}
        {loading && page === 1 ? <Spinner /> : null}
        {hasMore ? (
          <Button variant="outline" size="block" onClick={loadMore} loading={loading} style={{ marginTop: 16 }}>
            Cargar más
          </Button>
        ) : null}
      </div>
    </div>
  );
}