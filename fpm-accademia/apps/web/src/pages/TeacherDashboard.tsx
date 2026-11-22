import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { COMMERCIAL, getDiscipline, type DisciplineId } from '@fpm/shared';
import { DisciplineIcon } from '../components/Icons.js';
import { ErrorBox, StatusBadge } from '../components/Layout.js';
import { ApiError, get, post } from '../lib/api.js';
import { useSession } from '../session.js';

interface Entitlement {
  state: 'none' | 'trial-active' | 'trial-expired' | 'licensed';
  serverNow: string;
  trialEndsAt: string | null;
  license: { provider: string; purchasedAt: string; isMock: boolean } | null;
  limits: { maxStudents: number; maxActiveInvitations: number; demoLessonMinutes: number } | null;
}
interface Invitation { id: string; codeHint: string; note: string; maxUses: number; uses: number; expiresAt: string; status: string }
interface LinkRow { id: string; status: string; studentId: string; studentName: string; requestedAt: string }
interface Student { id: string; displayName: string }
interface Lesson { id: string; studentName: string; title: string; startsAt: string; durationMinutes: number; status: string }

const fmt = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
const INVITE_STATUS: Record<string, string> = { active: 'Attivo', expired: 'Scaduto', used: 'Usato', revoked: 'Revocato' };

