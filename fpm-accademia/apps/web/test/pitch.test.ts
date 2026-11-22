import { describe, expect, it } from 'vitest';
import { detectPitch, frequencyToNote } from '../src/lib/pitch.js';
import { beatInterval, clampBpm } from '../src/lib/metronome.js';

const SR = 48000;
function tone(freq: number, n = 2048, harmonics = false): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    b[i] = 0.5 * Math.sin(2 * Math.PI * freq * t) + (harmonics ? 0.3 * Math.sin(2 * Math.PI * 2 * freq * t) + 0.15 * Math.sin(2 * Math.PI * 3 * freq * t) : 0);
  }
  return b;
}

describe('pitch detection', () => {
  for (const f of [110, 196, 261.63, 440, 659.25, 987.77]) {
    it(`detects ${f} Hz within 3 cents`, () => {
      const r = detectPitch(tone(f, 4096), SR)!;
      expect(r).not.toBeNull();
      expect(Math.abs(1200 * Math.log2(r.frequency / f))).toBeLessThan(3);
    });
  }
  it('works with harmonics (instrument-like timbre), no octave error', () => {
    const r = detectPitch(tone(196, 4096, true), SR)!;
    expect(frequencyToNote(r.frequency).nameIt).toBe('Sol3');
  });
  it('returns null on silence', () => {
    expect(detectPitch(new Float32Array(2048), SR)).toBeNull();
  });
});

describe('frequency → note', () => {
  it('A4 = La4, 0 cents', () => {
    expect(frequencyToNote(440)).toMatchObject({ nameIt: 'La4', nameEn: 'A4', cents: 0, midi: 69 });
  });
  it('slightly sharp', () => {
    expect(frequencyToNote(445).cents).toBe(20);
  });
  it('middle C', () => {
    expect(frequencyToNote(261.63).nameIt).toBe('Do4');
  });
});

describe('metronome math', () => {
  it('interval and clamping', () => {
    expect(beatInterval(120)).toBe(0.5);
    expect(clampBpm(5)).toBe(30);
    expect(clampBpm(999)).toBe(240);
  });
});
