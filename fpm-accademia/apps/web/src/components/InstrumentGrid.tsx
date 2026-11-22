import { Link } from 'react-router';
import type { DisciplineId } from '@fpm/shared';
import { UiIcon } from './UiIcon.js';
import { asset } from '../demo/env.js';

/**
 * Foto delle copertine: ritagli dalle anteprime grafiche fornite dal committente
 * (apps/web/public/covers). Segnaposto a bassa risoluzione: sostituire con foto ad alta
 * risoluzione di cui si possiedono i diritti.
 */
export const COVER: Record<DisciplineId, string> = {
  canto: asset('covers/canto.jpg'),
  pianoforte: asset('covers/pianoforte.jpg'),
  'chitarra-basso': asset('covers/chitarra-basso.jpg'),
  batteria: asset('covers/batteria.jpg'),
  archi: asset('covers/archi.jpg'),
  fiati: asset('covers/fiati.jpg'),
  teoria: asset('covers/teoria.jpg'),
};

/**
 * Le 9 card della home, come nell'anteprima grafica del committente.
 * Alcune card aprono la stessa disciplina (Chitarra/Basso → chitarra-basso; Violino/Archi → archi).
 */
const CARDS: { key: string; discipline: DisciplineId; title: string; sub: string; img: string }[] = [
  { key: 'canto', discipline: 'canto', title: 'Canto', sub: 'Pop, lirico e musical', img: 'covers/canto.jpg' },
  { key: 'pianoforte', discipline: 'pianoforte', title: 'Pianoforte', sub: 'e Tastiere', img: 'covers/pianoforte.jpg' },
  { key: 'chitarra', discipline: 'chitarra-basso', title: 'Chitarra', sub: 'Classica, Acustica ed Elettrica', img: 'covers/chitarra-basso.jpg' },
  { key: 'basso', discipline: 'chitarra-basso', title: 'Basso', sub: 'Elettrico e Acustico', img: 'covers/basso.jpg' },
  { key: 'batteria', discipline: 'batteria', title: 'Batteria', sub: 'e Percussioni', img: 'covers/batteria.jpg' },
  { key: 'violino', discipline: 'archi', title: 'Violino', sub: 'Viola, Violoncello e Contrabbasso', img: 'covers/archi.jpg' },
  { key: 'flauto', discipline: 'fiati', title: 'Flauto', sub: 'e Strumenti a Fiato', img: 'covers/flauto.jpg' },
  { key: 'archi', discipline: 'archi', title: 'Archi', sub: 'Violino, Viola, Violoncello, Contrabbasso', img: 'covers/archi2.jpg' },
  { key: 'teoria', discipline: 'teoria', title: 'Teoria Musicale', sub: 'Armonia e Composizione', img: 'covers/teoria.jpg' },
];

export function InstrumentGrid({ hrefFor, selected }: { hrefFor: (id: DisciplineId) => string; selected?: DisciplineId | null }) {
  return (
    <div className="instrument-grid">
      {CARDS.map((c) => (
        <Link
          key={c.key}
          to={hrefFor(c.discipline)}
          className={`instrument-card${selected === c.discipline ? ' selected' : ''}`}
          data-testid={`discipline-${c.key}`}
          aria-label={`${c.title} — ${c.sub}`}
        >
          <img src={asset(c.img)} alt="" loading="lazy" />
          <span className="ic-text">
            <strong>{c.title}</strong>
            <em>{c.sub}</em>
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
