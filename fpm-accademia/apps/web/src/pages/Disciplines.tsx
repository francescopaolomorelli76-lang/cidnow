import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { DISCIPLINES, TOOL_LABELS, getDiscipline, type DisciplineId } from '@fpm/shared';
import { DisciplineIcon } from '../components/Icons.js';
import { ErrorBox, StatusBadge } from '../components/Layout.js';
import { ApiError, get, put } from '../lib/api.js';
import { useSession } from '../session.js';

export const COVER_PRESETS = [
  { id: 'studio', label: 'Studio' },
  { id: 'palco', label: 'Palco' },
  { id: 'aula', label: 'Aula' },
  { id: 'minimal', label: 'Essenziale' },
] as const;
export type CoverPreset = (typeof COVER_PRESETS)[number]['id'];

export function Disciplines() {
  const { me } = useSession();
  const [selected, setSelected] = useState<DisciplineId>('canto');
  const [cover, setCover] = useState<CoverPreset>('studio');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTeacher = me?.role === 'teacher';

  useEffect(() => {
    if (!isTeacher) return;
    get<{ discipline: DisciplineId | null; coverPreset: CoverPreset }>('/api/teacher/profile')
      .then((p) => {
        if (p.discipline) setSelected(p.discipline);
        setCover(p.coverPreset);
      })
      .catch(() => {});
  }, [isTeacher]);

  const d = getDiscipline(selected)!;

  async function save() {
    setError(null);
    try {
      await put('/api/teacher/profile', { discipline: selected, coverPreset: cover, bio: '' });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore');
    }
  }

  return (
    <div className="stack">
      <h1>Scegli la disciplina</h1>
      <p className="muted">
        La disciplina cambia gli strumenti didattici e la copertina. L’identità grafica resta la stessa per tutti.
      </p>
      <div className="grid" role="group" aria-label="Discipline">
        {DISCIPLINES.map((x) => (
          <button
            key={x.id}
            type="button"
            className="discipline-card"
            aria-pressed={selected === x.id}
            onClick={() => {
              setSelected(x.id);
              setSaved(false);
            }}
            data-testid={`discipline-${x.id}`}
          >
            <DisciplineIcon id={x.id} />
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>{x.label}</strong>
            <span className="dim">{x.tagline}</span>
          </button>
        ))}
      </div>

      <section className={`cover ${cover}`} aria-live="polite">
        <DisciplineIcon id={d.id} className="cover-icon" />
        <h2 className="gold-text">{d.label}</h2>
        <p className="muted" style={{ maxWidth: 560 }}>{d.tagline}</p>
        <p className="dim">Strumenti: {d.instruments.join(', ')}</p>
        <div className="tool-chips">
          {d.tools.map((t) => (
            <span className="chip" key={t}>{TOOL_LABELS[t]}</span>
          ))}
        </div>
      </section>

      <div className="card stack">
        <h3>Video in lezione</h3>
        {d.video.kind === 'drums-multicam' ? (
          <>
            <p>
              Solo per la batteria: da 1 fino a 4 camere facoltative, sia per il docente sia per l’allievo (
              {d.video.views.join(', ')}). <StatusBadge state="planned" />
            </p>
            <p className="dim">La multicamera non è ancora disponibile: sarà sviluppata e misurata nella Fase G.</p>
          </>
        ) : (
          <p>Videocamera standard singola. <StatusBadge state="planned" /> <span className="dim">(videolezione: Fase D)</span></p>
        )}
        {d.midiRelevant && (
          <p className="dim">
            MIDI utile per questa disciplina: puoi già provare tastiera e pedale nello <Link to="/setup">Smart Setup</Link>.
          </p>
        )}
      </div>

      {isTeacher ? (
        <div className="card stack">
          <h3>La tua copertina</h3>
          <p className="dim">Puoi scegliere lo stile della copertina; colori, logo e leggibilità restano quelli FPM.</p>
          <div className="row" role="radiogroup" aria-label="Copertina">
            {COVER_PRESETS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={cover === c.id} className={`btn small${cover === c.id ? ' primary' : ''}`} onClick={() => { setCover(c.id); setSaved(false); }}>
                {c.label}
              </button>
            ))}
          </div>
          <ErrorBox error={error} />
          {saved && <div className="alert ok" role="status">Disciplina salvata.</div>}
          <div className="row">
            <button type="button" className="btn primary" onClick={save} data-testid="save-discipline">
              Imposta «{d.label}» come mia disciplina
            </button>
            <Link className="btn" to="/docente">Area docente</Link>
          </div>
        </div>
      ) : (
        !me && (
          <p className="muted">
            Sei un docente? <Link to="/accedi?ruolo=teacher">Crea il tuo account</Link> per impostare la tua disciplina.
          </p>
        )
      )}
    </div>
  );
}
