import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { linkStudent, register, setupApp, teacherWith, teardown, type Ctx } from './helpers.js';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setupApp();
});
afterAll(() => teardown(ctx));

describe('invitation → request → approval', () => {
  it('full happy path: student sees only the authorised teacher and lessons', async () => {
    const t = await teacherWith(ctx.app, 'license', 'Prof. Rossi');
    await t.put('/api/teacher/profile', { discipline: 'canto', coverPreset: 'studio', bio: '' });
    const s = await register(ctx.app, 'student', 'Giulia');

    // Prima dell'approvazione l'allievo non vede nulla.
    expect((await s.get('/api/student/teacher')).statusCode).toBe(403);

    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 48, maxUses: 1 });
    expect(inv.statusCode).toBe(201);
    const code: string = inv.json().code;
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);

    // Il codice in chiaro non è mai restituito nelle liste né salvato nel DB.
    const list = await t.get('/api/teacher/invitations');
    expect(list.body).not.toContain(code.replace('-', ''));
    const raw = await ctx.db.query('SELECT code_hash FROM invitations WHERE id = $1', [inv.json().id]);
    expect(raw.rows[0].code_hash).not.toContain(code.replace('-', ''));

    const r = await s.post('/api/student/link-requests', { code: code.toLowerCase() });
    expect(r.statusCode).toBe(201);
    expect(r.json().status).toBe('pending');
    // In attesa: ancora nessun accesso.
    expect((await s.get('/api/student/lessons')).statusCode).toBe(403);

    const links = await t.get('/api/teacher/links');
    expect(links.json()[0]).toMatchObject({ studentName: 'Giulia', status: 'pending' });
    const ok = await t.post(`/api/teacher/links/${r.json().id}/decision`, { decision: 'approve' });
    expect(ok.json().status).toBe('approved');

    const teacherView = await s.get('/api/student/teacher');
    expect(teacherView.statusCode).toBe(200);
    expect(teacherView.json()).toMatchObject({ displayName: 'Prof. Rossi', discipline: 'canto' });

    const lesson = await t.post('/api/teacher/lessons', {
      studentId: s.id, title: 'Vocalizzi', startsAt: '2026-12-01T17:00:00+01:00', durationMinutes: 45,
    });
    expect(lesson.statusCode).toBe(201);
    const sl = await s.get('/api/student/lessons');
    expect(sl.json()).toHaveLength(1);
    expect(sl.json()[0].title).toBe('Vocalizzi');
  });

  it('single-use code cannot be redeemed twice', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 24, maxUses: 1 });
    const s1 = await register(ctx.app, 'student');
    const s2 = await register(ctx.app, 'student');
    expect((await s1.post('/api/student/link-requests', { code: inv.json().code })).statusCode).toBe(201);
    const second = await s2.post('/api/student/link-requests', { code: inv.json().code });
    expect(second.statusCode).toBe(400);
    expect(second.json().error).toBe('invalid_code');
  });

  it('multi-use code allows exactly maxUses students', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 24, maxUses: 2 });
    const res = [];
    for (let i = 0; i < 3; i++) {
      const s = await register(ctx.app, 'student');
      res.push((await s.post('/api/student/link-requests', { code: inv.json().code })).statusCode);
    }
    expect(res).toEqual([201, 201, 400]);
  });

  it('concurrent redemptions of a single-use code: only one wins', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 24, maxUses: 1 });
    const students = await Promise.all([1, 2, 3, 4].map(() => register(ctx.app, 'student')));
    const codes = await Promise.all(
      students.map((s) => s.post('/api/student/link-requests', { code: inv.json().code }).then((r) => r.statusCode)),
    );
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
  });

  it('expired code is rejected (expiry evaluated by the database clock)', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 1, maxUses: 1 });
    await ctx.db.query(`UPDATE invitations SET expires_at = now() - interval '1 second' WHERE id = $1`, [inv.json().id]);
    const s = await register(ctx.app, 'student');
    expect((await s.post('/api/student/link-requests', { code: inv.json().code })).statusCode).toBe(400);
    const list = await t.get('/api/teacher/invitations');
    expect(list.json().find((i: { id: string }) => i.id === inv.json().id).status).toBe('expired');
  });

  it('revoked code is rejected', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 24 });
    expect((await t.post(`/api/teacher/invitations/${inv.json().id}/revoke`)).statusCode).toBe(200);
    const s = await register(ctx.app, 'student');
    expect((await s.post('/api/student/link-requests', { code: inv.json().code })).statusCode).toBe(400);
  });

  it('rejected request gives no access and frees the student to try another teacher', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 24 });
    const s = await register(ctx.app, 'student');
    const r = await s.post('/api/student/link-requests', { code: inv.json().code });
    await t.post(`/api/teacher/links/${r.json().id}/decision`, { decision: 'reject' });
    expect((await s.get('/api/student/teacher')).statusCode).toBe(403);
    const t2 = await teacherWith(ctx.app, 'license');
    const inv2 = await t2.post('/api/teacher/invitations', { expiresInHours: 24 });
    expect((await s.post('/api/student/link-requests', { code: inv2.json().code })).statusCode).toBe(201);
  });

  it('a student cannot have two active links at once', async () => {
    const t1 = await teacherWith(ctx.app, 'license');
    const t2 = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    await linkStudent(t1, s);
    const inv2 = await t2.post('/api/teacher/invitations', { expiresInHours: 24 });
    const r = await s.post('/api/student/link-requests', { code: inv2.json().code });
    expect(r.statusCode).toBe(409);
  });

  it('roles are enforced server-side', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    expect((await s.post('/api/teacher/invitations', { expiresInHours: 24 })).statusCode).toBe(403);
    expect((await s.get('/api/teacher/links')).statusCode).toBe(403);
    expect((await t.post('/api/student/link-requests', { code: 'ABCDE12345' })).statusCode).toBe(403);
    const anon = await ctx.app.inject({ method: 'GET', url: '/api/teacher/students' });
    expect(anon.statusCode).toBe(401);
  });
});

