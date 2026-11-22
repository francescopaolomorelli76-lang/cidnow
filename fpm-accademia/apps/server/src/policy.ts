import type { Queryable } from './db.js';
import { forbidden } from './errors.js';

/**
 * Regole di autorizzazione centralizzate. Ogni API che tocca dati di un'altra persona passa da qui.
 */

/** Il docente può agire sull'allievo solo se il collegamento è APPROVATO (non pending/revoked). */
export async function assertApprovedLink(db: Queryable, teacherId: string, studentId: string): Promise<void> {
  const { rowCount } = await db.query(
    `SELECT 1 FROM teacher_student_links
      WHERE teacher_id = $1 AND student_id = $2 AND status = 'approved'`,
    [teacherId, studentId],
  );
  if (!rowCount) throw forbidden('Allievo non collegato a questo docente');
}

/** Docente approvato dell'allievo, o null. */
export async function approvedTeacherOf(db: Queryable, studentId: string): Promise<string | null> {
  const { rows } = await db.query<{ teacher_id: string }>(
    `SELECT teacher_id FROM teacher_student_links WHERE student_id = $1 AND status = 'approved'`,
    [studentId],
  );
  return rows[0]?.teacher_id ?? null;
}
