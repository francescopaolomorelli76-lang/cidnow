import { noteName } from '../lib/midi.js';

const BLACK = new Set([1, 3, 6, 8, 10]);

interface Props {
  from?: number;
  to?: number;
  active: ReadonlySet<number>;
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
}

/** Tastiera a schermo: suona localmente e mostra i tasti premuti (anche quelli arrivati via MIDI). */
export function VirtualPiano({ from = 48, to = 72, active, onNoteOn, onNoteOff }: Props) {
  const whites: number[] = [];
  const blacks: { note: number; leftIndex: number }[] = [];
  for (let n = from; n <= to; n++) {
    if (BLACK.has(n % 12)) blacks.push({ note: n, leftIndex: whites.length });
    else whites.push(n);
  }
  const keyProps = (note: number) => ({
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': noteName(note),
    'aria-pressed': active.has(note),
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onNoteOn(note, 96);
    },
    onPointerUp: () => onNoteOff(note),
    onPointerCancel: () => onNoteOff(note),
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        onNoteOn(note, 96);
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') onNoteOff(note);
    },
  });
  return (
    <div className="piano" aria-label="Pianoforte virtuale">
      {whites.map((n) => (
        <div key={n} className={`white${active.has(n) ? ' on' : ''}`} {...keyProps(n)}>
          {n % 12 === 0 && <span className="label">{noteName(n)}</span>}
        </div>
      ))}
      {blacks.map(({ note, leftIndex }) => (
        <div
          key={note}
          className={`black${active.has(note) ? ' on' : ''}`}
          style={{ left: leftIndex * 40 - 13 }}
          {...keyProps(note)}
        />
      ))}
    </div>
  );
}
