/**
 * MIDI: parsing dei messaggi (puro, testato) + accesso Web MIDI con fallback esplicito.
 *
 * Limite noto: Web MIDI è disponibile nei browser basati su Chromium e in Firefox (con permesso),
 * NON in Safari su macOS/iOS/iPadOS (da riverificare a ogni rilascio). Su iPhone/iPad quindi il MIDI
 * fisico non è leggibile dalla web app: fallback = pianoforte virtuale a schermo, oppure futura app nativa
 * (CoreMIDI). Non promettiamo parità MIDI tra piattaforme.
 */
export type MidiEvent =
  | { type: 'noteon'; channel: number; note: number; velocity: number }
  | { type: 'noteoff'; channel: number; note: number; velocity: number }
  | { type: 'sustain'; channel: number; on: boolean; value: number }
  | { type: 'cc'; channel: number; controller: number; value: number };

export function parseMidiMessage(data: ArrayLike<number>): MidiEvent | null {
  if (data.length < 2) return null;
  const status = data[0]!;
  const kind = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  const d1 = data[1]! & 0x7f;
  const d2 = (data[2] ?? 0) & 0x7f;
  switch (kind) {
    case 0x90:
      // Note-on con velocity 0 equivale a note-off (running status comune nelle tastiere).
      return d2 === 0
        ? { type: 'noteoff', channel, note: d1, velocity: 0 }
        : { type: 'noteon', channel, note: d1, velocity: d2 };
    case 0x80:
      return { type: 'noteoff', channel, note: d1, velocity: d2 };
    case 0xb0:
      if (d1 === 64) return { type: 'sustain', channel, on: d2 >= 64, value: d2 };
      return { type: 'cc', channel, controller: d1, value: d2 };
    default:
      return null; // clock, aftertouch, pitch bend, sysex: non gestiti in questa fase
  }
}

const NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
/** Nome della nota in notazione italiana; 60 = Do4 (convenzione Do centrale = C4). */
export function noteName(note: number): string {
  return `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

export function noteFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export type MidiSupport =
  | { supported: true }
  | { supported: false; reason: string };

export function midiSupport(): MidiSupport {
  if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
    return {
      supported: false,
      reason:
        'Questo browser non espone Web MIDI (tipico di Safari su iPhone, iPad e Mac). Usa il pianoforte a schermo, oppure Chrome/Edge su computer.',
    };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: 'Web MIDI richiede una connessione sicura (HTTPS o localhost).' };
  }
  return { supported: true };
}
