import { noteFrequency } from './midi.js';

let ctx: AudioContext | null = null;

/** AudioContext condiviso, creato solo dopo un gesto dell'utente (requisito dei browser). */
export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/**
 * Sintetizzatore locale semplice per il pianoforte virtuale (placeholder dichiarato:
 * non è un campione di pianoforte reale; un pianoforte campionato con licenza libera è previsto in Fase D).
 */
export class SimpleSynth {
  private voices = new Map<number, { osc: OscillatorNode; gain: GainNode }>();
  private sustain = false;
  private held = new Set<number>();

  noteOn(note: number, velocity = 100) {
    const ac = audioContext();
    this.stopVoice(note, 0.01);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = noteFrequency(note);
    const peak = 0.05 + (velocity / 127) * 0.25;
    const t = ac.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, t + 1.2);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    this.voices.set(note, { osc, gain });
    this.held.delete(note);
  }

  noteOff(note: number) {
    if (this.sustain) {
      this.held.add(note);
      return;
    }
    this.stopVoice(note, 0.25);
  }

  setSustain(on: boolean) {
    this.sustain = on;
    if (!on) {
      for (const n of this.held) this.stopVoice(n, 0.3);
      this.held.clear();
    }
  }

  private stopVoice(note: number, release: number) {
    const v = this.voices.get(note);
    if (!v || !ctx) return;
    const t = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), t);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + release);
    v.osc.stop(t + release + 0.02);
    this.voices.delete(note);
  }
}

/** Tono di prova sul canale sinistro o destro, per verificare cuffie e stereo. */
export function playTestTone(side: 'left' | 'right' | 'both', sinkId?: string) {
  const ac = audioContext();
  if (sinkId && 'setSinkId' in ac) {
    void (ac as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(sinkId).catch(() => {});
  }
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const pan = ac.createStereoPanner();
  osc.frequency.value = 523.25;
  pan.pan.value = side === 'left' ? -1 : side === 'right' ? 1 : 0;
  const t = ac.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
  gain.gain.setValueAtTime(0.18, t + 0.6);
  gain.gain.linearRampToValueAtTime(0, t + 0.7);
  osc.connect(gain).connect(pan).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.75);
}

/** Livello RMS (0..1) da un AnalyserNode, per il misuratore del microfono. */
export function rmsLevel(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
  return Math.sqrt(sum / buf.length);
}
