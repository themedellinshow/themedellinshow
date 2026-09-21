import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usersApi } from '../api';
import { useAuthStore } from '../store/auth';
import type { User } from '../api/types';
import { EmptyState, Spinner } from './ui';

const adminNav = [{ to: '/admin/crm', label: 'CRM' }];

export function AdminLayout() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [user, setLocalUser] = useState<User | null>(null);
  const [gate, setGate] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    usersApi
      .me()
      .then((u) => {
        setUser(u);
        setLocalUser(u);
        setGate(u.role === 'admin' || u.role === 'partner' ? 'ok' : 'denied');
      })
      .catch(() => setGate('denied'));
  }, [setUser]);

  if (gate === 'loading') {
    return (
      <div className="admin-shell">
        <div style={{ padding: 'var(--space-6)' }}>
          <Spinner />
        </div>
      </div>
    );
  }

  if (gate === 'denied') {
    return (
      <div className="admin-shell admin-gated">
        <EmptyState
          title="Acceso restringido"
          message="Inicia sesión con una cuenta de administrador o partner para ver el panel."
          action={
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              Entrar
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <Link to="/admin/crm" className="brand">
          <img src="/icon.svg" alt="" />
          The Medellín Show
        </Link>
        <div className="topbar-actions">
          <span className="badge badge-accent">{user?.role}</span>
          <Link to="/" className="btn btn-ghost btn-sm">
            Ver sitio
          </Link>
        </div>
      </div>
      <div className="admin-body">
        <aside className="admin-sidebar">
          {adminNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/admin'}
              className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}
            >
              {n.label}
            </NavLink>
          ))}
        </aside>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}