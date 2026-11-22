import type { z } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new AppError(401, 'unauthorized', 'Accesso richiesto');
export const forbidden = (msg = 'Operazione non consentita') => new AppError(403, 'forbidden', msg);
export const notFound = (msg = 'Risorsa non trovata') => new AppError(404, 'not_found', msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const licenseRequired = (msg: string) => new AppError(402, 'license_required', msg);

/** Valida l'input con zod; in caso di errore lancia un 400 con messaggi leggibili. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    throw new AppError(400, 'invalid_input', msg);
  }
  return r.data;
}