export function TeacherDashboard() {
  const { me, loading } = useSession();
  const [profile, setProfile] = useState<{ discipline: DisciplineId | null; coverPreset: string } | null>(null);
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [newCode, setNewCode] = useState<{ code: string; expiresAt: string; maxUses: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, e, i, l, s, le] = await Promise.all([
      get<typeof profile>('/api/teacher/profile'),
      get<Entitlement>('/api/teacher/entitlement'),
      get<Invitation[]>('/api/teacher/invitations'),
      get<LinkRow[]>('/api/teacher/links'),
      get<Student[]>('/api/teacher/students'),
      get<Lesson[]>('/api/teacher/lessons'),
    ]);
    setProfile(p);
    setEnt(e);
    setInvites(i);
    setLinks(l);
    setStudents(s);
    setLessons(le);
  }, []);

  useEffect(() => {
    if (me?.role === 'teacher') void load().catch((e) => setError(e instanceof ApiError ? e.message : 'Errore'));
  }, [me, load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore imprevisto');
    }
  };

  if (loading) return <p>Caricamento…</p>;
  if (!me) return <Navigate to="/accedi?ruolo=teacher&modo=login" replace />;
  if (me.role !== 'teacher') return <Navigate to="/allievo" replace />;

  const discipline = profile?.discipline ? getDiscipline(profile.discipline) : undefined;
  const pending = links.filter((l) => l.status === 'pending');
  const canWork = ent?.state === 'trial-active' || ent?.state === 'licensed';

  return (
    <div className="stack">
      <section className={`cover ${profile?.coverPreset ?? 'studio'}`}>
        {discipline && <DisciplineIcon id={discipline.id} className="cover-icon" />}
        <p className="dim">Area docente</p>
        <h1 className="gold-text">{me.displayName}</h1>
        <p className="muted">
          {discipline ? `Disciplina: ${discipline.label}` : 'Nessuna disciplina impostata.'}{' '}
          <Link to="/discipline">{discipline ? 'Cambia' : 'Scegli la disciplina'}</Link>
        </p>
      </section>

      <ErrorBox error={error} />

      {/* ---------- Prova e licenza ---------- */}
      <section className="card gold stack" aria-labelledby="lic">
        <h2 id="lic">Prova e licenza</h2>
        {ent?.state === 'none' && (
          <>
            <p>
              Prova gratuita di {COMMERCIAL.trialHours} ore, senza carta e senza rinnovi automatici. Funzioni ridotte:
              1 allievo, 1 invito attivo, lezione dimostrativa di {COMMERCIAL.trialDemoLessonMinutes} minuti.
            </p>
            <button className="btn primary" onClick={() => act(() => post('/api/teacher/trial'))} data-testid="start-trial">
              Avvia la prova di 24 ore
            </button>
          </>
        )}
        {ent?.state === 'trial-active' && (
          <p>
            Prova attiva fino al <strong>{fmt(ent.trialEndsAt!)}</strong> (orario calcolato dal server).{' '}
            <span className="dim">Limiti: {ent.limits?.maxStudents} allievo, {ent.limits?.maxActiveInvitations} invito attivo.</span>
          </p>
        )}
        {ent?.state === 'trial-expired' && <div className="alert warn">La prova di 24 ore è terminata. I tuoi dati restano salvati.</div>}
        {ent?.state === 'licensed' && (
          <p>
            Licenza permanente attiva dal {fmt(ent.license!.purchasedAt)}. Nessun rinnovo, nessun credito.{' '}
            {ent.license!.isMock && <StatusBadge state="mock" />}
          </p>
        )}
        {ent && ent.state !== 'licensed' && (
          <div className="stack">
            <p className="dim">
              Licenza docente: {COMMERCIAL.teacherLicenseLabel}. Gli allievi usano l’app gratis.
            </p>
            <div className="alert warn">
              Ambiente di sviluppo: l’acquisto qui sotto è <strong>simulato</strong> (PaymentProvider mock) e non
              addebita nulla. I pagamenti reali (App Store, Google Play, web) non sono ancora collegati.
            </div>
            <div className="row">
              <button className="btn" onClick={() => act(() => post('/api/teacher/license/purchase'))} data-testid="buy-license">
                Attiva licenza (simulazione)
              </button>
              <button className="btn small" onClick={() => act(() => post('/api/teacher/license/restore'))}>
                Ripristina acquisto
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid-2">
        {/* ---------- Inviti ---------- */}
        <section className="card stack" aria-labelledby="inv">
          <h2 id="inv">Invita un allievo</h2>
          <InviteForm
            disabled={!canWork}
            onCreate={(body) =>
              act(async () => setNewCode(await post<{ code: string; expiresAt: string; maxUses: number }>('/api/teacher/invitations', body)))
            }
          />
          {!canWork && <p className="dim">Avvia la prova o attiva la licenza per creare inviti.</p>}
          {newCode && (
            <div className="stack" role="status">
              <p>Comunica questo codice al tuo allievo (lo vedi solo ora):</p>
              <div className="code-display" data-testid="invite-code">{newCode.code}</div>
              <p className="dim">
                Valido fino al {fmt(newCode.expiresAt)} · {newCode.maxUses === 1 ? 'monouso' : `fino a ${newCode.maxUses} allievi`}.
                Dopo l’inserimento dovrai approvare la richiesta.
              </p>
              <button className="btn small" onClick={() => navigator.clipboard?.writeText(newCode.code)}>Copia codice</button>
            </div>
          )}
          {invites.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Codice</th><th>Stato</th><th>Usi</th><th>Scadenza</th><th /></tr></thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td>•••••-••{i.codeHint}</td>
                      <td>{INVITE_STATUS[i.status] ?? i.status}</td>
                      <td>{i.uses}/{i.maxUses}</td>
                      <td className="dim">{fmt(i.expiresAt)}</td>
                      <td>{i.status === 'active' && <button className="btn small danger" onClick={() => act(() => post(`/api/teacher/invitations/${i.id}/revoke`))}>Revoca</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------- Richieste ---------- */}
        <section className="card stack" aria-labelledby="req">
          <h2 id="req">Richieste in attesa</h2>
          {pending.length === 0 && <p className="dim">Nessuna richiesta.</p>}
          {pending.map((l) => (
            <div key={l.id} className="row" style={{ justifyContent: 'space-between' }} data-testid="pending-request">
              <span><strong>{l.studentName}</strong> <span className="dim">· {fmt(l.requestedAt)}</span></span>
              <span className="row">
                <button className="btn small primary" onClick={() => act(() => post(`/api/teacher/links/${l.id}/decision`, { decision: 'approve' }))}>Approva</button>
                <button className="btn small danger" onClick={() => act(() => post(`/api/teacher/links/${l.id}/decision`, { decision: 'reject' }))}>Rifiuta</button>
              </span>
            </div>
          ))}
          <h2>I miei allievi</h2>
          {students.length === 0 && <p className="dim">Nessun allievo collegato.</p>}
          {students.map((s) => {
            const link = links.find((l) => l.studentId === s.id && l.status === 'approved');
            return (
              <div key={s.id} className="row" style={{ justifyContent: 'space-between' }} data-testid="student-row">
                <strong>{s.displayName}</strong>
                {link && (
                  <button
                    className="btn small danger"
                    onClick={() => {
                      if (confirm(`Revocare l’accesso di ${s.displayName}? Non vedrà più lezioni e materiali.`)) {
                        void act(() => post(`/api/teacher/links/${link.id}/revoke`));
                      }
                    }}
                  >
                    Revoca accesso
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </div>

      {/* ---------- Lezioni ---------- */}
      <section className="card stack" aria-labelledby="les">
        <h2 id="les">Calendario lezioni</h2>
        <LessonForm students={students} disabled={!canWork} onCreate={(body) => act(() => post('/api/teacher/lessons', body))} />
        {lessons.length === 0 ? (
          <p className="dim">Nessuna lezione in calendario.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Allievo</th><th>Titolo</th><th>Durata</th></tr></thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.id}><td>{fmt(l.startsAt)}</td><td>{l.studentName}</td><td>{l.title}</td><td>{l.durationMinutes} min</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="dim">Videolezione dal vivo: <StatusBadge state="planned" /> (Fase D).</p>
      </section>
    </div>
  );
}

function InviteForm({ disabled, onCreate }: { disabled: boolean; onCreate: (b: { expiresInHours: number; maxUses: number; note: string }) => void }) {
  const [hours, setHours] = useState(72);
  const [maxUses, setMaxUses] = useState(1);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onCreate({ expiresInHours: hours, maxUses, note: '' });
  };
  return (
    <form className="row" onSubmit={submit} style={{ alignItems: 'flex-end' }}>
      <div className="field" style={{ flex: '1 1 120px' }}>
        <label htmlFor="inv-h">Validità</label>
        <select id="inv-h" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          <option value={24}>24 ore</option>
          <option value={72}>3 giorni</option>
          <option value={168}>7 giorni</option>
          <option value={336}>14 giorni</option>
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 120px' }}>
        <label htmlFor="inv-u">Utilizzi</label>
        <select id="inv-u" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))}>
          <option value={1}>Monouso</option>
          <option value={5}>Fino a 5 allievi</option>
          <option value={20}>Fino a 20 allievi</option>
        </select>
      </div>
      <button className="btn primary" type="submit" disabled={disabled} data-testid="create-invite">Genera codice</button>
    </form>
  );
}

function LessonForm({ students, disabled, onCreate }: { students: Student[]; disabled: boolean; onCreate: (b: object) => void }) {
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(45);
  if (students.length === 0) return <p className="dim">Collega almeno un allievo per pianificare lezioni.</p>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!when) return;
    onCreate({ studentId: studentId || students[0]!.id, title, startsAt: new Date(when).toISOString(), durationMinutes: duration, notes: '' });
    setTitle('');
  };
  return (
    <form className="row" onSubmit={submit} style={{ alignItems: 'flex-end' }}>
      <div className="field" style={{ flex: '1 1 160px' }}>
        <label htmlFor="ls">Allievo</label>
        <select id="ls" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {students.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '2 1 180px' }}>
        <label htmlFor="lt">Titolo</label>
        <input id="lt" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Vocalizzi e respirazione" />
      </div>
      <div className="field" style={{ flex: '1 1 200px' }}>
        <label htmlFor="lw">Data e ora</label>
        <input id="lw" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>
      <div className="field" style={{ flex: '0 1 110px' }}>
        <label htmlFor="ld">Minuti</label>
        <input id="ld" type="number" min={10} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
      </div>
      <button className="btn primary" type="submit" disabled={disabled}>Aggiungi</button>
    </form>
  );
}
