import { COMMERCIAL } from '@fpm/shared';
import type { Queryable } from '../db.js';
import { licenseRequired } from '../errors.js';

/**
 * EntitlementProvider: unica fonte di verità su cosa può fare un docente.
 * Tutti i tempi sono calcolati con now() di PostgreSQL: l'orologio del client non conta mai.
 */
export type EntitlementState = 'none' | 'trial-active' | 'trial-expired' | 'licensed';

export interface Entitlement {
  state: EntitlementState;
  serverNow: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  license: { provider: string; purchasedAt: string; isMock: boolean } | null;
  limits: TrialLimits | null;
}

export interface TrialLimits {
  maxStudents: number;
  maxActiveInvitations: number;
  demoLessonMinutes: number;
}

export const TRIAL_LIMITS: TrialLimits = {
  maxStudents: 1,
  maxActiveInvitations: 1,
  demoLessonMinutes: COMMERCIAL.trialDemoLessonMinutes,
};

export interface EntitlementProvider {
  get(db: Queryable, teacherId: string): Promise<Entitlement>;
  startTrial(db: Queryable, teacherId: string): Promise<Entitlement>;
}

export const dbEntitlementProvider: EntitlementProvider = {
  async get(db, teacherId) {
    const { rows } = await db.query<{
      server_now: Date;
      started_at: Date | null;
      ends_at: Date | null;
      provider: string | null;
      purchased_at: Date | null;
    }>(
      `SELECT now() AS server_now, t.started_at, t.ends_at, l.provider, l.purchased_at
         FROM (SELECT 1) one
         LEFT JOIN trials t ON t.teacher_id = $1
         LEFT JOIN licenses l ON l.teacher_id = $1 AND l.status = 'active'`,
      [teacherId],
    );
    const r = rows[0]!;
    let state: EntitlementState = 'none';
    if (r.provider) state = 'licensed';
    else if (r.ends_at) state = r.ends_at.getTime() > r.server_now.getTime() ? 'trial-active' : 'trial-expired';
    return {
      state,
      serverNow: r.server_now.toISOString(),
      trialStartedAt: r.started_at?.toISOString() ?? null,
      trialEndsAt: r.ends_at?.toISOString() ?? null,
      license:
        r.provider && r.purchased_at
          ? { provider: r.provider, purchasedAt: r.purchased_at.toISOString(), isMock: r.provider === 'mock' }
          : null,
      limits: state === 'trial-active' ? TRIAL_LIMITS : null,
    };
  },

  async startTrial(db, teacherId) {
    // Una sola prova per account: se esiste già, non viene mai rinnovata.
    await db.query(
      `INSERT INTO trials (teacher_id, ends_at)
       VALUES ($1, now() + make_interval(hours => $2))
       ON CONFLICT (teacher_id) DO NOTHING`,
      [teacherId, COMMERCIAL.trialHours],
    );
    return this.get(db, teacherId);
  },
};

/** Lancia 402 se il docente non ha prova attiva né licenza. */
export async function requireActiveEntitlement(db: Queryable, teacherId: string): Promise<Entitlement> {
  const e = await dbEntitlementProvider.get(db, teacherId);
  if (e.state === 'licensed' || e.state === 'trial-active') return e;
  throw licenseRequired(
    e.state === 'trial-expired'
      ? 'La prova di 24 ore è terminata. Attiva la licenza permanente per continuare.'
      : 'Avvia la prova gratuita di 24 ore o attiva la licenza.',
  );
}
