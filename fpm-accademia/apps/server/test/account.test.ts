import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, linkStudent, register, setupApp, teacherWith, teardown, type Ctx } from './helpers.js';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setupApp();
});
afterAll(() => teardown(ctx));

describe('device preferences', () => {
  it('stores per-device preferences with a random local key, per user only', async () => {
    const u = await register(ctx.app, 'student');
    const other = await register(ctx.app, 'student');
    const prefs = {
      deviceKey: 'abcdefghijklmnop1234', label: 'iPhone di casa', audioInputLabel: 'Microfono iPhone',
      connectionType: 'wifi', headphonesConfirmed: true,
    };
    expect((await u.put('/api/devices', prefs)).statusCode).toBe(200);
    expect((await u.put('/api/devices', { ...prefs, connectionType: 'cellular' })).statusCode).toBe(200);
    const list = (await u.get('/api/devices')).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ connectionType: 'cellular', headphonesConfirmed: true });
    expect((await other.get('/api/devices')).json()).toHaveLength(0);
  });

  it('rejects malformed device keys and unknown fields like wifi passwords are dropped', async () => {
    const u = await register(ctx.app, 'student');
    expect((await u.put('/api/devices', { deviceKey: 'x' })).statusCode).toBe(400);
    await u.put('/api/devices', { deviceKey: 'abcdefghijklmnop9999', wifiPassword: 'segreta' });
    const raw = await ctx.db.query('SELECT * FROM device_preferences WHERE user_id = $1', [u.id]);
    expect(JSON.stringify(raw.rows)).not.toContain('segreta');
  });
});

describe('GDPR export and deletion', () => {
  it('exports own data without password hash', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    await linkStudent(t, s);
    const exp = await s.get('/api/me/export');
    expect(exp.statusCode).toBe(200);
    expect(exp.json().links).toHaveLength(1);
    expect(exp.body).not.toContain('scrypt$');
  });

  it('deletes the account after password confirmation, removing links', async () => {
    const t = await teacherWith(ctx.app, 'license');
    const s = await register(ctx.app, 'student');
    await linkStudent(t, s);
    expect((await s.post('/api/me/delete', { password: 'sbagliata-davvero' })).statusCode).toBe(401);
    expect((await s.post('/api/me/delete', { password: PASSWORD })).statusCode).toBe(200);
    expect((await s.get('/api/me')).statusCode).toBe(401);
    expect((await t.get('/api/teacher/students')).json()).toHaveLength(0);
  });
});

describe('network ping', () => {
  it('returns server time', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/net/ping' });
    expect(typeof res.json().serverTime).toBe('number');
  });
});
