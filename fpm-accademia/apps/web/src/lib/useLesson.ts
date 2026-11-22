import { useCallback, useEffect, useRef, useState } from 'react';
import { openSignaling, type SignalMsg, type Transport } from './signaling.js';

/**
 * Videolezione WebRTC tra docente e allievo.
 * - Signaling: WebSocket autenticato /api/rtc (solo collegamento approvato).
 * - "Perfect negotiation": l'allievo è il lato "polite", il docente "impolite".
 * - Canale dati "midi" (ordinato e affidabile) per note-on/off, velocity e pedale.
 * - Statistiche ogni 2 s: ritardo andata/ritorno, jitter audio, pacchetti persi, tipo di percorso.
 * La qualità reale dipende dalla rete: sulla stessa Wi-Fi il collegamento è diretto; tra reti diverse
 * può servire un server TURN (non incluso in questa versione).
 */
export type LessonState = 'idle' | 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed' | 'forbidden';

export interface LessonStats {
  rttMs: number | null;
  jitterMs: number | null;
  lossPct: number | null;
  path: 'diretto (rete locale)' | 'diretto (internet)' | 'relay TURN' | null;
  videoKbps: number | null;
  audioKbps: number | null;
}

export interface NoteMsg {
  t: 'n';
  on: boolean;
  note: number;
  vel: number;
  seq: number;
  ts: number;
}
export type PedalMsg = { t: 'p'; on: boolean; seq: number; ts: number };
export type DataMsg = NoteMsg | PedalMsg;

const EMPTY_STATS: LessonStats = { rttMs: null, jitterMs: null, lossPct: null, path: null, videoKbps: null, audioKbps: null };

