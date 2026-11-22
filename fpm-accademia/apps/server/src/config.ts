import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(8787),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  PAYMENT_PROVIDER: z.enum(['mock', 'apple', 'google', 'stripe']).default('mock'),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Non stampare i valori: potrebbero contenere segreti.
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configurazione non valida o mancante: ${keys}. Vedi .env.example`);
  }
  return parsed.data;
}
