import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi } from '../api';
import type { Guide, GuideSection } from '../api/types';
import { Button, Spinner } from '../components/ui';

function renderSection(section: GuideSection, index: number) {
  switch (section.type) {
    case 'heading':
      return <h3 key={index}>{section.content}</h3>;
    case 'paragraph':
      return <p key={index}>{section.content}</p>;
    case 'list':
      return (
        <ul key={index}>
          {(section.items ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'place-ref':
    case 'experience-ref':
      return (
        <div key={index} className="notice-box">
          <strong>{section.type === 'place-ref' ? 'Lugar' : 'Experiencia'}:</strong> {section.content}
          {section.refIds?.length ? (
            <span>
              {' '}
              <Link to="/map">Ver en el mapa</Link>
            </span>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}

export function GuideDetailPage() {
  const { slug } = useParams();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    contentApi
      .guideBySlug(slug)
      .then((g) => !cancelled && setGuide(g))
      .catch(() => !cancelled && setError('Guía no encontrada.'));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="page">
        <div className="error-box">{error}</div>
        <Link to="/guides" className="btn btn-outline btn-block">Volver a guías</Link>
      </div>
    );
  }
  if (!guide) return <Spinner />;

  const sections = guide.content?.es ?? [];

  return (
    <div className="page page-flush">
      {guide.coverImageUrl ? (
        <div style={{ aspectRatio: '16/8', background: 'var(--color-surface-muted)' }}>
          <img src={guide.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : null}
      <div className="page">
        <span className="badge badge-muted">{guide.category}</span>
        <h1 style={{ margin: '8px 0 4px', fontSize: 'var(--fs-xl)' }}>{guide.titleEs}</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>{guide.summaryEs}</p>

        {sections.map((s, i) => (
          <div key={i} className="guide-section-box">
            {renderSection(s, i)}
          </div>
        ))}

        {guide.relatedPlaceIds?.length ? (
          <Button variant="outline" size="block" onClick={() => (window.location.href = '/map')}>
            Ver lugares mencionados en el mapa
          </Button>
        ) : null}
      </div>
    </div>
  );
}