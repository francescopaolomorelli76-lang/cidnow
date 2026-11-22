import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CreateInvitationSchema,
  CreateLessonSchema,
  LinkDecisionSchema,
  TeacherProfileUpdateSchema,
} from '@fpm/shared';
import { requireRole } from '../auth.js';
import { withTx } from '../db.js';
import { conflict, licenseRequired, notFound, parse } from '../errors.js';
import { assertApprovedLink } from '../policy.js';
import { formatInviteCode, newInviteCode, sha256 } from '../security/tokens.js';
import { TRIAL_LIMITS, dbEntitlementProvider, requireActiveEntitlement } from '../entitlements/entitlements.js';
import type { AppDeps } from '../app.js';
import { closeRoom } from './rtc.js';

const IdParams = z.object({ id: z.string().uuid() });
const idOf = (params: unknown) => {
  const r = IdParams.safeParse(params);
  if (!r.success) throw notFound();
  return r.data.id;
};

export async function teacherRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, payments } = deps;

  // ---------- Profilo e disciplina ----------
  app.get('/api/teacher/profile', async (req) => {
    const me = requireRole(req, 'teacher');
    const { rows } = await db.query(
      'SELECT discipline, cover_preset AS "coverPreset", bio FROM teacher_profiles WHERE user_id = $1',
      [me.id],
    );
    return rows[0] ?? { discipline: null, coverPreset: 'studio', bio: '' };
  });

  app.put('/api/teacher/profile', async (req) => {
    const me = requireRole(req, 'teacher');
    const input = parse(TeacherProfileUpdateSchema, req.body);
    await db.query(
      `UPDATE teacher_profiles SET discipline = $2, cover_preset = $3, bio = $4, updated_at = now()
        WHERE user_id = $1`,
      [me.id, input.discipline, input.coverPreset, input.bio],
    );
    return input;
  });

  // ---------- Prova e licenza ----------
  app.get('/api/teacher/entitlement', async (req) => {
    const me = requireRole(req, 'teacher');
    return dbEntitlementProvider.get(db, me.id);
  });

  app.post('/api/teacher/trial', async (req) => {
    const me = requireRole(req, 'teacher');
    return dbEntitlementProvider.startTrial(db, me.id);
  });

  app.post('/api/teacher/license/purchase', async (req) => {
    const me = requireRole(req, 'teacher');
    const current = await dbEntitlementProvider.get(db, me.id);
    if (current.state === 'licensed') return current; // licenza permanente: nessun secondo acquisto
    const purchase = await payments.purchaseTeacherLicense(me.id);
    await db.query(
      `INSERT INTO licenses (teacher_id, provider, provider_ref, price_cents, currency)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (teacher_id) DO NOTHING`,
      [me.id, purchase.provider, purchase.providerRef, purchase.priceCents, purchase.currency],
    );
    return dbEntitlementProvider.get(db, me.id);
  });

  /** Ripristino: la licenza è legata all'account, quindi basta accedere da un nuovo dispositivo. */
  app.post('/api/teacher/license/restore', async (req) => {
    const me = requireRole(req, 'teacher');
    return dbEntitlementProvider.get(db, me.id);
  });

  // ---------- Inviti ----------
  app.post('/api/teacher/invitations', async (req, reply) => {
    const me = requireRole(req, 'teacher');
    const input = parse(CreateInvitationSchema, req.body);
    const ent = await requireActiveEntitlement(db, me.id);
    const maxUses = ent.state === 'trial-active' ? 1 : input.maxUses;
    if (ent.state === 'trial-active') {
      const { rows } = await db.query<{ n: string }>(
        `SELECT count(*) AS n FROM invitations
          WHERE teacher_id = $1 AND revoked_at IS NULL AND expires_at > now() AND uses < max_uses`,
        [me.id],
      );
      if (Number(rows[0]!.n) >= TRIAL_LIMITS.maxActiveInvitations) {
        throw licenseRequired('Durante la prova puoi avere un solo invito attivo.');
      }
    }
    const code = newInviteCode();
    const { rows } = await db.query<{ id: string; expires_at: Date }>(
      `INSERT INTO invitations (teacher_id, code_hash, code_hint, note, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6))
       RETURNING id, expires_at`,
      [me.id, sha256(code), code.slice(-3), input.note, maxUses, input.expiresInHours],
    );
    const inv = rows[0]!;
    // Il codice in chiaro viene restituito SOLO qui; nel database resta l'hash.
    return reply.code(201).send({
      id: inv.id,
      code: formatInviteCode(code),
      expiresAt: inv.expires_at.toISOString(),
      maxUses,
    });
  });

  app.get('/api/teacher/invitations', async (req) => {
    const me = requireRole(req, 'teacher');
    const { rows } = await db.query(
      `SELECT id, code_hint AS "codeHint", note, max_uses AS "maxUses", uses,
              expires_at AS "expiresAt", revoked_at AS "revokedAt", created_at AS "createdAt",
              CASE WHEN revoked_at IS NOT NULL THEN 'revoked'
                   WHEN expires_at <= now() THEN 'expired'
                   WHEN uses >= max_uses THEN 'used'
                   ELSE 'active' END AS status
         FROM invitations WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [me.id],
    );
    return rows;
  });

  app.post('/api/teacher/invitations/:id/revoke', async (req) => {
    const me = requireRole(req, 'teacher');
    const id = idOf(req.params);
    // Il filtro su teacher_id impedisce di revocare inviti di altri docenti.
    const { rowCount } = await db.query(
      `UPDATE invitations SET revoked_at = coalesce(revoked_at, now()) WHERE id = $1 AND teacher_id = $2`,
      [id, me.id],
    );
    if (!rowCount) throw notFound('Invito non trovato');
    return { ok: true };
  });

  // ---------- Richieste e collegamenti con gli allievi ----------
  app.get('/api/teacher/links', async (req) => {
    const me = requireRole(req, 'teacher');
    const { rows } = await db.query(
      `SELECT l.id, l.status, l.requested_at AS "requestedAt", l.decided_at AS "decidedAt",
              u.id AS "studentId", u.display_name AS "studentName", u.is_adult AS "isAdult"
         FROM teacher_student_links l JOIN users u ON u.id = l.student_id
        WHERE l.teacher_id = $1
        ORDER BY l.requested_at DESC LIMIT 200`,
      [me.id],
    );
    return rows;
  });

  app.post('/api/teacher/links/:id/decision', async (req) => {
    const me = requireRole(req, 'teacher');
    const id = idOf(req.params);
    const { decision } = parse(LinkDecisionSchema, req.body);
    return withTx(db, async (tx) => {
      const { rows } = await tx.query<{ status: string }>(
        `SELECT status FROM teacher_student_links WHERE id = $1 AND teacher_id = $2 FOR UPDATE`,
        [id, me.id],
      );
      const link = rows[0];
      if (!link) throw notFound('Richiesta non trovata');
      if (link.status !== 'pending') throw conflict('not_pending', 'La richiesta è già stata gestita');
      if (decision === 'approve') {
        const ent = await requireActiveEntitlement(tx, me.id);
        if (ent.state === 'trial-active') {
          const c = await tx.query<{ n: string }>(
            `SELECT count(*) AS n FROM teacher_student_links WHERE teacher_id = $1 AND status = 'approved'`,
            [me.id],
          );
          if (Number(c.rows[0]!.n) >= TRIAL_LIMITS.maxStudents) {
            throw licenseRequired('Durante la prova puoi collegare un solo allievo.');
          }
        }
      }
      const status = decision === 'approve' ? 'approved' : 'rejected';
      await tx.query(`UPDATE teacher_student_links SET status = $2, decided_at = now() WHERE id = $1`, [
        id,
        status,
      ]);
      return { id, status };
    });
  });

  app.post('/api/teacher/links/:id/revoke', async (req) => {
    const me = requireRole(req, 'teacher');
    const id = idOf(req.params);
    const { rowCount } = await db.query(
      `UPDATE teacher_student_links SET status = 'revoked', decided_at = now()
        WHERE id = $1 AND teacher_id = $2 AND status IN ('pending', 'approved')`,
      [id, me.id],
    );
    if (!rowCount) throw notFound('Collegamento non trovato o già chiuso');
    closeRoom(id); // eventuale videolezione in corso: disconnessa subito
    return { id, status: 'revoked' };
  });

  app.get('/api/teacher/students', async (req) => {
    const me = requireRole(req, 'teacher');
    const { rows } = await db.query(
      `SELECT u.id, u.display_name AS "displayName", u.is_adult AS "isAdult", l.decided_at AS "linkedAt"
         FROM teacher_student_links l JOIN users u ON u.id = l.student_id
        WHERE l.teacher_id = $1 AND l.status = 'approved'
        ORDER BY u.display_name`,
      [me.id],
    );
    return rows;
  });

  // ---------- Lezioni ----------
  app.post('/api/teacher/lessons', async (req, reply) => {
    const me = requireRole(req, 'teacher');
    const input = parse(CreateLessonSchema, req.body);
    await requireActiveEntitlement(db, me.id);
    await assertApprovedLink(db, me.id, input.studentId);
    const { rows } = await db.query(
      `INSERT INTO lessons (teacher_id, student_id, title, starts_at, duration_minutes, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, student_id AS "studentId", title, starts_at AS "startsAt",
                 duration_minutes AS "durationMinutes", notes, status`,
      [me.id, input.studentId, input.title, input.startsAt, input.durationMinutes, input.notes],
    );
    return reply.code(201).send(rows[0]);
  });

  app.get('/api/teacher/lessons', async (req) => {
    const me = requireRole(req, 'teacher');
    const { rows } = await db.query(
      `SELECT le.id, le.student_id AS "studentId", u.display_name AS "studentName", le.title,
              le.starts_at AS "startsAt", le.duration_minutes AS "durationMinutes", le.notes, le.status
         FROM lessons le JOIN users u ON u.id = le.student_id
        WHERE le.teacher_id = $1 ORDER BY le.starts_at LIMIT 200`,
      [me.id],
    );
    return rows;
  });
}
