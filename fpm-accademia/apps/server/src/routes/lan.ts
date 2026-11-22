import type { FastifyInstance } from 'fastify';
import { networkInterfaces, hostname } from 'node:os';
import { requireRole } from '../auth.js';
import type { AppDeps } from '../app.js';

/** Indirizzi IPv4 del computer sulla rete locale (Wi-Fi/Ethernet), esclusi quelli interni. */
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal && !ni.address.startsWith('169.254.')) out.push(ni.address);
    }
  }
  return out;
}

/** Modalità "Mac + iPad": il docente vede il link da aprire sull'iPad (stessa rete Wi-Fi). */
export async function lanRoutes(app: FastifyInstance, deps: AppDeps) {
  app.get('/api/lan-info', async (req) => {
    requireRole(req, 'teacher');
    if (deps.config.LAN_MODE !== '1') return { enabled: false, urls: [] };
    const port = deps.config.HTTPS_PORT;
    return {
      enabled: true,
      hostname: hostname(),
      urls: lanAddresses().map((ip) => `https://${ip}:${port}`),
    };
  });
}
