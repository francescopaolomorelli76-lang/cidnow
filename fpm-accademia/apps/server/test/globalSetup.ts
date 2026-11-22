import { createPool } from '../src/db.js';
import { migrate } from '../src/migrate.js';

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://fpm:fpm_dev_only@localhost:5432/fpm_test';

/** Ricrea da zero lo schema del database di TEST (mai quello di sviluppo) e applica le migrazioni. */
export default async function setup() {
  // PGlite in memoria: ogni processo di test parte da un database vuoto, migrato in setupApp.
  if (TEST_DB_URL.startsWith('pglite:')) return;
  if (!/test/.test(new URL(TEST_DB_URL).pathname)) {
    throw new Error('TEST_DATABASE_URL deve puntare a un database il cui nome contiene "test"');
  }
  const db = createPool(TEST_DB_URL);
  await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await migrate(db);
  await db.end();
}
