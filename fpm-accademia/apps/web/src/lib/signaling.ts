import { post } from './api.js';

/**
 * Trasporto dei messaggi di signaling: WebSocket se possibile, altrimenti HTTP "long polling".
 * Il ripiego serve soprattutto a Safari su iPad, che può rifiutare un WebSocket verso un
 * certificato autofirmato anche dopo che l'utente lo ha accettato per la pagina.
 */
export interface SignalMsg {
  type: string;
  role?: string;
  peerPresent?: boolean;
  data?: unknown;
}
export interface Transport {
  kind: 'websocket' | 'polling';
  send(msg: { type: string; data?: unknown }): void;
  close(): void;
}
interface Handlers {
  onMessage(m: SignalMsg): void;
  /** code: 4001/4003 = non autorizzato, 4000 = sostituito da un altro dispositivo, altro = rete */
  onClose(code: number): void;
}

function forcedPolling(): boolean {
  try {
    return new URLSearchParams(location.search).get('signal') === 'poll' || localStorage.getItem('fpm.signal') === 'poll';
  } catch {
    return false;
  }
}

export function openSignaling(linkId: string, h: Handlers): Transport {
  let current: Transport | null = null;
  let closed = false;
  const queue: { type: string; data?: unknown }[] = [];

  const usePolling = () => {
    if (closed) return;
    current = polling(linkId, h);
    queue.splice(0).forEach((m) => current!.send(m));
  };

  if (forcedPolling() || typeof WebSocket === 'undefined') {
    usePolling();
  } else {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/rtc?link=${encodeURIComponent(linkId)}`);
    let opened = false;
    const fallbackTimer = setTimeout(() => {
      if (!opened) {
        ws.onclose = null;
        ws.close();
        usePolling();
      }
    }, 5000);
    ws.onopen = () => {
      opened = true;
      clearTimeout(fallbackTimer);
      current = {
        kind: 'websocket',
        send: (m) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m)),
        close: () => ws.close(),
      };
      queue.splice(0).forEach((m) => current!.send(m));
    };
    ws.onmessage = (ev) => h.onMessage(JSON.parse(ev.data as string) as SignalMsg);
    ws.onclose = (ev) => {
      clearTimeout(fallbackTimer);
      if (!opened && ev.code !== 4001 && ev.code !== 4003) return usePolling(); // handshake fallito
      if (!closed) h.onClose(ev.code);
    };
  }

  return {
    get kind() {
      return current?.kind ?? 'websocket';
    },
    send: (m) => (current ? current.send(m) : queue.push(m)),
    close: () => {
      closed = true;
      current?.close();
    },
  } as Transport;
}

function polling(linkId: string, h: Handlers): Transport {
  let sid: string | null = null;
  let stopped = false;
  const outbox: { type: string; data?: unknown }[] = [];
  // Invii in sequenza: l'ordine conta (descrizione prima dei candidati ICE).
  let chain: Promise<unknown> = Promise.resolve();
  const flush = () => {
    if (!sid) return;
    const id = sid;
    for (const msg of outbox.splice(0)) {
      chain = chain.then(() => post('/api/rtc/poll/send', { sid: id, msg }).catch(() => {}));
    }
  };
  (async () => {
    try {
      sid = (await post<{ sid: string }>('/api/rtc/poll/join', { link: linkId })).sid;
    } catch (e) {
      const status = (e as { status?: number }).status;
      return h.onClose(status === 403 || status === 401 ? 4003 : 1006);
    }
    flush();
    while (!stopped) {
      try {
        const res = await fetch(`/api/rtc/poll?sid=${encodeURIComponent(sid)}`, { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { msgs: SignalMsg[]; closed: number | null };
        body.msgs.forEach((m) => h.onMessage(m));
        if (body.closed !== null) {
          stopped = true;
          return h.onClose(body.closed);
        }
      } catch {
        if (!stopped) {
          stopped = true;
          return h.onClose(1006);
        }
      }
    }
  })();
  return {
    kind: 'polling',
    send: (m) => {
      outbox.push(m);
      flush();
    },
    close: () => {
      stopped = true;
      if (sid) void post('/api/rtc/poll/leave', { sid }).catch(() => {});
    },
  };
}
