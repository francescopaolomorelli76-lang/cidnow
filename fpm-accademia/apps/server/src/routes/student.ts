import type { FastifyInstance } from 'fastify';
import { RedeemInvitationSchema } from '@fpm/shared';
import { requireRole } from '../auth.js';
import { withTx } from '../db.js';
import { AppError, conflict, forbidden, parse } from '../errors.js';
import { approvedTeacherOf } from '../policy.js';
import { sha256 } from '../security/tokens.js';
import type { AppDeps } from '../app.js';
import { closeRoom } from './rtc.js';

/** Stesso messaggio per codice inesistente, scaduto, revocato o esaurito: non aiuta chi tira a indovinare. */
const invalidCode = () => new AppError(400, 'invalid_code', 'Codice non valido, scaduto o già utilizzato');

export async function studentRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db } = deps;

  app.post(
    '/api/student/link-requests',
    { config: deps.limit(10, '15 minutes') },
    async (req, reply) => {
      const me = requireRole(req, 'student');
      const { code } = parse(RedeemInvitationSchema, req.body);
      const result = await withTx(db, async (tx) => {
        const active = await tx.query(
          `SELECT 1 FROM teacher_student_links WHERE student_id = $1 AND status IN ('pending', 'approved')`,
          [me.id],
        );
        if (active.rowCount) {
          throw conflict('already_linked', 'Hai già un docente collegato o una richiesta in attesa');
        }
        const { rows } = await tx.query<{ id: string; teacher_id: string }>(
          `SELECT id, teacher_id FROM invitations
            WHERE code_hash = $1 AND revoked_at IS NULL AND expires_at > now() AND uses < max_uses
            FOR UPDATE`,
          [sha256(code)],
        );
        const inv = rows[0];
        if (!inv) throw invalidCode();
        await tx.query('UPDATE invitations SET uses = uses + 1 WHERE id = $1', [inv.id]);
        const link = await tx.query<{ id: string }>(
          `INSERT INTO teacher_student_links (teacher_id, student_id, invitation_id, status)
           VALUES ($1, $2, $3, 'pending') RETURNING id`,
          [inv.teacher_id, me.id, inv.id],
        );
        return { id: link.rows[0]!.id, status: 'pending' as const };
      });
      return reply.code(201).send(result);
    },
  );

  /** Stato del proprio collegamento. Il nome del docente è visibile; il resto solo dopo l'approvazione. */
  app.get('/api/student/link', async (req) => {
    const me = requireRole(req, 'student');
    const { rows } = await db.query(
      `SELECT l.id, l.status, l.requested_at AS "requestedAt", u.display_name AS "teacherName"
         FROM teacher_student_links l JOIN users u ON u.id = l.teacher_id
        WHERE l.student_id = $1 ORDER BY l.requested_at DESC LIMIT 1`,
      [me.id],
    );
    return rows[0] ?? null;
  });

  /** L'allievo può annullare una richiesta in attesa o lasciare il docente. */
  app.post('/api/student/link/leave', async (req) => {
    const me = requireRole(req, 'student');
    const { rows } = await db.query<{ id: string }>(
      `UPDATE teacher_student_links SET status = 'revoked', decided_at = now()
        WHERE student_id = $1 AND status IN ('pending', 'approved') RETURNING id`,
      [me.id],
    );
    rows.forEach((r) => closeRoom(r.id));
    return { ok: true };
  });

  app.get('/api/student/teacher', async (req) => {
    const me = requireRole(req, 'student');
    const teacherId = await approvedTeacherOf(db, me.id);
    if (!teacherId) throw forbidden('Nessun docente approvato');
    const { rows } = await db.query(
      `SELECT u.id, u.display_name AS "displayName", p.discipline, p.cover_preset AS "coverPreset", p.bio
         FROM users u JOIN teacher_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [teacherId],
    );
    return rows[0];
  });

  /** Solo le lezioni del docente con cui il collegamento è ATTUALMENTE approvato. */
  app.get('/api/student/lessons', async (req) => {
    const me = requireRole(req, 'student');
    const teacherId = await approvedTeacherOf(db, me.id);
    if (!teacherId) throw forbidden('Nessun docente approvato');
    const { rows } = await db.query(
      `SELECT id, title, starts_at AS "startsAt", duration_minutes AS "durationMinutes", notes, status
         FROM lessons WHERE student_id = $1 AND teacher_id = $2 ORDER BY starts_at LIMIT 200`,
      [me.id, teacherId],
    );
    return rows;
  });
}
