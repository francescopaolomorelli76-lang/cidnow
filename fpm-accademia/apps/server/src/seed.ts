/**
 * Dati DEMO per lo sviluppo locale (mai in produzione).
 * Crea un docente e un allievo con password nota, per provare il percorso a mano.
 */
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { migrate } from './migrate.js';
import { hashPassword } from './security/password.js';

const config = loadConfig();
if (config.NODE_ENV === 'production') throw new Error('Seed demo vietato in produzione');
const db = createPool(config.DATABASE_URL);
await migrate(db);

const DEMO_PASSWORD = 'demo-password-123';
const hash = await hashPassword(DEMO_PASSWORD);
for (const [email, name, role] of [
  ['docente@demo.local', 'Docente Demo', 'teacher'],
  ['allievo@demo.local', 'Allievo Demo', 'student'],
] as const) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, role, is_adult)
     VALUES ($1, $2, $3, $4, true) ON CONFLICT DO NOTHING RETURNING id`,
    [email, hash, name, role],
  );
  const id = rows[0]?.id;
  if (!id) continue;
  await db.query(`INSERT INTO consents (user_id, kind, version) VALUES ($1, 'terms', 'demo'), ($1, 'privacy', 'demo')`, [id]);
  await db.query(role === 'teacher' ? 'INSERT INTO teacher_profiles (user_id) VALUES ($1)' : 'INSERT INTO student_profiles (user_id) VALUES ($1)', [id]);
}
console.log(`Utenti demo pronti: docente@demo.local / allievo@demo.local — password: ${DEMO_PASSWORD}`);
await db.end();
