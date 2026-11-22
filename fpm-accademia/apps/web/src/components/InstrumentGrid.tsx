import { Link } from 'react-router';
import { DISCIPLINES, type DisciplineId } from '@fpm/shared';
import { UiIcon } from './UiIcon.js';

/**
 * Foto delle copertine: ritagli dalle anteprime grafiche fornite dal committente
 * (apps/web/public/covers). Segnaposto a bassa risoluzione: sostituire con foto ad alta
 * risoluzione di cui si possiedono i diritti.
 */
export const COVER: Record<DisciplineId, string> = {
  canto: '/covers/canto.jpg',
  pianoforte: '/covers/pianoforte.jpg',
  'chitarra-basso': '/covers/chitarra-basso.jpg',
  batteria: '/covers/batteria.jpg',
  archi: '/covers/archi.jpg',
  fiati: '/covers/fiati.jpg',
  teoria: '/covers/teoria.jpg',
};

/** Titolo su due righe come nelle anteprime grafiche. */
const TITLE: Record<DisciplineId, [string, string?]> = {
  canto: ['Canto'],
  pianoforte: ['Pianoforte', 'e Tastiere'],
  'chitarra-basso': ['Chitarra', 'e Basso'],
  batteria: ['Batteria', 'e Percussioni'],
  archi: ['Archi'],
  fiati: ['Fiati'],
  teoria: ['Teoria', 'e Composizione'],
};

const SUB: Record<DisciplineId, string> = {
  canto: 'Pop, lirico e musical',
  pianoforte: 'Armonia, tecnica e repertorio',
  'chitarra-basso': 'Accordi, tecnica e accompagnamento',
  batteria: 'Ritmo, coordinazione e groove',
  archi: 'Violino, viola, violoncello, contrabbasso',
  fiati: 'Flauto traverso, sax, clarinetto, ottoni',
  teoria: 'Armonia, solfeggio, analisi',
};

export function InstrumentGrid({ hrefFor, selected }: { hrefFor: (id: DisciplineId) => string; selected?: DisciplineId | null }) {
  return (
    <div className="instrument-grid">
      {DISCIPLINES.map((d) => (
        <Link
          key={d.id}
          to={hrefFor(d.id)}
          className={`instrument-card${selected === d.id ? ' selected' : ''}`}
          data-testid={`discipline-${d.id}`}
          aria-current={selected === d.id ? 'true' : undefined}
          aria-label={d.label}
        >
          <img src={COVER[d.id]} alt="" loading="lazy" />
          <span className="ic-text">
            <strong>
              {TITLE[d.id][0]}
              {TITLE[d.id][1] && <small>{TITLE[d.id][1]}</small>}
            </strong>
            <em>{SUB[d.id]}</em>
          </span>
          <span className="ic-go" aria-hidden="true"><UiIcon name="chevron" size={20} /></span>
        </Link>
      ))}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="section-title">
      <span className="rule" aria-hidden="true" />
      <div>
        <h1>{children}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      <span className="rule" aria-hidden="true" />
    </div>
  );
}
