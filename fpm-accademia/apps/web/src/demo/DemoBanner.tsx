import { useNavigate } from 'react-router';
import { post } from '../lib/api.js';
import { useSession } from '../session.js';
import { DEMO_PASSWORD, resetDemo } from './mockApi.js';

/** Banner della demo online: spiega i limiti e permette di cambiare ruolo con un tocco. */
export function DemoBanner() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  async function loginAs(email: string, to: string) {
    await post('/api/auth/logout').catch(() => {});
    await post('/api/auth/login', { email, password: DEMO_PASSWORD });
    await refresh();
    navigate(to);
  }
  return (
    <div className="demo-banner" role="note">
      <p>
        <strong>Demo online.</strong> I dati restano solo in questo browser; videocamera, microfono e test di rete
        funzionano solo nell’app vera. {me ? <>Sei entrato come <strong>{me.displayName}</strong>.</> : null}
      </p>
      <div className="row">
        <button className="btn small" onClick={() => loginAs('docente@demo.local', '/docente')} data-testid="demo-teacher">Entra come Docente demo</button>
        <button className="btn small" onClick={() => loginAs('allievo@demo.local', '/allievo')} data-testid="demo-student">Entra come Allievo demo</button>
        <button className="btn small" onClick={async () => { resetDemo(); await refresh(); navigate('/'); }}>Azzera demo</button>
      </div>
    </div>
  );
}
