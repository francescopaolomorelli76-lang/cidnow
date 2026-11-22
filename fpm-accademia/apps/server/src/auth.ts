import type { FastifyRequest } from 'fastify';
import type { Role } from '@fpm/shared';
import type { Db } from './db.js';
import { forbidden, unauthorized } from './errors.js';
import { newSessionToken, sha256 } from './security/tokens.js';

export const SESSION_COOKIE = 'fpm_sid';
const SESSION_DAYS = 30;

export interface AuthUser {
  id: string;
  role: Role;
  displayName: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export async function createSession(db: Db, userId: string): Promise<{ token: string; maxAgeSec: number }> {
  const token = newSessionToken();
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [userId, sha256(token), SESSION_DAYS],
  );
  return { token, maxAgeSec: SESSION_DAYS * 86400 };
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

export async function loadUserFromToken(db: Db, token: string | undefined): Promise<AuthUser | null> {
  if (!token || token.length > 100) return null;
  const { rows } = await db.query<{ id: string; role: Role; display_name: string; email: string }>(
    `SELECT u.id, u.role, u.display_name, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  const r = rows[0];
  return r ? { id: r.id, role: r.role, displayName: r.display_name, email: r.email } : null;
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireRole(req: FastifyRequest, role: Role): AuthUser {
  const user = requireUser(req);
  if (user.role !== role) throw forbidden(role === 'teacher' ? 'Riservato ai docenti' : 'Riservato agli allievi');
  return user;
}

export function cookieOptions(secure: boolean, maxAgeSec?: number) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    ...(maxAgeSec !== undefined ? { maxAge: maxAgeSec } : {}),
  };
}
