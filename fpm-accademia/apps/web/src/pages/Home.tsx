import { Link } from 'react-router';
import { COMMERCIAL } from '@fpm/shared';
import { InstrumentGrid, SectionTitle } from '../components/InstrumentGrid.js';
import { StudentIcon, TeacherIcon } from '../components/Icons.js';
import { useSession } from '../session.js';

export function Home() {
  const { me } = useSession();
  return (
    <div className="stack">
      <SectionTitle sub="Seleziona la disciplina per iniziare la tua lezione">Scegli il tuo strumento</SectionTitle>
      <InstrumentGrid hrefFor={(id) => (me ? `/lezione?d=${id}` : `/discipline/${id}`)} />

      {!me && (
        <section aria-labelledby="ruolo" className="stack">
          <SectionTitle>Chi sei?</SectionTitle>
          <div className="grid-2">
            <Link to="/accedi?ruolo=teacher" className="card gold role-card" data-testid="role-teacher">
              <TeacherIcon className="icon" />
              <h2>Sono un docente</h2>
              <p className="muted">
                Il tuo spazio privato: invita gli allievi, prepara lezioni e materiali. Prova gratuita di {COMMERCIAL.trialHours} ore
                senza carta, poi {COMMERCIAL.teacherLicenseLabel}.
              </p>
              <span className="btn primary">Entra come docente</span>
            </Link>
            <Link to="/accedi?ruolo=student" className="card gold role-card" data-testid="role-student">
              <StudentIcon className="icon" />
              <h2>Sono un allievo</h2>
              <p className="muted">Gratis. Inserisci il codice del tuo docente: dopo la sua approvazione vedrai le tue lezioni.</p>
              <span className="btn primary">Entra come allievo</span>
            </Link>
          </div>
        </section>
      )}

      {me && (
        <div className="grid-2">
          <Link to="/lezione" className="card gold role-card">
            <h2>Lezione Live</h2>
            <p className="muted">Apri la stanza lezione e prova videocamera, microfono e strumenti didattici.</p>
            <span className="btn primary">Apri la stanza</span>
          </Link>
          <Link to={me.role === 'teacher' ? '/docente' : '/allievo'} className="card gold role-card">
            <h2>{me.role === 'teacher' ? 'Allievi e Calendario' : 'Le mie lezioni'}</h2>
            <p className="muted">{me.role === 'teacher' ? 'Inviti, richieste da approvare, allievi e lezioni.' : 'Il tuo docente e il calendario delle lezioni.'}</p>
            <span className="btn">Vai</span>
          </Link>
        </div>
      )}

      <p className="dim center">
        Versione di sviluppo: via Internet la latenza zero non esiste. Lo stato di ogni funzione è in <Link to="/info">Info</Link>.
      </p>
    </div>
  );
}
