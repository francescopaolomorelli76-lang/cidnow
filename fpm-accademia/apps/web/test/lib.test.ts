import { describe, expect, it } from 'vitest';
import { noteFrequency, noteName, parseMidiMessage } from '../src/lib/midi.js';
import { computeNetStats, verdict } from '../src/lib/net.js';
import { looksBluetooth } from '../src/lib/device.js';

describe('MIDI parsing', () => {
  it('note-on with velocity, on channel 1', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({ type: 'noteon', channel: 1, note: 60, velocity: 100 });
  });
  it('note-on with velocity 0 is a note-off', () => {
    expect(parseMidiMessage([0x91, 64, 0])).toEqual({ type: 'noteoff', channel: 2, note: 64, velocity: 0 });
  });
  it('explicit note-off', () => {
    expect(parseMidiMessage([0x80, 60, 40])).toMatchObject({ type: 'noteoff', note: 60 });
  });
  it('sustain pedal CC64 threshold at 64', () => {
    expect(parseMidiMessage([0xb0, 64, 127])).toMatchObject({ type: 'sustain', on: true });
    expect(parseMidiMessage([0xb0, 64, 63])).toMatchObject({ type: 'sustain', on: false });
  });
  it('other CC and unsupported messages', () => {
    expect(parseMidiMessage([0xb0, 7, 90])).toMatchObject({ type: 'cc', controller: 7, value: 90 });
    expect(parseMidiMessage([0xf8])).toBeNull();
    expect(parseMidiMessage([0xe0, 0, 64])).toBeNull();
  });
  it('note names and frequency', () => {
    expect(noteName(60)).toBe('Do4');
    expect(noteName(69)).toBe('La4');
    expect(noteFrequency(69)).toBe(440);
  });
});

describe('network stats', () => {
  it('median, jitter, loss', () => {
    const s = computeNetStats([40, 50, null, 60, 50]);
    expect(s.rttMedianMs).toBe(50);
    expect(s.jitterMs).toBe(10);
    expect(s.lost).toBe(1);
    expect(s.lossPct).toBe(20);
    expect(verdict(s)).toBe('insufficiente');
  });
  it('good connection verdict', () => {
    expect(verdict(computeNetStats([30, 32, 31, 33]))).toBe('ottima');
    expect(verdict(computeNetStats([90, 100, 95, 105]))).toBe('buona');
  });
  it('all lost', () => {
    expect(verdict(computeNetStats([null, null]))).toBe('insufficiente');
  });
});

describe('bluetooth heuristic', () => {
  it('flags typical BT names only', () => {
    expect(looksBluetooth('AirPods Pro')).toBe(true);
    expect(looksBluetooth('Focusrite Scarlett 2i2 USB')).toBe(false);
  });
});
