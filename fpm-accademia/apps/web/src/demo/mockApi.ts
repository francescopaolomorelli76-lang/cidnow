/**
 * DEMO ONLINE — server simulato nel browser (build con VITE_DEMO=1).
 * Riproduce le regole dell'API reale (ruoli, inviti, approvazione, revoca, prova 24h, licenza simulata)
 * salvando i dati SOLO nel browser di chi apre la demo. Non è il backend reale e non è sicuro:
 * serve unicamente a far vedere e provare l'interfaccia senza server.
 */
type Role = 'teacher' | 'student';
interface User { id: string; email: string; password: string; displayName: string; role: Role; createdAt: string }
interface Invitation { id: string; teacherId: string; code: string; maxUses: number; uses: number; expiresAt: string; revokedAt: string | null; createdAt: string; note: string }
interface Link { id: string; teacherId: string; studentId: string; status: 'pending' | 'approved' | 'rejected' | 'revoked'; requestedAt: string; decidedAt: string | null }
interface Lesson { id: string; teacherId: string; studentId: string; title: string; startsAt: string; durationMinutes: number; notes: string; status: string }
interface State {
  v: 1;
  me: string | null;
  users: User[];
  profiles: Record<string, { discipline: string | null; coverPreset: string; bio: string }>;
  trials: Record<string, { startedAt: string; endsAt: string }>;
  licenses: Record<string, { provider: string; purchasedAt: string }>;
  invitations: Invitation[];
  links: Link[];
  lessons: Lesson[];
  devices: Record<string, unknown[]>;
}

const KEY = 'fpm.demo.state.v1';
export const DEMO_PASSWORD = 'demo-password-123';

function uid() {
  return crypto.randomUUID();
}
function now() {
  return new Date().toISOString();
}
function seed(): State {
  const t = uid();
  const s = uid();
  return {
    v: 1,
    me: null,
    users: [
      { id: t, email: 'docente@demo.local', password: DEMO_PASSWORD, displayName: 'Docente Demo', role: 'teacher', createdAt: now() },
      { id: s, email: 'allievo@demo.local', password: DEMO_PASSWORD, displayName: 'Allievo Demo', role: 'student', createdAt: now() },
    ],
    profiles: { [t]: { discipline: 'canto', coverPreset: 'studio', bio: '' } },
    trials: {},
    licenses: {},
    invitations: [],
    links: [],
    lessons: [],
    devices: {},
  };
}

let memory: State | null = null;
function load(): State {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as State;
  } catch {
    /* storage non disponibile: demo solo in memoria */
  }
  memory ??= seed();
  return memory;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* ignora */
  }
}
export function resetDemo() {
  memory = seed();
  save();
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
const err = (status: number, code: string, msg: string) => new HttpError(status, code, msg);

const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => ALPH[x % 32]).join('');
}

function entitlement(st: State, teacherId: string) {
  const lic = st.licenses[teacherId];
  const tr = st.trials[teacherId];
  const serverNow = now();
  let state = 'none';
  if (lic) state = 'licensed';
  else if (tr) state = Date.parse(tr.endsAt) > Date.now() ? 'trial-active' : 'trial-expired';
  return {
    state,
    serverNow,
    trialStartedAt: tr?.startedAt ?? null,
    trialEndsAt: tr?.endsAt ?? null,
    license: lic ? { ...lic, isMock: true } : null,
    limits: state === 'trial-active' ? { maxStudents: 1, maxActiveInvitations: 1, demoLessonMinutes: 20 } : null,
  };
}
function requireEnt(st: State, teacherId: string) {
  const e = entitlement(st, teacherId);
  if (e.state === 'licensed' || e.state === 'trial-active') return e;
  throw err(402, 'license_required', e.state === 'trial-expired' ? 'La prova di 24 ore è terminata.' : 'Avvia la prova gratuita di 24 ore o attiva la licenza.');
}
function inviteStatus(i: Invitation) {
  if (i.revokedAt) return 'revoked';
  if (Date.parse(i.expiresAt) <= Date.now()) return 'expired';
  if (i.uses >= i.maxUses) return 'used';
  return 'active';
}

