import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';
import { hostname } from 'node:os';
import path from 'node:path';
import selfsigned from 'selfsigned';

/**
 * Certificato HTTPS autofirmato per l'iPad (Safari consente videocamera e microfono solo su HTTPS).
 * Rigenerato se cambiano gli indirizzi del Mac (es. un'altra rete Wi-Fi).
 */
export async function loadOrCreateCert(dir: string, ips: string[]): Promise<{ key: string; cert: string }> {
  await mkdir(dir, { recursive: true });
  const keyFile = path.join(dir, 'fpm-key.pem');
  const certFile = path.join(dir, 'fpm-cert.pem');
  try {
    const [key, cert] = await Promise.all([readFile(keyFile, 'utf8'), readFile(certFile, 'utf8')]);
    const x = new X509Certificate(cert);
    const san = x.subjectAltName ?? '';
    const valid = new Date(x.validTo).getTime() > Date.now() + 7 * 86400e3;
    if (valid && ips.every((ip) => san.includes(`IP Address:${ip}`))) return { key, cert };
  } catch {
    /* da creare */
  }
  const host = hostname().replace(/\.local$/, '');
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'FPM Accademia (Mac locale)' }], {
    keyType: 'ec',
    curve: 'P-256',
    algorithm: 'sha256',
    notAfterDate: new Date(Date.now() + 365 * 86400e3),
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2 as const, value: 'localhost' },
          { type: 2 as const, value: `${host}.local` },
          { type: 7 as const, ip: '127.0.0.1' },
          ...ips.map((ip) => ({ type: 7 as const, ip })),
        ],
      },
    ],
  });
  await writeFile(keyFile, pems.private, { mode: 0o600 });
  await writeFile(certFile, pems.cert);
  return { key: pems.private, cert: pems.cert };
}
