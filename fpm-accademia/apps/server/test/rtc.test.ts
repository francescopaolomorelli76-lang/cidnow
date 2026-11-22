import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { linkStudent, register, setupApp, teacherWith, teardown, type Client, type Ctx } from './helpers.js';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setupApp();
});
afterAll(() => teardown(ctx));

/** Apre il WebSocket di signaling e raccoglie i messaggi ricevuti. */
async function connect(c: Client | null, link: string) {
  const inbox: { type: string; [k: string]: unknown }[] = [];
  let closed!: Promise<number>;
  // Ascolto agganciato prima dell'apertura, come fa un browser (onmessage impostato subito).
  const ws = (await ctx.app.injectWS(
    `/api/rtc?link=${link}`,
    { headers: c?.cookie ? { cookie: c.cookie } : {} },
    {
      onInit: (w) => {
        closed = new Promise<number>((r) => w.on('close', (code: number) => r(code)));
        w.on('message', (d: Buffer) => inbox.push(JSON.parse(d.toString())));
      },
    },
  )) as unknown as WebSocket;
  const next = async (type: string) => {
    for (let i = 0; i < 100; i++) {
      const m = inbox.find((x) => x.type === type);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`nessun messaggio ${type}`);
  };
  return { ws, inbox, next, closed };
}

describe('lesson signaling', () => {
  it('rejects anonymous users', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    const link = await linkStudent(t, s);
    const anon = await connect(null, link);
    expect(await anon.closed).toBe(4001);
  });

  it('rejects a teacher who is not part of the link', async () => {
    const a = await teacherWith(ctx.app, 'license');
    const b = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    const link = await linkStudent(a, s);
    const intruder = await connect(b, link);
    expect(await intruder.closed).toBe(4003);
  });

  it('rejects a pending (not yet approved) link', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 24 });
    const req = await s.post('/api/student/link-requests', { code: inv.json().code });
    const ws = await connect(s, req.json().id);
    expect(await ws.closed).toBe(4003);
  });

  it('relays signals between teacher and approved student only', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    const link = await linkStudent(t, s);
    const tw = await connect(t, link);
    expect(await tw.next('joined')).toMatchObject({ role: 'teacher', peerPresent: false });
    const sw = await connect(s, link);
    expect(await sw.next('joined')).toMatchObject({ role: 'student', peerPresent: true });
    expect(await tw.next('peer-joined')).toMatchObject({ role: 'student' });

    tw.ws.send(JSON.stringify({ type: 'signal', data: { description: { type: 'offer', sdp: 'v=0' } } }));
    expect(await sw.next('signal')).toMatchObject({ from: 'teacher', data: { description: { type: 'offer' } } });

    sw.ws.terminate();
    expect(await tw.next('peer-left')).toMatchObject({ role: 'student' });
    tw.ws.close();
  });

  it('revoking the link disconnects the lesson immediately', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    const link = await linkStudent(t, s);
    const sw = await connect(s, link);
    await sw.next('joined');
    await t.post(`/api/teacher/links/${link}/revoke`);
    expect(await sw.closed).toBe(4003);
    // Dopo la revoca non si rientra.
    const again = await connect(s, link);
    expect(await again.closed).toBe(4003);
  });

  it('ICE config is empty by default (same Wi-Fi needs no STUN/TURN)', async () => {
    const t = await teacherWith(ctx.app, 'license');
    expect((await t.get('/api/rtc/config')).json()).toEqual({ iceServers: [] });
  });
});

describe('HTTP polling fallback (Safari/iPad with self-signed certificate)', () => {
  it('relays between a polling student and a WebSocket teacher; revoke closes the poll session', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    const link = await linkStudent(t, s);
    const tw = await connect(t, link);
    await tw.next('joined');

    const j = await s.post('/api/rtc/poll/join', { link });
    expect(j.statusCode).toBe(200);
    const sid = j.json().sid as string;
    const first = (await s.get(`/api/rtc/poll?sid=${sid}`)).json();
    expect(first.msgs[0]).toMatchObject({ type: 'joined', role: 'student', peerPresent: true });
    expect(await tw.next('peer-joined')).toMatchObject({ role: 'student' });

    // allievo (polling) → docente (WebSocket)
    await s.post('/api/rtc/poll/send', { sid, msg: { type: 'signal', data: { candidate: { candidate: 'x' } } } });
    expect(await tw.next('signal')).toMatchObject({ from: 'student', data: { candidate: { candidate: 'x' } } });

    // docente → allievo: il long-poll in attesa riceve subito il messaggio
    const pending = s.get(`/api/rtc/poll?sid=${sid}`);
    await new Promise((r) => setTimeout(r, 30));
    tw.ws.send(JSON.stringify({ type: 'signal', data: { description: { type: 'answer', sdp: 'v=0' } } }));
    expect((await pending).json().msgs[0]).toMatchObject({ type: 'signal', from: 'teacher' });

    // Un altro utente non può leggere la sessione
    const other = await register(ctx.app, 'student');
    expect((await other.get(`/api/rtc/poll?sid=${sid}`)).statusCode).toBe(404);

    await t.post(`/api/teacher/links/${link}/revoke`);
    expect((await s.get(`/api/rtc/poll?sid=${sid}`)).json().closed).toBe(4003);
    tw.ws.terminate();
  });

  it('refuses polling join for a link the user is not part of', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    const link = await linkStudent(t, s);
    const intruder = await register(ctx.app, 'student');
    expect((await intruder.post('/api/rtc/poll/join', { link })).statusCode).toBe(403);
  });
});
