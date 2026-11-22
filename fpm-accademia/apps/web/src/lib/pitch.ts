/**
 * Rilevamento dell'altezza (pitch) monofonico dal microfono — accordatore e intonazione.
 * Algoritmo: autocorrelazione normalizzata (stile YIN semplificato) con interpolazione parabolica.
 * Adatto a voce e strumenti monofonici; non adatto ad accordi o batteria.
 */
export interface PitchResult {
  frequency: number;
  clarity: number; // 0..1, affidabilità del rilevamento
}

export function detectPitch(buf: Float32Array, sampleRate: number, minHz = 60, maxHz = 1600): PitchResult | null {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i]! * buf[i]!;
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return null; // silenzio

  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(n / 2));
  // Differenza cumulativa normalizzata (YIN, passi 2–3)
  const d = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - maxLag; i++) {
      const diff = buf[i]! - buf[i + lag]!;
      sum += diff * diff;
    }
    d[lag] = sum;
  }
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag]!;
    cmnd[lag] = running === 0 ? 1 : (d[lag]! * lag) / running;
  }
  // Primo minimo sotto soglia
  const threshold = 0.15;
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (cmnd[lag]! < threshold) {
      while (lag + 1 <= maxLag && cmnd[lag + 1]! < cmnd[lag]!) lag++;
      best = lag;
      break;
    }
  }
  if (best < 0) return null;
  // Interpolazione parabolica per precisione sub-campione
  const x0 = best > 1 ? cmnd[best - 1]! : cmnd[best]!;
  const x2 = best < maxLag ? cmnd[best + 1]! : cmnd[best]!;
  const denom = x0 + x2 - 2 * cmnd[best]!;
  const shift = denom !== 0 ? (x0 - x2) / (2 * denom) : 0;
  const period = best + shift;
  return { frequency: sampleRate / period, clarity: Math.max(0, Math.min(1, 1 - cmnd[best]!)) };
}

const NAMES_IT = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface NoteReading {
  midi: number;
  nameIt: string;
  nameEn: string;
  cents: number; // scostamento dalla nota temperata più vicina, -50..+50
  targetHz: number;
}

export function frequencyToNote(freq: number, a4 = 440): NoteReading {
  const exact = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(exact);
  const octave = Math.floor(midi / 12) - 1;
  return {
    midi,
    nameIt: `${NAMES_IT[((midi % 12) + 12) % 12]}${octave}`,
    nameEn: `${NAMES_EN[((midi % 12) + 12) % 12]}${octave}`,
    cents: Math.round((exact - midi) * 100),
    targetHz: a4 * 2 ** ((midi - 69) / 12),
  };
}
