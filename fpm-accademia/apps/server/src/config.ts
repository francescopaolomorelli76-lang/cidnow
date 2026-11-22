import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(8787),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  PAYMENT_PROVIDER: z.enum(['mock', 'apple', 'google', 'stripe']).default('mock'),
  /** Solo sviluppo/test automatici: moltiplica i limiti di frequenza. Ignorato in produzione. */
  /** Server STUN opzionali per la videolezione tra reti diverse (separati da virgola). */
  STUN_URLS: z.string().optional(),
  /** Modalità "Mac + iPad": serve anche l'app web e un'interfaccia HTTPS sulla rete locale. */
  LAN_MODE: z.enum(['0', '1']).default('0'),
  HTTPS_PORT: z.coerce.number().int().default(8443),
  WEB_DIST: z.string().optional(),
  DATA_DIR: z.string().optional(),
  RATE_LIMIT_SCALE: z.coerce.number().min(1).max(1000).default(1),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Non stampare i valori: potrebbero contenere segreti.
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configurazione non valida o mancante: ${keys}. Vedi .env.example`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === 'production') cfg.RATE_LIMIT_SCALE = 1;
  return cfg;
}
