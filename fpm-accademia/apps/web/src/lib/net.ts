/**
 * Misura di rete verso il server FPM (HTTP, non WebRTC).
 * Indica la qualità della connessione dell'utente, ma NON la latenza audio tra docente e allievo:
 * quella va misurata durante la lezione con le statistiche WebRTC (Fase D).
 */
export interface NetStats {
  samples: number;
  lost: number;
  rttMedianMs: number;
  rttMinMs: number;
  jitterMs: number;
  lossPct: number;
}

/** Jitter come media delle differenze assolute tra RTT consecutivi (stile RFC 3550, semplificato). */
export function computeNetStats(rtts: (number | null)[]): NetStats {
  const ok = rtts.filter((r): r is number => r !== null);
  const lost = rtts.length - ok.length;
  if (ok.length === 0) {
    return { samples: rtts.length, lost, rttMedianMs: NaN, rttMinMs: NaN, jitterMs: NaN, lossPct: 100 };
  }
  const sorted = [...ok].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  let jitter = 0;
  for (let i = 1; i < ok.length; i++) jitter += Math.abs(ok[i]! - ok[i - 1]!);
  jitter = ok.length > 1 ? jitter / (ok.length - 1) : 0;
  return {
    samples: rtts.length,
    lost,
    rttMedianMs: Math.round(median),
    rttMinMs: Math.round(sorted[0]!),
    jitterMs: Math.round(jitter * 10) / 10,
    lossPct: Math.round((lost / rtts.length) * 1000) / 10,
  };
}

export type Verdict = 'ottima' | 'buona' | 'limitata' | 'insufficiente';

export function verdict(s: NetStats): Verdict {
  if (!Number.isFinite(s.rttMedianMs) || s.lossPct > 10) return 'insufficiente';
  if (s.rttMedianMs < 60 && s.jitterMs < 10 && s.lossPct === 0) return 'ottima';
  if (s.rttMedianMs < 120 && s.jitterMs < 25 && s.lossPct <= 2) return 'buona';
  if (s.rttMedianMs < 250 && s.jitterMs < 50) return 'limitata';
  return 'insufficiente';
}

export async function measureServerRtt(count = 12, timeoutMs = 2000): Promise<NetStats> {
  const rtts: (number | null)[] = [];
  for (let i = 0; i < count; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/net/ping?i=${i}&t=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal });
      await res.json();
      rtts.push(res.ok ? performance.now() - t0 : null);
    } catch {
      rtts.push(null);
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return computeNetStats(rtts);
}

/**
 * Tipo di connessione: solo dove il browser lo espone (Network Information API, Chromium Android).
 * Safari/iOS non lo espone: in quel caso chiediamo all'utente. Un hotspot NON è distinguibile in modo affidabile.
 */
export function browserConnectionHint(): string | null {
  const c = (navigator as Navigator & { connection?: { type?: string; effectiveType?: string } }).connection;
  if (!c) return null;
  return [c.type, c.effectiveType].filter(Boolean).join(' / ') || null;
}
