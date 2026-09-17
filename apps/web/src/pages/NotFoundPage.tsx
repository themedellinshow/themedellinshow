import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="page">
      <div className="empty-state">
        <p style={{ fontSize: 42, margin: 0 }}>404</p>
        <p style={{ fontWeight: 700 }}>Página no encontrada</p>
        <p style={{ color: 'var(--color-text-muted)' }}>La página que buscas no existe o se movió.</p>
        <Link to="/">
          <Button variant="primary">Volver al inicio</Button>
        </Link>
      </div>
    </div>
  );
}