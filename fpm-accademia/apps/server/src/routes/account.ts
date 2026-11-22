import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DevicePreferencesSchema } from '@fpm/shared';
import { SESSION_COOKIE, cookieOptions, requireUser } from '../auth.js';
import { AppError, parse } from '../errors.js';
import { verifyPassword } from '../security/password.js';
import type { AppDeps } from '../app.js';

export async function accountRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, config } = deps;

  // ---------- Preferenze per dispositivo (Smart Setup) ----------
  app.get('/api/devices', async (req) => {
    const me = requireUser(req);
    const { rows } = await db.query(
      `SELECT device_key AS "deviceKey", label, audio_input_label AS "audioInputLabel",
              audio_output_label AS "audioOutputLabel", video_input_label AS "videoInputLabel",
              midi_input_label AS "midiInputLabel", connection_type AS "connectionType",
              headphones_confirmed AS "headphonesConfirmed", updated_at AS "updatedAt"
         FROM device_preferences WHERE user_id = $1 ORDER BY updated_at DESC`,
      [me.id],
    );
    return rows;
  });

  app.put('/api/devices', async (req) => {
    const me = requireUser(req);
    const p = parse(DevicePreferencesSchema, req.body);
    await db.query(
      `INSERT INTO device_preferences (user_id, device_key, label, audio_input_label, audio_output_label,
              video_input_label, midi_input_label, connection_type, headphones_confirmed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, device_key) DO UPDATE SET
         label = EXCLUDED.label, audio_input_label = EXCLUDED.audio_input_label,
         audio_output_label = EXCLUDED.audio_output_label, video_input_label = EXCLUDED.video_input_label,
         midi_input_label = EXCLUDED.midi_input_label, connection_type = EXCLUDED.connection_type,
         headphones_confirmed = EXCLUDED.headphones_confirmed, updated_at = now()`,
      [
        me.id,
        p.deviceKey,
        p.label,
        p.audioInputLabel,
        p.audioOutputLabel,
        p.videoInputLabel,
        p.midiInputLabel,
        p.connectionType,
        p.headphonesConfirmed,
      ],
    );
    return p;
  });

  // ---------- GDPR: esportazione e cancellazione ----------
  app.get('/api/me/export', async (req) => {
    const me = requireUser(req);
    const q = async (sql: string) => (await db.query(sql, [me.id])).rows;
    return {
      exportedAt: new Date().toISOString(),
      user: (await q('SELECT id, email, display_name, role, is_adult, created_at FROM users WHERE id = $1'))[0],
      consents: await q('SELECT kind, version, granted_at, revoked_at FROM consents WHERE user_id = $1'),
      teacherProfile: (await q('SELECT discipline, cover_preset, bio FROM teacher_profiles WHERE user_id = $1'))[0] ?? null,
      links: await q(
        'SELECT id, teacher_id, student_id, status, requested_at, decided_at FROM teacher_student_links WHERE teacher_id = $1 OR student_id = $1',
      ),
      lessons: await q(
        'SELECT id, teacher_id, student_id, title, starts_at, duration_minutes, notes, status FROM lessons WHERE teacher_id = $1 OR student_id = $1',
      ),
      devices: await q('SELECT device_key, label, connection_type, updated_at FROM device_preferences WHERE user_id = $1'),
      trial: (await q('SELECT started_at, ends_at FROM trials WHERE teacher_id = $1'))[0] ?? null,
      license: (await q('SELECT provider, price_cents, currency, purchased_at FROM licenses WHERE teacher_id = $1'))[0] ?? null,
    };
  });

  app.post('/api/me/delete', { config: deps.limit(5, '15 minutes') }, async (req, reply) => {
    const me = requireUser(req);
    const { password } = parse(z.object({ password: z.string().min(1).max(200) }), req.body);
    const { rows } = await db.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [me.id]);
    if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
      throw new AppError(401, 'bad_credentials', 'Password non corretta');
    }
    // TODO legale: valutare obblighi di conservazione fiscale delle ricevute di acquisto prima di cancellarle.
    await db.query('DELETE FROM users WHERE id = $1', [me.id]);
    reply.clearCookie(SESSION_COOKIE, cookieOptions(config.NODE_ENV === 'production'));
    return { ok: true };
  });

  // ---------- Misura rete verso il server (RTT/jitter) ----------
  app.get('/api/net/ping', { config: deps.limit(120, '1 minute') }, async () => ({
    serverTime: Date.now(),
  }));
}
