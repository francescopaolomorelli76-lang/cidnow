import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Role } from '@fpm/shared';
import type { AppDeps } from '../app.js';
import type { Queryable } from '../db.js';
import { requireUser } from '../auth.js';
import { AppError, forbidden, parse } from '../errors.js';

/**
 * Signaling WebRTC per la videolezione.
 * Una "stanza" = un collegamento docente↔allievo APPROVATO. Il server non vede audio e video:
 * inoltra soltanto i messaggi di negoziazione (offerta/risposta/candidati ICE) tra i due partecipanti.
 *
 * Due trasporti equivalenti:
 *  - WebSocket (/api/rtc), preferito;
 *  - HTTP "long polling" (/api/rtc/poll/*), di riserva: Safari su iPad a volte rifiuta i WebSocket
 *    verso un certificato autofirmato anche dopo che l'utente lo ha accettato per la pagina.
 */
interface Peer {
  send(msg: unknown): void;
  close(code: number, reason: string): void;
}
interface Room {
  teacher?: Peer;
  student?: Peer;
}
const rooms = new Map<string, Room>();

const MAX_MSG_BYTES = 64 * 1024;
const MAX_MSGS_PER_10S = 300;

/** Chiude la stanza di un collegamento (es. dopo una revoca): i partecipanti vengono disconnessi. */
export function closeRoom(linkId: string, reason = 'revoked') {
  const room = rooms.get(linkId);
  if (!room) return;
  for (const p of [room.teacher, room.student]) p?.close(4003, reason);
  rooms.delete(linkId);
}

async function roleInLink(db: Queryable, linkId: string, user: { id: string; role: Role }): Promise<Role | null> {
  const { rows } = await db.query<{ teacher_id: string; student_id: string }>(
    `SELECT teacher_id, student_id FROM teacher_student_links WHERE id = $1 AND status = 'approved'`,
    [linkId],
  );
  const link = rows[0];
  if (!link) return null;
  const role: Role | null = link.teacher_id === user.id ? 'teacher' : link.student_id === user.id ? 'student' : null;
  return role === user.role ? role : null;
}

/** Entra nella stanza; restituisce le funzioni per inoltrare messaggi e per uscire. */
function join(linkId: string, role: Role, peer: Peer) {
  const room = rooms.get(linkId) ?? {};
  rooms.set(linkId, room);
  // Lo stesso utente da un altro dispositivo/scheda sostituisce la connessione precedente.
  room[role]?.close(4000, 'replaced');
  room[role] = peer;
  const other: Role = role === 'teacher' ? 'student' : 'teacher';
  peer.send({ type: 'joined', role, peerPresent: !!room[other] });
  room[other]?.send({ type: 'peer-joined', role });
  let count = 0;
  const window = setInterval(() => (count = 0), 10_000);
  return {
    relay(msg: { type?: string; data?: unknown }) {
      if (++count > MAX_MSGS_PER_10S) return;
      if (msg.type === 'signal') room[other]?.send({ type: 'signal', from: role, data: msg.data });
      if (msg.type === 'ping') peer.send({ type: 'pong', t: Date.now() });
    },
    leave() {
      clearInterval(window);
      if (room[role] === peer) {
        delete room[role];
        room[other]?.send({ type: 'peer-left', role });
        if (!room.teacher && !room.student) rooms.delete(linkId);
      }
    },
  };
}

/* ---------------- Trasporto HTTP di riserva ---------------- */
interface PollSession {
  userId: string;
  queue: unknown[];
  waiter: ((msgs: unknown[]) => void) | null;
  closed: number | null;
  lastSeen: number;
  handle: ReturnType<typeof join>;
}
const pollSessions = new Map<string, PollSession>();
const POLL_WAIT_MS = 20_000;
const POLL_EXPIRE_MS = 35_000;

setInterval(() => {
  const now = Date.now();
  for (const [sid, s] of pollSessions) {
    if (now - s.lastSeen > POLL_EXPIRE_MS) {
      s.handle.leave();
      pollSessions.delete(sid);
    }
  }
}, 10_000).unref();

