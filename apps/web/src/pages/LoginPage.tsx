import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { ApiError } from '../api/client';
import { useAuthStore } from '../store/auth';
import { Button, Field, Input } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tokens = await authApi.login({ email, password });
      setTokens(tokens);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <Link to="/" className="brand">
        <img src="/icon.svg" alt="" />
        The Medellín Show
      </Link>
      <div className="auth-card">
        <h1 style={{ marginTop: 0 }}>Entrar</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Bienvenido de vuelta. Accede a tu cuenta para reservar experiencias.</p>
        {error ? <div className="error-box">{error}</div> : null}
        <form onSubmit={submit}>
          <Field label="Correo electrónico">
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </Field>
          <Field label="Contraseña">
            <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Button type="submit" variant="primary" size="block" loading={busy}>
            Entrar
          </Button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}