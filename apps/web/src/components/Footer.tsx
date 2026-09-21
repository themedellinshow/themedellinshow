import { Link } from 'react-router-dom';

const columns = [
  {
    title: 'Explorar',
    links: [
      { to: '/experiences', label: 'Experiencias' },
      { to: '/map', label: 'Mapa' },
      { to: '/guides', label: 'Guías de Héctor' },
      { to: '/concierge', label: 'Concierge' },
    ],
  },
  {
    title: 'Cuenta',
    links: [
      { to: '/login', label: 'Entrar' },
      { to: '/register', label: 'Registrarse' },
      { to: '/profile', label: 'Mi perfil' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="page">
        <div className="footer-brand">
          <span className="brand">
            <img src="/icon.svg" alt="" />
            The Medellín Show
          </span>
          <p>
            Experiencias reales contadas por locales. Paga seguro y viaja con la confianza de
            saber que a Medellín la recorres con un amigo.
          </p>
        </div>
        <div className="footer-cols">
          {columns.map((col) => (
            <div key={col.title} className="footer-col">
              <h4>{col.title}</h4>
              {col.links.map((l) => (
                <Link key={l.to} to={l.to}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} The Medellín Show</span>
          <span className="footer-tagline">Hecho en Medellín 🇨🇴</span>
        </div>
      </div>
    </footer>
  );
}