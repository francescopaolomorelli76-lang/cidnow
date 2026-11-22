import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import type { Role } from '@fpm/shared';
import { ErrorBox } from '../components/Layout.js';
import { ApiError, post } from '../lib/api.js';
import { useSession } from '../session.js';

export function Auth() {
  const [params] = useSearchParams();
  const initialRole: Role = params.get('ruolo') === 'student' ? 'student' : 'teacher';
  const [mode, setMode] = useState<'register' | 'login'>(params.get('modo') === 'login' ? 'login' : 'register');
  const [role, setRole] = useState<Role>(initialRole);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdult, setIsAdult] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Destinazione dopo l'invio: nuovo account → Smart Setup, accesso → propria area.
  const [target, setTarget] = useState<string | null>(null);
  const { me, refresh } = useSession();

  if (me) return <Navigate to={target ?? (me.role === 'teacher' ? '/docente' : '/allievo')} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === 'register'
          ? await post<{ role: Role }>('/api/auth/register', {
              email, password, displayName, role, isAdult, acceptTerms, acceptPrivacy,
            })
          : await post<{ role: Role }>('/api/auth/login', { email, password });
      setTarget(mode === 'register' ? '/setup' : res.role === 'teacher' ? '/docente' : '/allievo');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore imprevisto');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1>{mode === 'register' ? 'Crea il tuo account' : 'Accedi'}</h1>
      <div className="row" role="tablist" aria-label="Modalità">
        <button type="button" role="tab" aria-selected={mode === 'register'} className={`btn small${mode === 'register' ? ' primary' : ''}`} onClick={() => setMode('register')}>
          Registrati
        </button>
        <button type="button" role="tab" aria-selected={mode === 'login'} className={`btn small${mode === 'login' ? ' primary' : ''}`} onClick={() => setMode('login')}>
          Ho già un account
        </button>
      </div>
      <form className="card stack" onSubmit={submit} noValidate>
        {mode === 'register' && (
          <>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: 4 }}>Ruolo</legend>
              <div className="row">
                {(['teacher', 'student'] as const).map((r) => (
                  <label key={r} className="check" style={{ fontWeight: 400 }}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ width: 22, minHeight: 22 }} />
                    {r === 'teacher' ? 'Docente' : 'Allievo'}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="name">Nome visualizzato</label>
              <input id="name" autoComplete="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'register' ? 10 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'register' && <span className="hint">Almeno 10 caratteri. Il codice del docente non sostituisce la password.</span>}
        </div>
        {mode === 'register' && (
          <>
            <label className="check">
              <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} />
              <span>Ho almeno 18 anni</span>
            </label>
            {!isAdult && (
              <div className="alert warn">
                La registrazione dei minorenni richiede il consenso di un genitore o tutore: questo percorso è in
                preparazione (serve una verifica legale) e non è ancora attivo.
              </div>
            )}
            <label className="check">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              <span>Accetto i termini d’uso (bozza, versione di sviluppo)</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
              <span>
                Ho letto l’informativa privacy (bozza). Le registrazioni audio/video richiederanno un consenso
                separato.
              </span>
            </label>
          </>
        )}
        <ErrorBox error={error} />
        <button className="btn primary" type="submit" disabled={busy || (mode === 'register' && (!isAdult || !acceptTerms || !acceptPrivacy))}>
          {busy ? 'Attendere…' : mode === 'register' ? 'Crea account' : 'Accedi'}
        </button>
      </form>
      <p className="dim">
        Recupero password e verifica email: non ancora disponibili (vedi <Link to="/info">Informazioni</Link>).
      </p>
    </div>
  );
}
