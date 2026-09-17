import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { conciergeApi } from '../api';
import { ApiError } from '../api/client';
import { useAuthStore } from '../store/auth';
import { Button, EmptyState } from '../components/ui';
import { IconSend } from '../components/Icons';

interface LocalTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Plan de 3 días en El Poblado',
  'Comida típica cerca de Provenza',
  'Vida nocturna LGBTQ+ friendly',
  'Presupuesto moderado, pareja',
];

export function ConciergePage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<LocalTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  useEffect(() => {
    if (!isAuthenticated) return;
    conciergeApi
      .sessions()
      .then((sessions) => {
        const last = sessions[0];
        if (last && last.turns.length > 0) {
          setSessionId(last.sessionId);
          setTurns(last.turns.map((t) => ({ role: t.role, content: t.content })));
        }
      })
      .catch(() => undefined);
  }, [isAuthenticated]);

  async function send(message: string) {
    const text = message.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    setInput('');
    setTurns((t) => [...t, { role: 'user', content: text }]);
    try {
      const res = await conciergeApi.chat({
        sessionId: sessionId ?? undefined,
        message: text,
        language: 'es',
      });
      setSessionId(res.sessionId);
      setTurns((t) => [...t, { role: 'assistant', content: res.response }]);
      return res;
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo contactar al concierge.');
      setTurns((t) => [...t, { role: 'assistant', content: 'Lo sentimos, el concierge no está disponible ahora. Intenta de nuevo en un momento.' }]);
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="page">
        <EmptyState
          title="Concierge con Héctor"
          message="Tu asistente local con IA para planear Medellín. Inicia sesión para chatear."
          action={<Button variant="accent" onClick={() => navigate('/login')}>Iniciar sesión</Button>}
        />
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingTop: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>Concierge 🧭</h1>
        {turns.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => { setTurns([]); setSessionId(null); setError(null); }}>
            Nuevo chat
          </Button>
        ) : null}
      </div>
      <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>
        Héctor te recomienda experiencias, barrios y planes según tus gustos.
      </p>

      <div className="chat-shell">
        {turns.length === 0 ? (
          <div className="chat-start">
            <p>Empieza preguntándole a Héctor, por ejemplo:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" onClick={() => send(s)}>{s}</Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-log" ref={logRef}>
            {turns.map((t, i) => (
              <div key={i} className={`bubble ${t.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                {t.content}
              </div>
            ))}
            {busy ? <div className="bubble bubble-ai skeleton" style={{ width: 120, height: 20 }} /> : null}
          </div>
        )}

        {error ? <div className="error-box">{error}</div> : null}

        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            className="input"
            placeholder="Pregúntale a Héctor…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Mensaje para el concierge"
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()} aria-label="Enviar">
            <IconSend width={18} height={18} />
          </button>
        </form>
      </div>
    </div>
  );
}