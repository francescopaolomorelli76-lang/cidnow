import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { TOOL_LABELS, getDiscipline, type DisciplineId } from '@fpm/shared';
import { COVER, InstrumentGrid, SectionTitle } from '../components/InstrumentGrid.js';
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

function useTeacherProfile(enabled: boolean) {
  const [p, setP] = useState<{ discipline: DisciplineId | null; coverPreset: CoverPreset } | null>(null);
  useEffect(() => {
    if (enabled) get<typeof p>('/api/teacher/profile').then(setP).catch(() => {});
  }, [enabled]);
  return p;
}

export function Disciplines() {
  const { me } = useSession();
  const profile = useTeacherProfile(me?.role === 'teacher');
  return (
    <div className="stack">
      <SectionTitle sub="La disciplina cambia strumenti didattici e copertina; l’identità grafica resta la stessa.">Scegli il tuo strumento</SectionTitle>
      <InstrumentGrid hrefFor={(id) => `/discipline/${id}`} selected={profile?.discipline} />
    </div>
  );
}

export function DisciplineDetail() {
  const { id = '' } = useParams();
  const { me } = useSession();
  const isTeacher = me?.role === 'teacher';
  const profile = useTeacherProfile(isTeacher);
  const [cover, setCover] = useState<CoverPreset>('studio');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (profile) setCover(profile.coverPreset);
  }, [profile]);

  const d = getDiscipline(id);
  if (!d) return <Navigate to="/discipline" replace />;

  async function save() {
    setError(null);
    try {
      await put('/api/teacher/profile', { discipline: d!.id, coverPreset: cover, bio: '' });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore');
    }
  }

  return (
    <div className="stack">
      <section className={`hero-cover ${cover}`} style={{ backgroundImage: `url(${COVER[d.id]})` }}>
        <div className="hero-cover-text">
          <p className="display-caps small-caps">Accademia Musicale Online</p>
          <h1 className="gold-text">{d.label}</h1>
          <p className="muted">{d.tagline}</p>
          <p className="dim">{d.instruments.join(' · ')}</p>
        </div>
      </section>

      <div className="grid-2">
        <div className="card stack">
          <h2>Strumenti didattici</h2>
          <div className="tool-chips">
            {d.tools.map((t) => <span className="chip" key={t}>{TOOL_LABELS[t]}</span>)}
          </div>
          <h3>Video in lezione</h3>
          {d.video.kind === 'drums-multicam' ? (
            <p>
              Solo per la batteria: da 1 a 4 camere facoltative per docente e allievo ({d.video.views.join(', ')}).{' '}
              <StatusBadge state="planned" />
            </p>
          ) : (
            <p>Videocamera standard singola.</p>
          )}
          <div className="row">
            <Link className="btn primary" to={me ? `/lezione?d=${d.id}` : '/accedi?modo=login'} data-testid="open-room">
              Apri la stanza lezione
            </Link>
            <Link className="btn" to="/discipline">Tutti gli strumenti</Link>
          </div>
        </div>

        {isTeacher ? (
          <div className="card stack">
            <h2>La tua disciplina</h2>
            <p className="dim">Scegli lo stile della copertina: colori, logo e leggibilità restano quelli FPM.</p>
            <div className="row" role="radiogroup" aria-label="Copertina">
              {COVER_PRESETS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={cover === c.id} className={`btn small${cover === c.id ? ' primary' : ''}`} onClick={() => { setCover(c.id); setSaved(false); }}>
                  {c.label}
                </button>
              ))}
            </div>
            <ErrorBox error={error} />
            {saved && <div className="alert ok" role="status">Disciplina salvata.</div>}
            <button type="button" className="btn primary" onClick={save} data-testid="save-discipline">
              Imposta «{d.label}» come mia disciplina
            </button>
          </div>
        ) : (
          !me && (
            <div className="card stack">
              <h2>Insegni {d.label.toLowerCase()}?</h2>
              <p className="muted">Crea il tuo spazio docente e prova gratis per 24 ore.</p>
              <Link className="btn primary" to="/accedi?ruolo=teacher">Crea account docente</Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}
