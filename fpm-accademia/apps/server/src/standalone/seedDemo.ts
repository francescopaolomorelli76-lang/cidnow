import type { Db } from '../db.js';
import { hashPassword } from '../security/password.js';

export const DEMO_PASSWORD = 'demo-password-123';

/**
 * Dati iniziali della simulazione Mac + iPad (solo se il database è vuoto):
 * un docente con licenza SIMULATA e un allievo già approvato, per provare subito la lezione.
 * Si possono comunque creare altri account e inviti dall'app.
 */
export async function seedDemo(db: Db): Promise<boolean> {
  const { rows } = await db.query<{ n: string }>('SELECT count(*)::text AS n FROM users');
  if (Number(rows[0]?.n ?? 0) > 0) return false;
  const hash = await hashPassword(DEMO_PASSWORD);
  const t = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, role, is_adult)
     VALUES ('docente@demo.local', $1, 'FP Morelli', 'teacher', true) RETURNING id`,
    [hash],
  );
  const s = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, role, is_adult)
     VALUES ('allievo@demo.local', $1, 'Allievo iPad', 'student', true) RETURNING id`,
    [hash],
  );
  const tid = t.rows[0]!.id;
  const sid = s.rows[0]!.id;
  for (const id of [tid, sid]) {
    await db.query(`INSERT INTO consents (user_id, kind, version) VALUES ($1, 'terms', 'demo'), ($1, 'privacy', 'demo')`, [id]);
  }
  await db.query(`INSERT INTO teacher_profiles (user_id, discipline) VALUES ($1, 'canto')`, [tid]);
  await db.query('INSERT INTO student_profiles (user_id) VALUES ($1)', [sid]);
  await db.query(
    `INSERT INTO licenses (teacher_id, provider, provider_ref, price_cents) VALUES ($1, 'mock', 'mock-demo-mac', 9990)`,
    [tid],
  );
  await db.query(
    `INSERT INTO teacher_student_links (teacher_id, student_id, status, decided_at) VALUES ($1, $2, 'approved', now())`,
    [tid, sid],
  );
  return true;
}