function route(method: string, path: string, body: Record<string, unknown>): { status: number; data: unknown } {
  const st = load();
  const me = st.users.find((u) => u.id === st.me) ?? null;
  const ok = (data: unknown, status = 200) => ({ status, data });
  const needUser = () => {
    if (!me) throw err(401, 'unauthorized', 'Accesso richiesto');
    return me;
  };
  const needRole = (r: Role) => {
    const u = needUser();
    if (u.role !== r) throw err(403, 'forbidden', r === 'teacher' ? 'Riservato ai docenti' : 'Riservato agli allievi');
    return u;
  };
  const name = (id: string) => st.users.find((u) => u.id === id)?.displayName ?? '—';
  const approvedTeacherOf = (sid: string) => st.links.find((l) => l.studentId === sid && l.status === 'approved')?.teacherId ?? null;
  let m: RegExpMatchArray | null;

  if (method === 'GET' && path === '/api/net/ping') throw err(503, 'demo', 'Nella demo online non c’è un server da misurare');
  if (method === 'GET' && path === '/api/health') return ok({ ok: true, demo: true });

  // ---- auth
  if (method === 'POST' && path === '/api/auth/register') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const displayName = String(body.displayName ?? '').trim();
    const role = body.role === 'student' ? 'student' : 'teacher';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err(400, 'invalid_input', 'email: indirizzo non valido');
    if (password.length < 10) throw err(400, 'invalid_input', 'password: La password deve avere almeno 10 caratteri');
    if (!displayName) throw err(400, 'invalid_input', 'displayName: obbligatorio');
    if (body.acceptTerms !== true || body.acceptPrivacy !== true) throw err(400, 'invalid_input', 'Consensi obbligatori mancanti');
    if (body.isAdult !== true) throw err(403, 'minor_consent_required', 'Per i minorenni serve il consenso di un genitore: percorso non ancora attivo');
    if (st.users.some((u) => u.email === email)) throw err(409, 'email_taken', 'Esiste già un account con questa email');
    const u: User = { id: uid(), email, password, displayName, role, createdAt: now() };
    st.users.push(u);
    if (role === 'teacher') st.profiles[u.id] = { discipline: null, coverPreset: 'studio', bio: '' };
    st.me = u.id;
    return ok({ id: u.id, role, displayName }, 201);
  }
  if (method === 'POST' && path === '/api/auth/login') {
    const u = st.users.find((x) => x.email === String(body.email ?? '').trim().toLowerCase() && x.password === body.password);
    if (!u) throw err(401, 'bad_credentials', 'Email o password non corretti');
    st.me = u.id;
    return ok({ id: u.id, role: u.role, displayName: u.displayName });
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    st.me = null;
    return ok({ ok: true });
  }
  if (method === 'GET' && path === '/api/me') {
    const u = needUser();
    return ok({ id: u.id, role: u.role, displayName: u.displayName, email: u.email });
  }

  // ---- docente
  if (path === '/api/teacher/profile') {
    const t = needRole('teacher');
    if (method === 'PUT') st.profiles[t.id] = { discipline: String(body.discipline), coverPreset: String(body.coverPreset ?? 'studio'), bio: '' };
    return ok(st.profiles[t.id] ?? { discipline: null, coverPreset: 'studio', bio: '' });
  }
  if (method === 'GET' && path === '/api/teacher/entitlement') return ok(entitlement(st, needRole('teacher').id));
  if (method === 'POST' && path === '/api/teacher/trial') {
    const t = needRole('teacher');
    st.trials[t.id] ??= { startedAt: now(), endsAt: new Date(Date.now() + 24 * 3600e3).toISOString() };
    return ok(entitlement(st, t.id));
  }
  if (method === 'POST' && path === '/api/teacher/license/purchase') {
    const t = needRole('teacher');
    st.licenses[t.id] ??= { provider: 'mock', purchasedAt: now() };
    return ok(entitlement(st, t.id));
  }
  if (method === 'POST' && path === '/api/teacher/license/restore') return ok(entitlement(st, needRole('teacher').id));
  if (path === '/api/teacher/invitations' && method === 'POST') {
    const t = needRole('teacher');
    const e = requireEnt(st, t.id);
    const trial = e.state === 'trial-active';
    if (trial && st.invitations.some((i) => i.teacherId === t.id && inviteStatus(i) === 'active')) {
      throw err(402, 'license_required', 'Durante la prova puoi avere un solo invito attivo.');
    }
    const code = newCode();
    const hours = Number(body.expiresInHours ?? 72);
    const inv: Invitation = {
      id: uid(), teacherId: t.id, code, maxUses: trial ? 1 : Number(body.maxUses ?? 1), uses: 0,
      expiresAt: new Date(Date.now() + hours * 3600e3).toISOString(), revokedAt: null, createdAt: now(), note: '',
    };
    st.invitations.push(inv);
    return ok({ id: inv.id, code: `${code.slice(0, 5)}-${code.slice(5)}`, expiresAt: inv.expiresAt, maxUses: inv.maxUses }, 201);
  }
  if (path === '/api/teacher/invitations' && method === 'GET') {
    const t = needRole('teacher');
    return ok(st.invitations.filter((i) => i.teacherId === t.id).reverse().map((i) => ({
      id: i.id, codeHint: i.code.slice(-3), note: i.note, maxUses: i.maxUses, uses: i.uses, expiresAt: i.expiresAt, status: inviteStatus(i),
    })));
  }
  if (method === 'POST' && (m = path.match(/^\/api\/teacher\/invitations\/([\w-]+)\/revoke$/))) {
    const t = needRole('teacher');
    const i = st.invitations.find((x) => x.id === m![1] && x.teacherId === t.id);
    if (!i) throw err(404, 'not_found', 'Invito non trovato');
    i.revokedAt ??= now();
    return ok({ ok: true });
  }
  if (method === 'GET' && path === '/api/teacher/links') {
    const t = needRole('teacher');
    return ok(st.links.filter((l) => l.teacherId === t.id).reverse().map((l) => ({
      id: l.id, status: l.status, requestedAt: l.requestedAt, decidedAt: l.decidedAt, studentId: l.studentId, studentName: name(l.studentId), isAdult: true,
    })));
  }
  if (method === 'POST' && (m = path.match(/^\/api\/teacher\/links\/([\w-]+)\/decision$/))) {
    const t = needRole('teacher');
    const l = st.links.find((x) => x.id === m![1] && x.teacherId === t.id);
    if (!l) throw err(404, 'not_found', 'Richiesta non trovata');
    if (l.status !== 'pending') throw err(409, 'not_pending', 'La richiesta è già stata gestita');
    if (body.decision === 'approve') {
      const e = requireEnt(st, t.id);
      if (e.state === 'trial-active' && st.links.some((x) => x.teacherId === t.id && x.status === 'approved')) {
        throw err(402, 'license_required', 'Durante la prova puoi collegare un solo allievo.');
      }
    }
    l.status = body.decision === 'approve' ? 'approved' : 'rejected';
    l.decidedAt = now();
    return ok({ id: l.id, status: l.status });
  }
  if (method === 'POST' && (m = path.match(/^\/api\/teacher\/links\/([\w-]+)\/revoke$/))) {
    const t = needRole('teacher');
    const l = st.links.find((x) => x.id === m![1] && x.teacherId === t.id && (x.status === 'pending' || x.status === 'approved'));
    if (!l) throw err(404, 'not_found', 'Collegamento non trovato o già chiuso');
    l.status = 'revoked';
    l.decidedAt = now();
    return ok({ id: l.id, status: 'revoked' });
  }
  if (method === 'GET' && path === '/api/teacher/students') {
    const t = needRole('teacher');
    return ok(st.links.filter((l) => l.teacherId === t.id && l.status === 'approved').map((l) => ({ id: l.studentId, displayName: name(l.studentId), isAdult: true, linkedAt: l.decidedAt })));
  }
  if (path === '/api/teacher/lessons' && method === 'POST') {
    const t = needRole('teacher');
    requireEnt(st, t.id);
    const sid = String(body.studentId);
    if (!st.links.some((l) => l.teacherId === t.id && l.studentId === sid && l.status === 'approved')) throw err(403, 'forbidden', 'Allievo non collegato a questo docente');
    const les: Lesson = { id: uid(), teacherId: t.id, studentId: sid, title: String(body.title ?? '').slice(0, 120), startsAt: String(body.startsAt), durationMinutes: Number(body.durationMinutes ?? 45), notes: '', status: 'scheduled' };
    if (!les.title) throw err(400, 'invalid_input', 'title: obbligatorio');
    st.lessons.push(les);
    return ok(les, 201);
  }
  if (path === '/api/teacher/lessons' && method === 'GET') {
    const t = needRole('teacher');
    return ok(st.lessons.filter((l) => l.teacherId === t.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((l) => ({ ...l, studentName: name(l.studentId) })));
  }

  // ---- allievo
  if (method === 'POST' && path === '/api/student/link-requests') {
    const s = needRole('student');
    if (st.links.some((l) => l.studentId === s.id && (l.status === 'pending' || l.status === 'approved'))) {
      throw err(409, 'already_linked', 'Hai già un docente collegato o una richiesta in attesa');
    }
    const code = String(body.code ?? '').toUpperCase().replace(/[\s-]/g, '');
    const inv = st.invitations.find((i) => i.code === code && inviteStatus(i) === 'active');
    if (!inv) throw err(400, 'invalid_code', 'Codice non valido, scaduto o già utilizzato');
    inv.uses++;
    const l: Link = { id: uid(), teacherId: inv.teacherId, studentId: s.id, status: 'pending', requestedAt: now(), decidedAt: null };
    st.links.push(l);
    return ok({ id: l.id, status: 'pending' }, 201);
  }
  if (method === 'GET' && path === '/api/student/link') {
    const s = needRole('student');
    const l = [...st.links].reverse().find((x) => x.studentId === s.id);
    return ok(l ? { id: l.id, status: l.status, requestedAt: l.requestedAt, teacherName: name(l.teacherId) } : null);
  }
  if (method === 'POST' && path === '/api/student/link/leave') {
    const s = needRole('student');
    for (const l of st.links) if (l.studentId === s.id && (l.status === 'pending' || l.status === 'approved')) { l.status = 'revoked'; l.decidedAt = now(); }
    return ok({ ok: true });
  }
  if (method === 'GET' && path === '/api/student/teacher') {
    const s = needRole('student');
    const tid = approvedTeacherOf(s.id);
    if (!tid) throw err(403, 'forbidden', 'Nessun docente approvato');
    const p = st.profiles[tid];
    return ok({ id: tid, displayName: name(tid), discipline: p?.discipline ?? null, coverPreset: p?.coverPreset ?? 'studio', bio: '' });
  }
  if (method === 'GET' && path === '/api/student/lessons') {
    const s = needRole('student');
    const tid = approvedTeacherOf(s.id);
    if (!tid) throw err(403, 'forbidden', 'Nessun docente approvato');
    return ok(st.lessons.filter((l) => l.studentId === s.id && l.teacherId === tid).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  }

  // ---- account
  if (path === '/api/devices') {
    const u = needUser();
    if (method === 'PUT') {
      const list = (st.devices[u.id] ??= []) as { deviceKey: string }[];
      const i = list.findIndex((d) => d.deviceKey === body.deviceKey);
      if (i >= 0) list[i] = body as { deviceKey: string }; else list.push(body as { deviceKey: string });
      return ok(body);
    }
    return ok(st.devices[u.id] ?? []);
  }
  if (method === 'GET' && path === '/api/me/export') {
    const u = needUser();
    return ok({ demo: true, user: { ...u, password: undefined } });
  }
  if (method === 'POST' && path === '/api/me/delete') {
    const u = needUser();
    if (body.password !== u.password) throw err(401, 'bad_credentials', 'Password non corretta');
    st.users = st.users.filter((x) => x.id !== u.id);
    st.links = st.links.filter((l) => l.studentId !== u.id && l.teacherId !== u.id);
    st.lessons = st.lessons.filter((l) => l.studentId !== u.id && l.teacherId !== u.id);
    st.me = null;
    return ok({ ok: true });
  }
  throw err(404, 'not_found', 'Risorsa non trovata');
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(url, location.href);
    if (!u.pathname.includes('/api/')) return realFetch(input, init);
    const path = u.pathname.slice(u.pathname.indexOf('/api/'));
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: Record<string, unknown>;
    try {
      body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    } catch {
      body = {};
    }
    await new Promise((r) => setTimeout(r, 60));
    try {
      const { status, data } = route(method, path, body);
      save();
      return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    } catch (e) {
      const h = e instanceof HttpError ? e : err(500, 'internal', 'Errore interno della demo');
      return new Response(JSON.stringify({ error: h.code, message: h.message }), { status: h.status, headers: { 'content-type': 'application/json' } });
    }
  };
}
