import type { FastifyInstance } from 'fastify';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Serve l'app web compilata (modalità Mac + iPad). Percorsi sconosciuti → index.html (navigazione dell'app). */
export function serveWeb(app: FastifyInstance, root: string) {
  const base = path.resolve(root);
  app.setNotFoundHandler(async (req, reply) => {
    const url = (req.raw.url ?? '/').split('?')[0]!;
    if (req.method !== 'GET' || url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'not_found', message: 'Risorsa non trovata' });
    }
    let file = path.resolve(base, '.' + decodeURIComponent(url));
    if (!file.startsWith(base)) return reply.code(404).send();
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(base, 'index.html');
    }
    try {
      const body = await readFile(file);
      const ext = path.extname(file);
      reply.header('content-type', MIME[ext] ?? 'application/octet-stream');
      reply.header('cache-control', ext === '.html' ? 'no-cache' : 'public, max-age=3600');
      return reply.send(body);
    } catch {
      return reply.code(404).send();
    }
  });
}
