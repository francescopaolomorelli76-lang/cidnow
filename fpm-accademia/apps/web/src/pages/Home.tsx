import { Link } from 'react-router';
import { BRAND, COMMERCIAL } from '@fpm/shared';
import { Logo } from '../components/Brand.js';
import { StudentIcon, TeacherIcon } from '../components/Icons.js';
import { useSession } from '../session.js';

export function Home() {
  const { me } = useSession();
  const teacherHref = me?.role === 'teacher' ? '/docente' : '/accedi?ruolo=teacher';
  const studentHref = me?.role === 'student' ? '/allievo' : '/accedi?ruolo=student';
  return (
    <div className="stack">
      <section className="hero">
        <Logo size={512} className="hero-logo" />
        <h1>
          <span className="gold-text">{BRAND.appName}</span>
        </h1>
        <p className="lead">
          Lezioni di musica dal vivo, in modo privato: ogni docente con i propri allievi, collegati tramite invito e
          approvazione.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn" to="/discipline">
            Scopri le discipline
          </Link>
        </div>
      </section>

      <section aria-labelledby="ruolo" className="stack">
        <h2 id="ruolo" style={{ textAlign: 'center' }}>
          Chi sei?
        </h2>
        <div className="grid-2">
          <Link to={teacherHref} className="card gold role-card" data-testid="role-teacher">
            <TeacherIcon className="icon" />
            <h3>Sono un docente</h3>
            <p className="muted">
              Crea il tuo spazio, invita i tuoi allievi, prepara lezioni e materiali. Prova gratuita di{' '}
              {COMMERCIAL.trialHours} ore senza carta, poi {COMMERCIAL.teacherLicenseLabel}.
            </p>
            <span className="btn primary">Entra come docente</span>
          </Link>
          <Link to={studentHref} className="card gold role-card" data-testid="role-student">
            <StudentIcon className="icon" />
            <h3>Sono un allievo</h3>
            <p className="muted">
              Gratis. Inserisci il codice che ti ha dato il tuo docente: dopo la sua approvazione vedrai le tue lezioni.
            </p>
            <span className="btn primary">Entra come allievo</span>
          </Link>
        </div>
      </section>

      <section className="card">
        <h3>Da sapere</h3>
        <p className="muted">
          Questa è una versione di sviluppo. Via Internet la latenza zero non esiste: la voce e il suono dal vivo
          arrivano sempre con un piccolo ritardo, che misureremo e mostreremo durante la lezione. Lo stato di ogni
          funzione è indicato in <Link to="/info">Informazioni</Link>.
        </p>
      </section>
    </div>
  );
}
