import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contentApi } from '../api';
import type { Guide } from '../api/types';
import { EmptyState, Spinner } from '../components/ui';

export function GuidesPage() {
  const [guides, setGuides] = useState<Guide[] | null>(null);

  useEffect(() => {
    contentApi
      .guides({ limit: 30 })
      .then((r) => setGuides(r.items))
      .catch(() => setGuides([]));
  }, []);

  return (
    <div className="page">
      <h1 style={{ margin: '0 0 4px', fontSize: 'var(--fs-xl)' }}>Guías de Héctor</h1>
      <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>
        Barrios, itinerarios, seguridad y transporte para moverte como local.
      </p>

      {guides === null ? (
        <Spinner />
      ) : guides.length === 0 ? (
        <EmptyState title="Sin guías publicadas" message="Las guías locales llegarán pronto." />
      ) : (
        guides.map((g) => (
          <Link key={g.id} to={`/guides/${g.slug}`} className="guide-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            {g.coverImageUrl ? <img src={g.coverImageUrl} alt="" /> : <div style={{ width: 84, height: 84, borderRadius: 12, background: 'var(--color-primary-soft)' }} />}
            <div className="body">
              <span className="badge badge-muted">{g.category}</span>
              <h3>{g.titleEs}</h3>
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>{g.summaryEs}</p>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}