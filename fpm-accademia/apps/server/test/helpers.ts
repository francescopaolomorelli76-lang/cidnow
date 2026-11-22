import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp, CSRF_HEADER, type BuildOptions } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createPool, type Db } from '../src/db.js';
import { TEST_DB_URL } from './globalSetup.js';

export interface Ctx {
  app: FastifyInstance;
  db: Db;
}

export async function setupApp(opts: BuildOptions = {}, env: Record<string, string> = {}): Promise<Ctx> {
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: TEST_DB_URL, PAYMENT_PROVIDER: 'mock', ...env });
  const db = createPool(TEST_DB_URL);
  const app = await buildApp(db, config, { logger: false, rateLimitScale: 1000, ...opts });
  return { app, db };
}

export async function teardown(ctx: Ctx) {
  await ctx.app.close();
  await ctx.db.end();
}

/** Client HTTP di test che conserva il cookie di sessione come un browser. */
export class Client {
  cookie: string | undefined;
  constructor(private app: FastifyInstance) {}

  async req(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<LightMyRequestResponse> {
    const res = await this.app.inject({
      method,
      url,
      headers: {
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(method !== 'GET' ? { [CSRF_HEADER]: 'web' } : {}),
      },
      ...(body !== undefined ? { payload: body as object } : {}),
    });
    const set = res.cookies.find((c) => c.name === 'fpm_sid');
    if (set) this.cookie = set.value ? `fpm_sid=${set.value}` : undefined;
    return res;
  }
  get = (url: string) => this.req('GET', url);
  post = (url: string, body: unknown = {}) => this.req('POST', url, body);
  put = (url: string, body: unknown) => this.req('PUT', url, body);
}

export const PASSWORD = 'password-sicura-123';

export async function register(app: FastifyInstance, role: 'teacher' | 'student', name: string = role) {
  const c = new Client(app);
  const email = `${role}-${randomUUID()}@test.local`;
  const res = await c.post('/api/auth/register', {
    email,
    password: PASSWORD,
    displayName: name,
    role,
    isAdult: true,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.body}`);
  return Object.assign(c, { id: res.json().id as string, email });
}

/** Docente con prova attiva o licenza (mock) pronta. */
export async function teacherWith(app: FastifyInstance, ent: 'trial' | 'license', name = 'Docente') {
  const t = await register(app, 'teacher', name);
  const r = await t.post(ent === 'trial' ? '/api/teacher/trial' : '/api/teacher/license/purchase');
  if (r.statusCode !== 200) throw new Error(r.body);
  return t;
}

export async function linkStudent(teacher: Client, student: Client): Promise<string> {
  const inv = await teacher.post('/api/teacher/invitations', { expiresInHours: 24, maxUses: 1 });
  if (inv.statusCode !== 201) throw new Error(inv.body);
  const req = await student.post('/api/student/link-requests', { code: inv.json().code });
  if (req.statusCode !== 201) throw new Error(req.body);
  const linkId = req.json().id as string;
  const ok = await teacher.post(`/api/teacher/links/${linkId}/decision`, { decision: 'approve' });
  if (ok.statusCode !== 200) throw new Error(ok.body);
  return linkId;
}
