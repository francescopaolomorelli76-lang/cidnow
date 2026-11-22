import type { FastifyInstance } from 'fastify';
import { LoginSchema, RegisterSchema } from '@fpm/shared';
import { SESSION_COOKIE, cookieOptions, createSession, destroySession, requireUser } from '../auth.js';
import { withTx } from '../db.js';
import { AppError, conflict, parse } from '../errors.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../security/password.js';
import type { AppDeps } from '../app.js';

export const POLICY_VERSION = '2026-11-22-draft';

export async function authRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, config } = deps;
  const secure = config.NODE_ENV === 'production';
  const authLimit = deps.limit(10, '1 minute');

  app.post('/api/auth/register', { config: authLimit }, async (req, reply) => {
    const input = parse(RegisterSchema, req.body);
    if (!input.isAdult) {
      // Tutela minori: finché il flusso di consenso del genitore/tutore non è definito con un legale,
      // la registrazione autonoma dei minorenni è bloccata lato server.
      throw new AppError(403, 'minor_consent_required', 'Per i minorenni serve il consenso di un genitore: percorso non ancora attivo');
    }
    const passwordHash = await hashPassword(input.password);
    const userId = await withTx(db, async (tx) => {
      const exists = await tx.query('SELECT 1 FROM users WHERE lower(email) = $1', [input.email]);
      if (exists.rowCount) throw conflict('email_taken', 'Esiste già un account con questa email');
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, display_name, role, is_adult)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [input.email, passwordHash, input.displayName, input.role, input.isAdult],
      );
      const id = rows[0]!.id;
      await tx.query(
        `INSERT INTO consents (user_id, kind, version) VALUES ($1, 'terms', $2), ($1, 'privacy', $2)`,
        [id, POLICY_VERSION],
      );
      if (input.role === 'teacher') {
        await tx.query('INSERT INTO teacher_profiles (user_id) VALUES ($1)', [id]);
      } else {
        await tx.query('INSERT INTO student_profiles (user_id) VALUES ($1)', [id]);
      }
      return id;
    });
    const { token, maxAgeSec } = await createSession(db, userId);
    reply.setCookie(SESSION_COOKIE, token, cookieOptions(secure, maxAgeSec));
    return reply.code(201).send({ id: userId, role: input.role, displayName: input.displayName });
  });

  app.post('/api/auth/login', { config: authLimit }, async (req, reply) => {
    const input = parse(LoginSchema, req.body);
    const { rows } = await db.query<{ id: string; password_hash: string; role: string; display_name: string }>(
      'SELECT id, password_hash, role, display_name FROM users WHERE lower(email) = $1',
      [input.email],
    );
    const user = rows[0];
    // Verifica sempre un hash (anche fittizio) per non rivelare quali email esistono.
    const ok = await verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, 'bad_credentials', 'Email o password non corretti');
    const { token, maxAgeSec } = await createSession(db, user.id);
    reply.setCookie(SESSION_COOKIE, token, cookieOptions(secure, maxAgeSec));
    return { id: user.id, role: user.role, displayName: user.display_name };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await destroySession(db, token);
    reply.clearCookie(SESSION_COOKIE, cookieOptions(secure));
    return { ok: true };
  });

  app.get('/api/me', async (req) => {
    const u = requireUser(req);
    return { id: u.id, role: u.role, displayName: u.displayName, email: u.email };
  });
}
