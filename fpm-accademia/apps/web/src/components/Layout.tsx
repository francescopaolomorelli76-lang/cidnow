import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { BRAND, type FeatureState } from '@fpm/shared';
import { useSession } from '../session.js';
import { Footer, Logo } from './Brand.js';

export function Layout({ children }: { children: ReactNode }) {
  const { me, logout } = useSession();
  const navigate = useNavigate();
  return (
    <>
      <a href="#main" className="visually-hidden">
        Vai al contenuto
      </a>
      <header className="app-header">
        <Link to="/" className="brand-link" aria-label={`${BRAND.shortName} — ${BRAND.appName}, home`}>
          <Logo size={128} />
          <span className="gold-text">{BRAND.appName}</span>
        </Link>
        <nav className="app-nav" aria-label="Principale">
          {me?.role === 'teacher' && <NavLink to="/docente">Area docente</NavLink>}
          {me?.role === 'student' && <NavLink to="/allievo">Area allievo</NavLink>}
          {me && <NavLink to="/setup">Smart Setup</NavLink>}
          <NavLink to="/info">Informazioni</NavLink>
          {me ? (
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
            >
              Esci
            </button>
          ) : (
            <NavLink to="/accedi">Accedi</NavLink>
          )}
        </nav>
      </header>
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}

const STATE_LABEL: Record<FeatureState, string> = {
  implemented: 'Implementato',
  verified: 'Verificato',
  mock: 'Simulato (mock)',
  planned: 'Pianificato',
  blocked: 'Bloccato',
};

export function StatusBadge({ state }: { state: FeatureState }) {
  return <span className={`badge ${state}`}>{STATE_LABEL[state]}</span>;
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      {error}
    </div>
  );
}
