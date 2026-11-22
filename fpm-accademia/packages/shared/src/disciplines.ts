/**
 * Catalogo discipline. La disciplina cambia strumenti didattici e copertina,
 * MAI la palette o il brand (nero profondo + oro per tutte).
 */
export const DISCIPLINE_IDS = [
  'canto',
  'pianoforte',
  'chitarra-basso',
  'batteria',
  'archi',
  'fiati',
  'teoria',
] as const;

export type DisciplineId = (typeof DISCIPLINE_IDS)[number];

export type VideoMode =
  /** Videocamera standard singola (tutte le discipline tranne batteria). */
  | { kind: 'single-camera' }
  /** Multicamera specializzata: SOLO batteria, 1–4 sorgenti facoltative per lato. */
  | { kind: 'drums-multicam'; maxCamerasPerSide: 4; views: readonly string[] };

export type TeachingTool =
  | 'spartiti'
  | 'esercizi'
  | 'metronomo'
  | 'note'
  | 'calendario'
  | 'pianoforte-midi'
  | 'basi-sincronizzate'
  | 'vocalizzi'
  | 'intonazione'
  | 'accordatore'
  | 'accordi-tablature'
  | 'pattern-ritmici'
  | 'respirazione'
  | 'armonia';

export interface Discipline {
  id: DisciplineId;
  label: string;
  tagline: string;
  instruments: readonly string[];
  tools: readonly TeachingTool[];
  video: VideoMode;
  midiRelevant: boolean;
}

export const COMMON_TOOLS: readonly TeachingTool[] = [
  'spartiti',
  'esercizi',
  'metronomo',
  'note',
  'calendario',
];

const single: VideoMode = { kind: 'single-camera' };

export const DISCIPLINES: readonly Discipline[] = [
  {
    id: 'canto',
    label: 'Canto',
    tagline: 'Lirico, pop e musical: tecnica vocale, intonazione, interpretazione',
    instruments: ['Voce'],
    tools: [...COMMON_TOOLS, 'pianoforte-midi', 'basi-sincronizzate', 'vocalizzi', 'intonazione', 'respirazione'],
    video: single,
    midiRelevant: true,
  },
  {
    id: 'pianoforte',
    label: 'Pianoforte e tastiere',
    tagline: 'Tecnica, lettura, accordi e repertorio',
    instruments: ['Pianoforte', 'Tastiere', 'Organo'],
    tools: [...COMMON_TOOLS, 'pianoforte-midi', 'basi-sincronizzate', 'armonia'],
    video: single,
    midiRelevant: true,
  },
  {
    id: 'chitarra-basso',
    label: 'Chitarra e basso',
    tagline: 'Accordi, tablature, ritmica e solismo',
    instruments: ['Chitarra classica', 'Chitarra acustica', 'Chitarra elettrica', 'Basso elettrico'],
    tools: [...COMMON_TOOLS, 'accordatore', 'accordi-tablature', 'basi-sincronizzate'],
    video: single,
    midiRelevant: false,
  },
  {
    id: 'batteria',
    label: 'Batteria e percussioni',
    tagline: 'Groove, coordinazione, rudimenti e lettura ritmica',
    instruments: ['Batteria', 'Percussioni'],
    tools: [...COMMON_TOOLS, 'pattern-ritmici', 'basi-sincronizzate'],
    video: {
      kind: 'drums-multicam',
      maxCamerasPerSide: 4,
      views: ['Vista completa', 'Postura', 'Mani e bacchette', 'Piedi e pedali'],
    },
    midiRelevant: true,
  },
  {
    id: 'archi',
    label: 'Archi',
    tagline: 'Violino, viola, violoncello, contrabbasso: postura e intonazione',
    instruments: ['Violino', 'Viola', 'Violoncello', 'Contrabbasso'],
    tools: [...COMMON_TOOLS, 'accordatore', 'intonazione', 'basi-sincronizzate'],
    video: single,
    midiRelevant: false,
  },
  {
    id: 'fiati',
    label: 'Fiati',
    tagline: 'Flauto traverso, clarinetto, sax, ottoni: respirazione e suono',
    instruments: ['Flauto traverso', 'Clarinetto', 'Oboe', 'Fagotto', 'Sax', 'Tromba', 'Trombone'],
    tools: [...COMMON_TOOLS, 'accordatore', 'intonazione', 'respirazione', 'basi-sincronizzate'],
    video: single,
    midiRelevant: false,
  },
  {
    id: 'teoria',
    label: 'Teoria e composizione',
    tagline: 'Armonia, solfeggio, analisi e scrittura',
    instruments: ['Teoria', 'Armonia', 'Composizione'],
    tools: [...COMMON_TOOLS, 'pianoforte-midi', 'armonia'],
    video: single,
    midiRelevant: true,
  },
];

export function getDiscipline(id: string): Discipline | undefined {
  return DISCIPLINES.find((d) => d.id === id);
}

export function isDisciplineId(id: string): id is DisciplineId {
  return (DISCIPLINE_IDS as readonly string[]).includes(id);
}

export const TOOL_LABELS: Record<TeachingTool, string> = {
  spartiti: 'Spartiti',
  esercizi: 'Esercizi',
  metronomo: 'Metronomo',
  note: 'Note',
  calendario: 'Calendario',
  'pianoforte-midi': 'Pianoforte MIDI',
  'basi-sincronizzate': 'Basi sincronizzate',
  vocalizzi: 'Vocalizzi',
  intonazione: 'Intonazione',
  accordatore: 'Accordatore',
  'accordi-tablature': 'Accordi e tablature',
  'pattern-ritmici': 'Pattern ritmici',
  respirazione: 'Respirazione',
  armonia: 'Armonia',
};
