import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { AppError } from './errors.js';
import { SESSION_COOKIE, loadUserFromToken } from './auth.js';
import { createPaymentProvider, type PaymentProvider } from './entitlements/payments.js';
import { authRoutes } from './routes/auth.js';
import { teacherRoutes } from './routes/teacher.js';
import { studentRoutes } from './routes/student.js';
import { accountRoutes } from './routes/account.js';

export interface AppDeps {
  db: Db;
  config: Config;
  payments: PaymentProvider;
  /** Limite di frequenza per rotta, scalato per i test. */
  limit: (max: number, timeWindow: string) => { rateLimit: { max: number; timeWindow: string } };
}

export interface BuildOptions {
  logger?: FastifyServerOptions['logger'];
  /** Moltiplicatore dei limiti di frequenza (i test lo alzano per non inciampare nei limiti). */
  rateLimitScale?: number;
  payments?: PaymentProvider;
}

/** Header obbligatorio sulle richieste che modificano dati: un form di un altro sito non può impostarlo. */
export const CSRF_HEADER = 'x-fpm-client';

export async function buildApp(db: Db, config: Config, opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      // Log senza dati personali: niente IP, cookie, corpo delle richieste o email.
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      serializers: {
        req: (req: { method: string; routeOptions?: { url?: string } }) => ({
          method: req.method,
          route: req.routeOptions?.url,
        }),
      },
    },
    bodyLimit: 64 * 1024,
    trustProxy: config.NODE_ENV === 'production',
  });

  const scale = opts.rateLimitScale ?? 1;
  const deps: AppDeps = {
    db,
    config,
    payments: opts.payments ?? createPaymentProvider(config),
    limit: (max, timeWindow) => ({ rateLimit: { max: max * scale, timeWindow } }),
  };

  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    max: 100 * scale,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      error: 'rate_limited',
      message: `Troppi tentativi. Riprova tra ${Math.ceil(ctx.ttl / 1000)} secondi.`,
    }),
  });

  app.decorateRequest('user', null);

  app.addHook('onRequest', async (req) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== config.WEB_ORIGIN) {
        throw new AppError(403, 'bad_origin', 'Origine della richiesta non consentita');
      }
      if (req.headers[CSRF_HEADER] !== 'web') {
        throw new AppError(403, 'csrf', 'Richiesta non valida');
      }
    }
    req.user = await loadUserFromToken(db, req.cookies[SESSION_COOKIE]);
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    }
    const status = err.statusCode ?? 500;
    if (status === 429) return reply.code(429).send(err);
    if (status < 500) {
      return reply.code(status).send({ error: err.code ?? 'bad_request', message: 'Richiesta non valida' });
    }
    req.log.error({ err: { message: err.message, code: err.code } }, 'errore interno');
    return reply.code(500).send({ error: 'internal', message: 'Errore interno, riprova più tardi' });
  });

  app.get('/api/health', async () => {
    await db.query('SELECT 1');
    return { ok: true };
  });

  await app.register(async (s) => authRoutes(s, deps));
  await app.register(async (s) => teacherRoutes(s, deps));
  await app.register(async (s) => studentRoutes(s, deps));
  await app.register(async (s) => accountRoutes(s, deps));

  return app;
}
