import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, PASSWORD, register, setupApp, teardown, type Ctx } from './helpers.js';
import { hashPassword, verifyPassword } from '../src/security/password.js';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setupApp();
});
afterAll(() => teardown(ctx));

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const h = await hashPassword('una-password-lunga');
    expect(h).not.toContain('una-password-lunga');
    expect(await verifyPassword('una-password-lunga', h)).toBe(true);
    expect(await verifyPassword('sbagliata-sbagliata', h)).toBe(false);
  });
});

describe('auth', () => {
  it('registers, reads /api/me, logs out', async () => {
    const t = await register(ctx.app, 'teacher', 'Mario');
    const me = await t.get('/api/me');
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ role: 'teacher', displayName: 'Mario' });
    await t.post('/api/auth/logout');
    expect((await t.get('/api/me')).statusCode).toBe(401);
  });

  it('session cookie is httpOnly and SameSite=Lax', async () => {
    const c = new Client(ctx.app);
    const res = await c.post('/api/auth/register', {
      email: `c-${Date.now()}@test.local`, password: PASSWORD, displayName: 'C', role: 'student',
      isAdult: true, acceptTerms: true, acceptPrivacy: true,
    });
    const cookie = res.cookies.find((x) => x.name === 'fpm_sid')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
  });

  it('rejects duplicate email, weak password, missing consents', async () => {
    const a = await register(ctx.app, 'student');
    const c = new Client(ctx.app);
    const base = { password: PASSWORD, displayName: 'X', role: 'student', isAdult: true, acceptTerms: true, acceptPrivacy: true };
    expect((await c.post('/api/auth/register', { ...base, email: a.email.toUpperCase() })).statusCode).toBe(409);
    expect((await c.post('/api/auth/register', { ...base, email: 'x1@test.local', password: 'corta' })).statusCode).toBe(400);
    expect((await c.post('/api/auth/register', { ...base, email: 'x2@test.local', acceptPrivacy: false })).statusCode).toBe(400);
    // Minorenni: bloccati lato server finché manca il flusso di consenso genitoriale.
    const minor = await c.post('/api/auth/register', { ...base, email: 'x3@test.local', isAdult: false });
    expect(minor.statusCode).toBe(403);
    expect(minor.json().error).toBe('minor_consent_required');
  });

  it('login with wrong password gives the same error as unknown email', async () => {
    const a = await register(ctx.app, 'student');
    const c = new Client(ctx.app);
    const wrong = await c.post('/api/auth/login', { email: a.email, password: 'non-questa-password' });
    const unknown = await c.post('/api/auth/login', { email: 'nessuno@test.local', password: 'non-questa-password' });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().message).toBe(unknown.json().message);
    const ok = await c.post('/api/auth/login', { email: a.email, password: PASSWORD });
    expect(ok.statusCode).toBe(200);
  });

  it('blocks state-changing requests without the client header or from another origin', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', payload: {} });
    expect(res.statusCode).toBe(403);
    const evil = await ctx.app.inject({
      method: 'POST', url: '/api/auth/logout', payload: {},
      headers: { origin: 'https://evil.example', 'x-fpm-client': 'web' },
    });
    expect(evil.statusCode).toBe(403);
  });
});

describe('login rate limit', () => {
  it('returns 429 after 10 attempts per minute', async () => {
    const strict = await setupApp({ rateLimitScale: 1 });
    try {
      const c = new Client(strict.app);
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) {
        codes.push((await c.post('/api/auth/login', { email: 'x@test.local', password: 'qualcosa-di-lungo' })).statusCode);
      }
      expect(codes.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(codes.slice(10)).toEqual([429, 429]);
    } finally {
      await teardown(strict);
    }
  });
});