describe('revocation', () => {
  it('teacher revokes: student immediately loses teacher and lessons; teacher cannot schedule more', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    const linkId = await linkStudent(t, s);
    await t.post('/api/teacher/lessons', {
      studentId: s.id, title: 'L1', startsAt: '2026-12-02T10:00:00Z', durationMinutes: 30,
    });
    expect((await s.get('/api/student/lessons')).json()).toHaveLength(1);

    expect((await t.post(`/api/teacher/links/${linkId}/revoke`)).statusCode).toBe(200);
    expect((await s.get('/api/student/teacher')).statusCode).toBe(403);
    expect((await s.get('/api/student/lessons')).statusCode).toBe(403);
    const again = await t.post('/api/teacher/lessons', {
      studentId: s.id, title: 'L2', startsAt: '2026-12-03T10:00:00Z', durationMinutes: 30,
    });
    expect(again.statusCode).toBe(403);
    expect((await t.get('/api/teacher/students')).json()).toHaveLength(0);
  });

  it('student can leave the teacher', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    await linkStudent(t, s);
    await s.post('/api/student/link/leave');
    expect((await s.get('/api/student/teacher')).statusCode).toBe(403);
  });
});

describe('isolation between teachers', () => {
  it('teacher B cannot see, decide, revoke or schedule for teacher A students', async () => {
    const a = await teacherWith(ctx.app, 'license', 'A');
    const b = await teacherWith(ctx.app, 'license', 'B');
    const s = await register(ctx.app, 'student', 'Solo-di-A');

    const invA = await a.post('/api/teacher/invitations', { expiresInHours: 24 });
    const req = await s.post('/api/student/link-requests', { code: invA.json().code });
    const linkId = req.json().id;

    // B non vede la richiesta né può deciderla.
    expect((await b.get('/api/teacher/links')).body).not.toContain('Solo-di-A');
    expect((await b.post(`/api/teacher/links/${linkId}/decision`, { decision: 'approve' })).statusCode).toBe(404);

    await a.post(`/api/teacher/links/${linkId}/decision`, { decision: 'approve' });

    expect((await b.get('/api/teacher/students')).json()).toHaveLength(0);
    expect((await b.post(`/api/teacher/links/${linkId}/revoke`)).statusCode).toBe(404);
    expect((await b.post(`/api/teacher/invitations/${invA.json().id}/revoke`)).statusCode).toBe(404);
    const lesson = await b.post('/api/teacher/lessons', {
      studentId: s.id, title: 'Intrusione', startsAt: '2026-12-02T10:00:00Z', durationMinutes: 30,
    });
    expect(lesson.statusCode).toBe(403);

    // Le lezioni di A non compaiono a B.
    await a.post('/api/teacher/lessons', {
      studentId: s.id, title: 'Lezione di A', startsAt: '2026-12-02T10:00:00Z', durationMinutes: 30,
    });
    expect((await b.get('/api/teacher/lessons')).body).not.toContain('Lezione di A');
    // Il collegamento di A resta intatto.
    expect((await s.get('/api/student/teacher')).json().displayName).toBe('A');
  });

  it('malformed ids return 404, not 500', async () => {
    const t = await teacherWith(ctx.app, 'license');
    expect((await t.post('/api/teacher/links/not-a-uuid/revoke')).statusCode).toBe(404);
  });
});
