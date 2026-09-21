import { Link, NavLink, Outlet } from 'react-router-dom';
import { IconChat, IconExplore, IconHome, IconMap, IconUser } from './Icons';
import { Footer } from './Footer';
import { useAuthStore } from '../store/auth';

const navItems = [
  { to: '/', label: 'Inicio', icon: IconHome },
  { to: '/experiences', label: 'Explorar', icon: IconExplore },
  { to: '/map', label: 'Mapa', icon: IconMap },
  { to: '/concierge', label: 'Concierge', icon: IconChat },
];

export function Layout() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/icon.svg" alt="" />
          The Medellín Show
        </Link>
        <div className="topbar-actions">
          {isAuthenticated && user ? (
            <Link to="/profile" aria-label="Mi perfil">
              <IconUser width={22} height={22} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Entrar
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Registrarse
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <Footer />

      <nav className="bottom-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => document.documentElement.scrollTop = 0}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <IconUser />
          <span>Perfil</span>
        </NavLink>
      </nav>
    </div>
  );
}