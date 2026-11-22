import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register, setupApp, teacherWith, teardown, type Ctx } from './helpers.js';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setupApp();
});
afterAll(() => teardown(ctx));

describe('trial (24h, server-side)', () => {
  it('new teacher has no entitlement and cannot invite', async () => {
    const t = await register(ctx.app, 'teacher');
    expect((await t.get('/api/teacher/entitlement')).json().state).toBe('none');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 24 });
    expect(inv.statusCode).toBe(402);
  });

  it('trial lasts 24h computed by the server and cannot be restarted', async () => {
    const t = await register(ctx.app, 'teacher');
    const e = (await t.post('/api/teacher/trial')).json();
    expect(e.state).toBe('trial-active');
    const ms = Date.parse(e.trialEndsAt) - Date.parse(e.trialStartedAt);
    expect(ms).toBe(24 * 3600 * 1000);
    expect(e.limits).toMatchObject({ maxStudents: 1, demoLessonMinutes: 20 });

    // Simula il passare del tempo spostando la prova nel passato (orologio del DB, non del client).
    await ctx.db.query(
      `UPDATE trials SET started_at = now() - interval '25 hours', ends_at = now() - interval '1 hour' WHERE teacher_id = $1`,
      [t.id],
    );
    const expired = (await t.post('/api/teacher/trial')).json();
    expect(expired.state).toBe('trial-expired');
    expect((await t.post('/api/teacher/invitations', { expiresInHours: 24 })).statusCode).toBe(402);
  });

  it('a client-supplied date header has no effect on the trial', async () => {
    const t = await register(ctx.app, 'teacher');
    await t.post('/api/teacher/trial');
    const res = await ctx.app.inject({
      method: 'GET', url: '/api/teacher/entitlement',
      headers: { cookie: t.cookie!, date: 'Thu, 01 Jan 2099 00:00:00 GMT' },
    });
    expect(res.json().state).toBe('trial-active');
  });

  it('trial is reduced: one invitation (single use) and one student', async () => {
    const t = await teacherWith(ctx.app, 'trial');
    const inv = await t.post('/api/teacher/invitations', { expiresInHours: 24, maxUses: 5 });
    expect(inv.statusCode).toBe(201);
    expect(inv.json().maxUses).toBe(1);
    expect((await t.post('/api/teacher/invitations', { expiresInHours: 24 })).statusCode).toBe(402);

    const s1 = await register(ctx.app, 'student');
    const r1 = await s1.post('/api/student/link-requests', { code: inv.json().code });
    expect((await t.post(`/api/teacher/links/${r1.json().id}/decision`, { decision: 'approve' })).statusCode).toBe(200);
    // L'invito è stato consumato: ora se ne può creare un altro, ma non approvare un secondo allievo.
    const inv2 = await t.post('/api/teacher/invitations', { expiresInHours: 24 });
    const s2 = await register(ctx.app, 'student');
    const r2 = await s2.post('/api/student/link-requests', { code: inv2.json().code });
    expect((await t.post(`/api/teacher/links/${r2.json().id}/decision`, { decision: 'approve' })).statusCode).toBe(402);
  });
});

describe('permanent license (mock provider in development)', () => {
  it('purchase marks license as mock, permanent, and never needs renewal', async () => {
    const t = await register(ctx.app, 'teacher');
    const e = (await t.post('/api/teacher/license/purchase')).json();
    expect(e.state).toBe('licensed');
    expect(e.license).toMatchObject({ provider: 'mock', isMock: true });
    expect(e.trialEndsAt).toBeNull();
    // Secondo acquisto: nessun doppio addebito, stessa licenza.
    const again = (await t.post('/api/teacher/license/purchase')).json();
    expect(again.license.purchasedAt).toBe(e.license.purchasedAt);
    const rows = await ctx.db.query('SELECT price_cents, currency FROM licenses WHERE teacher_id = $1', [t.id]);
    expect(rows.rows).toEqual([{ price_cents: 9990, currency: 'EUR' }]);
  });

  it('license survives an expired trial and is restorable after a new login', async () => {
    const t = await teacherWith(ctx.app, 'trial');
    await ctx.db.query(`UPDATE trials SET ends_at = now() - interval '1 hour' WHERE teacher_id = $1`, [t.id]);
    await t.post('/api/teacher/license/purchase');
    const restored = (await t.post('/api/teacher/license/restore')).json();
    expect(restored.state).toBe('licensed');
    expect((await t.post('/api/teacher/invitations', { expiresInHours: 24, maxUses: 10 })).json().maxUses).toBe(10);
  });

  it('students never need a license', async () => {
    const s = await register(ctx.app, 'student');
    expect((await s.post('/api/teacher/license/purchase')).statusCode).toBe(403);
  });

  it('mock provider is disabled in production', async () => {
    const prod = await setupApp({}, { NODE_ENV: 'production' });
    try {
      const t = await register(prod.app, 'teacher');
      const res = await t.post('/api/teacher/license/purchase');
      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe('payments_not_configured');
    } finally {
      await prod.app.close();
      await prod.db.end();
    }
  });
});