export function useLesson(linkId: string | null, local: MediaStream | null, onData?: (m: DataMsg) => void) {
  const [state, setState] = useState<LessonState>('idle');
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [stats, setStats] = useState<LessonStats>(EMPTY_STATS);
  const wsRef = useRef<Transport | null>(null);
  const [transport, setTransport] = useState<'websocket' | 'polling' | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localRef = useRef<MediaStream | null>(local);
  const onDataRef = useRef(onData);
  const seq = useRef(0);
  const iceRef = useRef<RTCIceServer[]>([]);
  onDataRef.current = onData;
  localRef.current = local;

  const send = (data: unknown) => {
    wsRef.current?.send({ type: 'signal', data });
  };

  const closePc = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setRemote(null);
    setStats(EMPTY_STATS);
  }, []);

  const createPc = useCallback((polite: boolean) => {
    closePc();
    const pc = new RTCPeerConnection({ iceServers: iceRef.current, bundlePolicy: 'max-bundle' });
    pcRef.current = pc;
    let makingOffer = false;
    let ignoreOffer = false;

    const stream = localRef.current;
    stream?.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      // Audio musicale prioritario; il video si adatta per primo quando la banda scarseggia.
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      if (track.kind === 'audio') {
        params.encodings[0]!.maxBitrate = 128_000;
        params.encodings[0]!.priority = 'high';
        params.encodings[0]!.networkPriority = 'high';
      } else {
        params.encodings[0]!.maxBitrate = 1_500_000;
        params.encodings[0]!.priority = 'low';
      }
      sender.setParameters(params).catch(() => {});
    });

    const dc = pc.createDataChannel('midi', { negotiated: true, id: 0, ordered: true });
    dc.onmessage = (e) => {
      try {
        onDataRef.current?.(JSON.parse(e.data as string) as DataMsg);
      } catch {
        /* messaggio non valido: ignorato */
      }
    };
    dcRef.current = dc;

    pc.ontrack = (e) => setRemote(e.streams[0] ?? new MediaStream([e.track]));
    pc.onicecandidate = (e) => e.candidate && send({ candidate: e.candidate });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setState('connected');
      else if (pc.connectionState === 'connecting') setState('connecting');
      else if (pc.connectionState === 'failed') setState('failed');
      else if (pc.connectionState === 'disconnected') setState('reconnecting');
    };
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer = true;
        await pc.setLocalDescription();
        send({ description: pc.localDescription });
      } finally {
        makingOffer = false;
      }
    };
    (pc as RTCPeerConnection & { _handle?: (d: SignalData) => Promise<void> })._handle = async ({ description, candidate }) => {
      if (description) {
        const collision = description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
        ignoreOffer = !polite && collision;
        if (ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          send({ description: pc.localDescription });
        }
      } else if (candidate) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          if (!ignoreOffer) throw err;
        }
      }
    };
    setState('connecting');
    return pc;
  }, [closePc]);

  // Connessione al signaling (dipende solo dalla PRESENZA dello stream locale: un cambio di dispositivo
  // sostituisce le tracce più sotto, senza far ripartire la lezione).
  const hasLocal = !!local;
  useEffect(() => {
    if (!linkId || !hasLocal) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let polite = false;

    const open = async () => {
      try {
        const cfg = await fetch('/api/rtc/config', { credentials: 'same-origin' }).then((r) => r.json());
        iceRef.current = Array.isArray(cfg.iceServers) ? cfg.iceServers : [];
      } catch {
        iceRef.current = [];
      }
      if (stopped) return;
      const t = openSignaling(linkId, {
        onMessage: async (msg: SignalMsg) => {
          setTransport(t.kind);
          if (msg.type === 'joined') {
            polite = msg.role === 'student';
            if (msg.peerPresent) createPc(polite);
            else setState('waiting');
          } else if (msg.type === 'peer-joined') {
            createPc(polite);
          } else if (msg.type === 'peer-left') {
            closePc();
            setState('waiting');
          } else if (msg.type === 'signal' && msg.data) {
            const pc = (pcRef.current ?? createPc(polite)) as RTCPeerConnection & { _handle?: (d: SignalData) => Promise<void> };
            await pc._handle?.(msg.data as SignalData).catch(() => setState('failed'));
          }
        },
        onClose: (code) => {
          if (stopped) return;
          if (code === 4003 || code === 4001) {
            closePc();
            setState('forbidden');
            return;
          }
          if (code === 4000) return; // sostituita da un'altra scheda/dispositivo dello stesso utente
          closePc();
          setState('reconnecting');
          retry = setTimeout(open, 2000);
        },
      });
      wsRef.current = t;
    };
    void open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      wsRef.current?.close();
      wsRef.current = null;
      closePc();
      setState('closed');
    };
  }, [linkId, hasLocal, createPc, closePc]);

  // Statistiche
  useEffect(() => {
    if (state !== 'connected') return;
    let prev: { t: number; v: number; a: number } | null = null;
    const id = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      const report = await pc.getStats();
      let rtt: number | null = null;
      let jitter: number | null = null;
      let lost = 0;
      let recv = 0;
      let vBytes = 0;
      let aBytes = 0;
      let path: LessonStats['path'] = null;
      const byId = new Map<string, RTCStats & Record<string, unknown>>();
      report.forEach((s) => byId.set(s.id, s as RTCStats & Record<string, unknown>));
      report.forEach((s) => {
        const r = s as RTCStats & Record<string, unknown>;
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected)) {
          if (typeof r.currentRoundTripTime === 'number') rtt = r.currentRoundTripTime * 1000;
          const lc = byId.get(r.localCandidateId as string);
          const rc = byId.get(r.remoteCandidateId as string);
          const types = [lc?.candidateType, rc?.candidateType];
          path = types.includes('relay') ? 'relay TURN' : types.every((x) => x === 'host') ? 'diretto (rete locale)' : 'diretto (internet)';
        }
        if (r.type === 'inbound-rtp') {
          if (r.kind === 'audio' && typeof r.jitter === 'number') jitter = r.jitter * 1000;
          lost += Number(r.packetsLost ?? 0);
          recv += Number(r.packetsReceived ?? 0);
          if (r.kind === 'video') vBytes += Number(r.bytesReceived ?? 0);
          if (r.kind === 'audio') aBytes += Number(r.bytesReceived ?? 0);
        }
      });
      const now = performance.now();
      let videoKbps: number | null = null;
      let audioKbps: number | null = null;
      if (prev) {
        const dt = (now - prev.t) / 1000;
        videoKbps = Math.round(((vBytes - prev.v) * 8) / dt / 1000);
        audioKbps = Math.round(((aBytes - prev.a) * 8) / dt / 1000);
      }
      prev = { t: now, v: vBytes, a: aBytes };
      setStats({
        rttMs: rtt === null ? null : Math.round(rtt),
        jitterMs: jitter === null ? null : Math.round((jitter as number) * 10) / 10,
        lossPct: recv + lost > 0 ? Math.round((lost / (recv + lost)) * 1000) / 10 : null,
        path,
        videoKbps,
        audioKbps,
      });
    }, 2000);
    return () => clearInterval(id);
  }, [state]);

  // Cambio di microfono/videocamera durante la lezione: sostituisce le tracce senza rinegoziare.
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !local) return;
    for (const sender of pc.getSenders()) {
      const kind = sender.track?.kind;
      const next = local.getTracks().find((t) => t.kind === kind);
      if (next && sender.track !== next) void sender.replaceTrack(next);
    }
  }, [local]);

  const sendData = useCallback((m: Omit<NoteMsg, 'seq' | 'ts'> | Omit<PedalMsg, 'seq' | 'ts'>) => {
    const dc = dcRef.current;
    if (dc?.readyState !== 'open') return false;
    dc.send(JSON.stringify({ ...m, seq: ++seq.current, ts: Date.now() }));
    return true;
  }, []);

  return { state, remote, stats, sendData, transport };
}

interface SignalData {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
