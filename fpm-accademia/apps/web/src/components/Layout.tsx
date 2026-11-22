import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { BRAND, type FeatureState } from '@fpm/shared';
import { get } from '../lib/api.js';
import { useSession } from '../session.js';
import { Footer, Logo } from './Brand.js';
import { UiIcon, type IconName } from './UiIcon.js';

interface NavItem { to: string; label: string; icon: IconName; end?: boolean }

function navFor(role: 'teacher' | 'student' | null): NavItem[] {
  if (role === 'teacher') {
    return [
      { to: '/', label: 'Home', icon: 'home', end: true },
      { to: '/lezione', label: 'Lezione Live', icon: 'live' },
      { to: '/docente', label: 'Allievi e Calendario', icon: 'users' },
      { to: '/discipline', label: 'Strumenti', icon: 'music' },
      { to: '/setup', label: 'Smart Setup', icon: 'setup' },
      { to: '/info', label: 'Info', icon: 'info' },
    ];
  }
  if (role === 'student') {
    return [
      { to: '/', label: 'Home', icon: 'home', end: true },
      { to: '/lezione', label: 'Lezione Live', icon: 'live' },
      { to: '/allievo', label: 'Le mie lezioni', icon: 'calendar' },
      { to: '/setup', label: 'Smart Setup', icon: 'setup' },
      { to: '/info', label: 'Info', icon: 'info' },
    ];
  }
  return [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/discipline', label: 'Strumenti', icon: 'music' },
    { to: '/info', label: 'Info', icon: 'info' },
    { to: '/accedi?modo=login', label: 'Accedi', icon: 'login' },
  ];
}

export function Layout({ children }: { children: ReactNode }) {
  const { me, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => setOpen(false), [location.pathname]);

  // Campanella del docente: numero reale di richieste di collegamento in attesa.
  useEffect(() => {
    if (me?.role !== 'teacher') return setPending(0);
    get<{ status: string }[]>('/api/teacher/links')
      .then((l) => setPending(l.filter((x) => x.status === 'pending').length))
      .catch(() => {});
  }, [me, location.pathname]);

  const items = navFor(me?.role ?? null);
  const area = me?.role === 'teacher' ? '/docente' : me?.role === 'student' ? '/allievo' : '/accedi?modo=login';

  return (
    <div className="shell">
      <a href="#main" className="visually-hidden">Vai al contenuto</a>
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Menu principale">
        <Link to="/" className="side-logo" aria-label={`${BRAND.shortName} — home`}>
          <Logo size={256} />
        </Link>
        <nav className="side-nav">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}>
              <UiIcon name={it.icon} />
              <span>{it.label}</span>
            </NavLink>
          ))}
          {me && (
            <button type="button" onClick={async () => { await logout(); navigate('/'); }}>
              <UiIcon name="logout" />
              <span>Esci</span>
            </button>
          )}
        </nav>
        <div className="side-tagline" aria-hidden="true">Insieme per la Musica</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="content">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" aria-label="Apri menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <UiIcon name={open ? 'close' : 'menu'} />
          </button>
          <Link to="/" className="mobile-logo" aria-hidden="true" tabIndex={-1}><Logo size={128} /></Link>
          <div className="titles">
            <div className="app-title">
              {BRAND.appName} <span className="gold-text">FPM</span>
            </div>
            <div className="app-sub">La musica, ovunque tu sia</div>
          </div>
          <div className="top-actions">
            {me?.role === 'teacher' && (
              <Link to="/docente" className="icon-btn" aria-label={`Notifiche: ${pending} richieste in attesa`}>
                <UiIcon name="bell" />
                {pending > 0 && <span className="notif" data-testid="notif-count">{pending}</span>}
              </Link>
            )}
            {me && <Link to="/setup" className="icon-btn" aria-label="Impostazioni dispositivi"><UiIcon name="settings" /></Link>}
            <Link to={area} className="user-chip" aria-label={me ? `Profilo: ${me.displayName}` : 'Accedi'}>
              <UiIcon name="user" />
              <span>{me ? `${me.role === 'teacher' ? 'Docente' : 'Allievo'}: ${me.displayName}` : 'Accedi'}</span>
            </Link>
          </div>
        </header>
        <main id="main">{children}</main>
        <Footer />
      </div>
    </div>
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
