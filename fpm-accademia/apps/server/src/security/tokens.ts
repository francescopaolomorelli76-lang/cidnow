import { createHash, randomBytes, randomInt } from 'node:crypto';
import { INVITE_ALPHABET } from '@fpm/shared';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Codice invito: 10 simboli Crockford base32 = 50 bit di casualità crittografica.
 * Insieme a scadenza, revoca, numero massimo di usi, approvazione del docente e rate limit
 * rende impraticabili i tentativi a forza bruta.
 */
export function newInviteCode(): string {
  let code = '';
  for (let i = 0; i < 10; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}
