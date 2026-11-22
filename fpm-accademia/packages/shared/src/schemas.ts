import { z } from 'zod';
import { DISCIPLINE_IDS } from './disciplines.js';

export const RoleSchema = z.enum(['teacher', 'student']);
export type Role = z.infer<typeof RoleSchema>;

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);
export const PasswordSchema = z
  .string()
  .min(10, 'La password deve avere almeno 10 caratteri')
  .max(200);

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: z.string().trim().min(1).max(80),
  role: RoleSchema,
  /** Tutela minori: l'allievo dichiara se è maggiorenne; se no serve consenso del genitore (flusso da completare). */
  isAdult: z.boolean(),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(200),
});

export const DisciplineSchema = z.enum(DISCIPLINE_IDS);

export const TeacherProfileUpdateSchema = z.object({
  discipline: DisciplineSchema,
  /** Personalizzazione entro i limiti del brand: solo testo e cover preimpostate. */
  coverPreset: z.enum(['studio', 'palco', 'aula', 'minimal']).default('studio'),
  bio: z.string().trim().max(500).default(''),
});

/** Codice invito: 10 caratteri Crockford base32 (senza I, L, O, U), con trattino opzionale. */
export const INVITE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const InviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{10}$/, 'Codice non valido'));

export const CreateInvitationSchema = z.object({
  /** Durata di validità in ore (1h – 14 giorni). */
  expiresInHours: z.number().int().min(1).max(24 * 14).default(72),
  /** Quanti allievi possono usare questo codice (1 = monouso). */
  maxUses: z.number().int().min(1).max(30).default(1),
  note: z.string().trim().max(120).default(''),
});

export const RedeemInvitationSchema = z.object({ code: InviteCodeSchema });

export const LinkDecisionSchema = z.object({ decision: z.enum(['approve', 'reject']) });

export const CreateLessonSchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(10).max(240),
  notes: z.string().trim().max(2000).default(''),
});

export const DevicePreferencesSchema = z.object({
  /** Identificativo locale casuale del browser/dispositivo (NON un id hardware). */
  deviceKey: z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/),
  label: z.string().trim().max(60).default(''),
  /** Etichette leggibili scelte dall'utente; gli deviceId del browser restano solo in locale. */
  audioInputLabel: z.string().max(120).nullable().default(null),
  audioOutputLabel: z.string().max(120).nullable().default(null),
  videoInputLabel: z.string().max(120).nullable().default(null),
  midiInputLabel: z.string().max(120).nullable().default(null),
  connectionType: z.enum(['wifi', 'ethernet', 'cellular', 'hotspot', 'unknown']).default('unknown'),
  headphonesConfirmed: z.boolean().default(false),
});
export type DevicePreferencesInput = z.infer<typeof DevicePreferencesSchema>;
