/**
 * FPM Accademia — avvio autonomo "Mac + iPad".
 * Un solo processo: database PGlite locale, API, signaling della lezione e app web.
 *  - Mac (docente):  http://localhost:8780      (localhost: videocamera consentita senza certificato)
 *  - iPad (allievo): https://<IP-del-Mac>:8443  (stessa rete Wi-Fi; certificato generato dal Mac)
 */
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createPool } from '../db.js';
import { migrate } from '../migrate.js';
import { lanAddresses } from '../routes/lan.js';
import { serveWeb } from '../static.js';
import { loadOrCreateCert } from './cert.js';
import { DEMO_PASSWORD, seedDemo } from './seedDemo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir =
  process.env.DATA_DIR ??
  (process.platform === 'darwin'
    ? path.join(homedir(), 'Library', 'Application Support', 'FPM Accademia')
    : path.join(homedir(), '.fpm-accademia'));
const httpPort = Number(process.env.PORT ?? 8780);
const httpsPort = Number(process.env.HTTPS_PORT ?? 8443);

const config = loadConfig({
  NODE_ENV: 'development',
  DATABASE_URL: process.env.DATABASE_URL ?? `pglite:${path.join(dataDir, 'database')}`,
  PORT: String(httpPort),
  HTTPS_PORT: String(httpsPort),
  WEB_ORIGIN: `http://localhost:${httpPort}`,
  PAYMENT_PROVIDER: 'mock',
  LAN_MODE: '1',
  RATE_LIMIT_SCALE: process.env.RATE_LIMIT_SCALE ?? '1',
  ...(process.env.STUN_URLS ? { STUN_URLS: process.env.STUN_URLS } : {}),
});
const webDist = process.env.WEB_DIST ?? path.join(here, '..', 'web');

const db = createPool(config.DATABASE_URL);
await migrate(db);
const seeded = await seedDemo(db);

const quiet = { level: 'warn' } as const;
const local = await buildApp(db, config, { logger: quiet, rateLimitScale: config.RATE_LIMIT_SCALE });
serveWeb(local, webDist);
await local.listen({ port: httpPort, host: '127.0.0.1' });

const ips = lanAddresses();
const tls = await loadOrCreateCert(path.join(dataDir, 'cert'), ips);
const lan = await buildApp(db, config, { logger: quiet, rateLimitScale: config.RATE_LIMIT_SCALE, https: tls });
serveWeb(lan, webDist);
await lan.listen({ port: httpsPort, host: '0.0.0.0' });

const line = '─'.repeat(64);
console.log(`\n${line}\n  FPM — Accademia Musicale Online  ·  simulazione Mac + iPad\n${line}`);
console.log(`  Mac (docente):   http://localhost:${httpPort}`);
for (const ip of ips) console.log(`  iPad (allievo):  https://${ip}:${httpsPort}`);
if (ips.length === 0) console.log('  ATTENZIONE: il Mac non risulta collegato a una rete Wi-Fi/Ethernet.');
console.log(`\n  Account demo${seeded ? ' (creati ora)' : ''}:`);
console.log(`    docente@demo.local  /  ${DEMO_PASSWORD}`);
console.log(`    allievo@demo.local  /  ${DEMO_PASSWORD}`);
console.log(`\n  Dati salvati in: ${dataDir}`);
console.log(`  Per chiudere: premi Ctrl+C oppure chiudi questa finestra.\n${line}\n`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await Promise.allSettled([local.close(), lan.close()]);
    await db.end();
    process.exit(0);
  });
}
