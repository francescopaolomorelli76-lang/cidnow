import { describe, expect, it } from 'vitest';
import { DISCIPLINES, InviteCodeSchema, getDiscipline, FEATURES } from '../src/index.js';

describe('disciplines', () => {
  it('only drums has multicamera, max 4 per side', () => {
    const multi = DISCIPLINES.filter((d) => d.video.kind === 'drums-multicam');
    expect(multi.map((d) => d.id)).toEqual(['batteria']);
    const v = getDiscipline('batteria')!.video;
    expect(v.kind === 'drums-multicam' && v.maxCamerasPerSide).toBe(4);
  });
  it('every discipline includes the common tools', () => {
    for (const d of DISCIPLINES) {
      for (const t of ['spartiti', 'esercizi', 'metronomo', 'note', 'calendario']) {
        expect(d.tools).toContain(t);
      }
    }
  });
});

describe('invite code schema', () => {
  it('normalises case, spaces and dashes', () => {
    expect(InviteCodeSchema.parse(' abcde-12345 ')).toBe('ABCDE12345');
  });
  it('rejects ambiguous letters and wrong length', () => {
    expect(InviteCodeSchema.safeParse('ABCDE1234I').success).toBe(false);
    expect(InviteCodeSchema.safeParse('ABC').success).toBe(false);
  });
});

describe('feature registry', () => {
  it('nothing is claimed verified without real-device tests', () => {
    expect(FEATURES.filter((f) => f.state === 'verified')).toEqual([]);
  });
  it('multicam is not presented as available', () => {
    expect(FEATURES.find((f) => f.id === 'drums-multicam')!.state).not.toBe('implemented');
  });
});
