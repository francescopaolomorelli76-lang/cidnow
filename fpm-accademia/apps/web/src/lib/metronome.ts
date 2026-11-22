import { audioContext } from './audio.js';

export const BPM_MIN = 30;
export const BPM_MAX = 240;
export const clampBpm = (bpm: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
export const beatInterval = (bpm: number) => 60 / clampBpm(bpm);

/**
 * Metronomo locale con pianificazione anticipata sull'orologio audio
 * (preciso anche se il thread della pagina è occupato).
 * Nota: è locale a ciascun dispositivo; la sincronizzazione tra docente e allievo arriverà con la Fase E.
 */
export class Metronome {
  bpm = 80;
  beatsPerBar = 4;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private beat = 0;
  onBeat: ((beatIndex: number) => void) | null = null;

  get running() {
    return this.timer !== null;
  }

  start() {
    if (this.timer) return;
    const ac = audioContext();
    this.nextTime = ac.currentTime + 0.08;
    this.beat = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const ac = audioContext();
    while (this.nextTime < ac.currentTime + 0.12) {
      const accent = this.beat % this.beatsPerBar === 0;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = accent ? 1760 : 1175;
      gain.gain.setValueAtTime(0.0001, this.nextTime);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, this.nextTime + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.nextTime + 0.05);
      osc.connect(gain).connect(ac.destination);
      osc.start(this.nextTime);
      osc.stop(this.nextTime + 0.06);
      const idx = this.beat % this.beatsPerBar;
      const delayMs = Math.max(0, (this.nextTime - ac.currentTime) * 1000);
      setTimeout(() => this.onBeat?.(idx), delayMs);
      this.nextTime += beatInterval(this.bpm);
      this.beat++;
    }
  }
}
