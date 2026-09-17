import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, referralsApi } from '../api';
import { ApiError } from '../api/client';
import { useAuthStore } from '../store/auth';
import { Button, Field, Input } from '../components/ui';

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tokens = await authApi.register({
        email,
        password,
        firstName,
        lastName,
        preferredLanguage: 'es',
        preferredCurrency: 'COP',
      });
      setTokens(tokens);
      if (referralCode.trim()) {
        try {
          await referralsApi.redeem(referralCode.trim());
        } catch {
          // Referral is optional: never block registration because of it.
        }
      }
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo crear la cuenta. Intenta de nuevo.');
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
        <h1 style={{ marginTop: 0 }}>Crear cuenta</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Descubre y reserva las mejores experiencias de Medellín.
        </p>
        {error ? <div className="error-box">{error}</div> : null}
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Field label="Nombre">
              <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Héctor" />
            </Field>
            <Field label="Apellido">
              <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Lavoe" />
            </Field>
          </div>
          <Field label="Correo electrónico">
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres.">
            <Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="Código de referido (opcional)" hint="¿Te invitaron a Medellín con Héctor? Escribe aquí su código.">
            <Input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="HECTOR-XXXXXX" />
          </Field>
          <Button type="submit" variant="accent" size="block" loading={busy}>
            Registrarme
          </Button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          ¿Ya tienes cuenta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}