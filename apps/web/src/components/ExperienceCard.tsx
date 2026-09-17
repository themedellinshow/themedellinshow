import { Link } from 'react-router-dom';
import type { Experience } from '../api/types';
import { formatCop } from '../lib/format';
import { Stars } from './ui';

export function ExperienceCard({ experience, featured = false }: { experience: Experience; featured?: boolean }) {
  const title = experience.titleEs || experience.titleEn;
  const image = experience.imageUrls?.[0];

  return (
    <Link to={`/experiences/${experience.id}`} className="exp-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="exp-media">
        {image ? (
          <img src={image} alt={title} loading="lazy" />
        ) : (
          <div className="exp-media-placeholder" aria-hidden />
        )}
        {featured ? <span className="badge badge-accent">Destacada</span> : null}
      </div>
      <div className="exp-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <h3 className="exp-title">{title}</h3>
          <Stars value={Number(experience.averageRating ?? 0)} />
        </div>
        <div className="exp-meta">
          {experience.durationMinutes ? `${Math.round(experience.durationMinutes / 60)}h · ` : ''}
          {experience.neighborhood}
        </div>
        <div className="money">{formatCop(experience.priceCop)}</div>
      </div>
    </Link>
  );
}