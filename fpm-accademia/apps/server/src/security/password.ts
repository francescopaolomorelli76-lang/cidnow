import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// scrypt (memory-hard) dalla libreria standard di Node: nessuna dipendenza nativa.
const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 } as const;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, PARAMS.keylen, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hash fittizio usato quando l'utente non esiste, per non rivelarlo tramite i tempi di risposta. */
export const DUMMY_HASH = [
  'scrypt',
  PARAMS.N,
  PARAMS.r,
  PARAMS.p,
  Buffer.alloc(16).toString('base64'),
  Buffer.alloc(64).toString('base64'),
].join('$');
