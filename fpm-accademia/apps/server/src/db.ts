import pg from 'pg';

/**
 * Accesso al database con due motori intercambiabili:
 *  - PostgreSQL vero (`postgres://...`): sviluppo, test, produzione;
 *  - PGlite (`pglite:<cartella>` o `pglite:memory`): PostgreSQL compilato in WebAssembly che gira
 *    dentro il processo, usato dal pacchetto per Mac (nessun database da installare).
 * Lo schema SQL e le query sono gli stessi.
 */
export interface QueryResult<R> {
  rows: R[];
  rowCount: number | null;
}
export interface Queryable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<R = any>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
}
export interface Tx extends Queryable {
  release(): void;
}
export interface Db extends Queryable {
  connect(): Promise<Tx>;
  end(): Promise<void>;
}

export function createPool(connectionString: string): Db {
  if (connectionString.startsWith('pglite:')) return pgliteDb(connectionString.slice('pglite:'.length));
  const pool = new pg.Pool({ connectionString, max: 10 });
  return {
    query: <R>(sql: string, params?: unknown[]) => pool.query(sql, params) as unknown as Promise<QueryResult<R>>,
    connect: async () => {
      const c = await pool.connect();
      return {
        query: <R>(sql: string, params?: unknown[]) => c.query(sql, params) as unknown as Promise<QueryResult<R>>,
        release: () => c.release(),
      };
    },
    end: () => pool.end(),
  };
}

export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ---------------- PGlite ---------------- */

type PGliteLike = {
  query<R>(sql: string, params?: unknown[]): Promise<{ rows: R[]; affectedRows?: number }>;
  exec(sql: string): Promise<{ rows: unknown[]; affectedRows?: number }[]>;
  close(): Promise<void>;
};

// Un'istanza per cartella, condivisa nel processo (PGlite non permette due aperture della stessa cartella).
const instances = new Map<string, { db: Promise<PGliteLike>; refs: number; lock: Promise<void> }>();

function pgliteDb(dir: string): Db {
  const key = dir || 'memory';
  let entry = instances.get(key);
  if (!entry) {
    const db = (async () => {
      if (key !== 'memory') {
        // Primo avvio: la cartella dei dati non esiste ancora.
        const { mkdir } = await import('node:fs/promises');
        await mkdir(key, { recursive: true });
      }
      const { PGlite } = await import('@electric-sql/pglite');
      return new PGlite(key === 'memory' ? undefined : key) as unknown as PGliteLike;
    })();
    entry = { db, refs: 0, lock: Promise.resolve() };
    instances.set(key, entry);
  }
  entry.refs++;
  const e = entry;

  // PGlite ha una sola connessione: le transazioni sono serializzate con un lucchetto.
  const acquire = async (): Promise<() => void> => {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const prev = e.lock;
    e.lock = prev.then(() => next);
    await prev;
    return release;
  };

  const run = async <R>(pgl: PGliteLike, sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
    if (!params || params.length === 0) {
      // Protocollo semplice: ammette più istruzioni (migrazioni); restituisce l'ultimo risultato.
      const res = await pgl.exec(sql);
      const last = res[res.length - 1];
      const rows = (last?.rows ?? []) as R[];
      return { rows, rowCount: rows.length > 0 ? rows.length : (last?.affectedRows ?? 0) };
    }
    const r = await pgl.query<R>(sql, params);
    // SELECT: PGlite riporta affectedRows = 0, quindi si contano le righe restituite.
    return { rows: r.rows, rowCount: r.rows.length > 0 ? r.rows.length : (r.affectedRows ?? 0) };
  };

  return {
    async query(sql, params) {
      const pgl = await e.db;
      const release = await acquire();
      try {
        return await run(pgl, sql, params);
      } finally {
        release();
      }
    },
    async connect() {
      const pgl = await e.db;
      const release = await acquire();
      let done = false;
      return {
        query: (sql, params) => run(pgl, sql, params),
        release: () => {
          if (!done) {
            done = true;
            release();
          }
        },
      };
    },
    async end() {
      e.refs--;
      if (e.refs <= 0) {
        instances.delete(key);
        await (await e.db).close();
      }
    },
  };
}