function pollSession(req: FastifyRequest, sid: string): PollSession {
  const user = requireUser(req);
  const s = pollSessions.get(sid);
  if (!s || s.userId !== user.id) throw new AppError(404, 'not_found', 'Sessione della lezione non trovata');
  s.lastSeen = Date.now();
  return s;
}

const Query = z.object({ link: z.string().uuid() });
const Sid = z.object({ sid: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) });

export async function rtcRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, config } = deps;

  /** Server ICE. Sulla stessa rete Wi-Fi non servono; per reti diverse vanno configurati STUN/TURN. */
  app.get('/api/rtc/config', async (req) => {
    if (!req.user) return { iceServers: [] };
    const urls = (config.STUN_URLS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return { iceServers: urls.length ? [{ urls }] : [] };
  });

  app.get('/api/rtc', { websocket: true }, async (socket: WebSocket, req) => {
    const user = req.user;
    const q = Query.safeParse(req.query);
    if (!user || !q.success) return socket.close(4001, 'unauthorized');
    const role = await roleInLink(db, q.data.link, user);
    if (!role) return socket.close(4003, 'forbidden');
    const peer: Peer = {
      send: (m) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(m)),
      close: (code, reason) => socket.close(code, reason),
    };
    const h = join(q.data.link, role, peer);
    socket.on('message', (raw: Buffer) => {
      if (raw.length > MAX_MSG_BYTES) return;
      try {
        h.relay(JSON.parse(raw.toString()));
      } catch {
        /* messaggio non valido */
      }
    });
    socket.on('close', () => h.leave());
  });

  app.post('/api/rtc/poll/join', async (req) => {
    const user = requireUser(req);
    const { link } = parse(Query, req.body);
    const role = await roleInLink(db, link, user);
    if (!role) throw forbidden('Collegamento non attivo');
    const sid = randomBytes(24).toString('base64url');
    const session = {} as PollSession;
    const peer: Peer = {
      send: (m) => {
        if (session.waiter) {
          const w = session.waiter;
          session.waiter = null;
          w([m]);
        } else session.queue.push(m);
      },
      close: (code) => {
        session.closed = code;
        session.waiter?.([]);
        session.waiter = null;
      },
    };
    Object.assign(session, { userId: user.id, queue: [], waiter: null, closed: null, lastSeen: Date.now() });
    session.handle = join(link, role, peer);
    pollSessions.set(sid, session);
    return { sid };
  });

  app.get('/api/rtc/poll', async (req) => {
    const { sid } = parse(Sid, req.query);
    const s = pollSession(req, sid);
    if (s.queue.length || s.closed !== null) {
      const msgs = s.queue.splice(0);
      return { msgs, closed: s.closed };
    }
    const msgs = await new Promise<unknown[]>((resolve) => {
      const t = setTimeout(() => {
        if (s.waiter === resolve) s.waiter = null;
        resolve([]);
      }, POLL_WAIT_MS);
      s.waiter = (m) => {
        clearTimeout(t);
        resolve(m);
      };
    });
    s.lastSeen = Date.now();
    return { msgs: [...msgs, ...s.queue.splice(0)], closed: s.closed };
  });

  app.post('/api/rtc/poll/send', { bodyLimit: MAX_MSG_BYTES }, async (req) => {
    const body = (req.body ?? {}) as { sid?: string; msg?: { type?: string; data?: unknown } };
    const { sid } = parse(Sid, { sid: body.sid });
    const s = pollSession(req, sid);
    if (s.closed === null && body.msg) s.handle.relay(body.msg);
    return { ok: true };
  });

  app.post('/api/rtc/poll/leave', async (req) => {
    const { sid } = parse(Sid, req.body);
    const s = pollSession(req, sid);
    s.handle.leave();
    pollSessions.delete(sid);
    return { ok: true };
  });
}
