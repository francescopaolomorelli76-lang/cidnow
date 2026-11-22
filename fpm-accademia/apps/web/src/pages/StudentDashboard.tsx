import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { getDiscipline, type DisciplineId } from '@fpm/shared';
import { DisciplineIcon } from '../components/Icons.js';
import { ErrorBox, StatusBadge } from '../components/Layout.js';
import { ApiError, get, post } from '../lib/api.js';
import { useSession } from '../session.js';

interface LinkState { id: string; status: 'pending' | 'approved' | 'rejected' | 'revoked'; teacherName: string }
interface Teacher { displayName: string; discipline: DisciplineId | null; coverPreset: string }
interface Lesson { id: string; title: string; startsAt: string; durationMinutes: number; notes: string }

const fmt = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' });

export function StudentDashboard() {
  const { me, loading } = useSession();
  const [link, setLink] = useState<LinkState | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const l = await get<LinkState | null>('/api/student/link');
    setLink(l);
    if (l?.status === 'approved') {
      setTeacher(await get<Teacher>('/api/student/teacher'));
      setLessons(await get<Lesson[]>('/api/student/lessons'));
    } else {
      setTeacher(null);
      setLessons([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (me?.role === 'student') void load().catch(() => setLoaded(true));
  }, [me, load]);

  if (loading) return <p>Caricamento…</p>;
  if (!me) return <Navigate to="/accedi?ruolo=student&modo=login" replace />;
  if (me.role !== 'student') return <Navigate to="/docente" replace />;

  async function redeem(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post('/api/student/link-requests', { code });
      setCode('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore');
    }
  }

  async function leave(msg: string) {
    if (!confirm(msg)) return;
    await post('/api/student/link/leave');
    await load();
  }

  const discipline = teacher?.discipline ? getDiscipline(teacher.discipline) : undefined;
  const needsCode = loaded && (!link || link.status === 'rejected' || link.status === 'revoked');

  return (
    <div className="stack">
      <section className={`cover ${teacher?.coverPreset ?? 'studio'}`}>
        {discipline && <DisciplineIcon id={discipline.id} className="cover-icon" />}
        <p className="dim">Area allievo</p>
        <h1 className="gold-text">Ciao {me.displayName}</h1>
        {teacher && (
          <p className="muted" data-testid="my-teacher">
            Il tuo docente: <strong>{teacher.displayName}</strong>
            {discipline ? ` · ${discipline.label}` : ''}
          </p>
        )}
      </section>

      {link?.status === 'rejected' && <div className="alert warn">Il docente non ha approvato la richiesta. Puoi inserire un altro codice.</div>}
      {link?.status === 'revoked' && <div className="alert warn">Il collegamento con il docente è stato chiuso.</div>}

      {needsCode && (
        <form className="card gold stack" onSubmit={redeem} style={{ maxWidth: 520 }}>
          <h2>Collegati al tuo docente</h2>
          <div className="field">
            <label htmlFor="code">Codice invito</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCDE-12345"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '1.3rem', letterSpacing: '0.1em' }}
            />
            <span className="hint">Il codice te lo fornisce il docente. Dopo l’invio dovrà approvare la richiesta.</span>
          </div>
          <ErrorBox error={error} />
          <button className="btn primary" type="submit" disabled={code.replace(/[\s-]/g, '').length !== 10} data-testid="redeem">
            Invia richiesta
          </button>
        </form>
      )}

      {link?.status === 'pending' && (
        <div className="card stack" data-testid="pending">
          <h2>Richiesta inviata</h2>
          <p>
            In attesa che <strong>{link.teacherName}</strong> approvi il collegamento. Fino ad allora non vedrai lezioni o
            materiali.
          </p>
          <div className="row">
            <button className="btn small" onClick={() => load()}>Aggiorna</button>
            <button className="btn small danger" onClick={() => leave('Annullare la richiesta?')}>Annulla richiesta</button>
          </div>
        </div>
      )}

      {link?.status === 'approved' && (
        <>
          <section className="card stack" aria-labelledby="mylessons">
            <h2 id="mylessons">Le mie lezioni</h2>
            {lessons.length === 0 ? (
              <p className="dim">Nessuna lezione in calendario.</p>
            ) : (
              <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="lessons">
                {lessons.map((l) => (
                  <li key={l.id} className="card">
                    <strong>{l.title}</strong>
                    <div className="dim">{fmt(l.startsAt)} · {l.durationMinutes} min</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="dim">Videolezione dal vivo: <StatusBadge state="planned" /> (Fase D). Prepara intanto i dispositivi nello <Link to="/setup">Smart Setup</Link>.</p>
          </section>
          <div>
            <button className="btn small danger" onClick={() => leave('Vuoi lasciare il docente? Perderai l’accesso a lezioni e materiali.')}>
              Lascia il docente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
