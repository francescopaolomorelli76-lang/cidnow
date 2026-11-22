import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { migrate } from './migrate.js';

const config = loadConfig();
const db = createPool(config.DATABASE_URL);
await migrate(db);
const app = await buildApp(db, config, { rateLimitScale: config.RATE_LIMIT_SCALE });
if (config.PAYMENT_PROVIDER === 'mock' && config.NODE_ENV !== 'production') {
  app.log.warn('PaymentProvider MOCK attivo: gli acquisti della licenza sono SIMULATI (solo sviluppo).');
}
await app.listen({ port: config.PORT, host: '127.0.0.1' });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await db.end();
    process.exit(0);
  });
}
