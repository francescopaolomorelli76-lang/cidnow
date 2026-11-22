/**
 * Registro esplicito dello stato di ogni funzionalità.
 * implemented = codice presente e testato in automatico in locale
 * verified    = verificato anche su hardware/reti reali (nessuna finora)
 * mock        = sostituto dichiarato, non funzionalità reale
 * planned     = non ancora sviluppato
 * blocked     = serve intervento esterno (credenziali, account store, legale)
 */
export type FeatureState = 'implemented' | 'mock' | 'planned' | 'blocked' | 'verified';

export interface FeatureEntry {
  id: string;
  label: string;
  phase: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  state: FeatureState;
  note: string;
}

export const FEATURES: readonly FeatureEntry[] = [
  { id: 'brand', label: 'Identità nero/oro con logo originale', phase: 'A', state: 'implemented', note: 'Logo oro derivato dal PNG originale (forma invariata).' },
  { id: 'discipline-select', label: 'Selezione disciplina', phase: 'A', state: 'implemented', note: 'Cambia strumenti e copertina, non la palette.' },
  { id: 'info', label: 'Schermata Informazioni', phase: 'A', state: 'implemented', note: '' },
  { id: 'auth', label: 'Registrazione e accesso sicuri', phase: 'B', state: 'implemented', note: 'scrypt + sessione in cookie httpOnly; rate limit. Manca verifica email e recupero password.' },
  { id: 'invites', label: 'Inviti docente→allievo con scadenza e revoca', phase: 'B', state: 'implemented', note: 'Testato con PostgreSQL locale.' },
  { id: 'approval', label: 'Approvazione docente e isolamento tra docenti', phase: 'B', state: 'implemented', note: 'Autorizzazione lato server, test di isolamento.' },
  { id: 'lessons', label: 'Calendario lezioni (base)', phase: 'B', state: 'implemented', note: 'Creazione e lettura protette; nessuna videolezione ancora.' },
  { id: 'minors', label: 'Consenso genitoriale per minori', phase: 'B', state: 'planned', note: 'Il flag è registrato; il flusso di consenso del genitore richiede parere legale.' },
  { id: 'gdpr-export', label: 'Esportazione e cancellazione dati', phase: 'B', state: 'implemented', note: 'Endpoint base; da rivedere con consulente privacy.' },
  { id: 'smart-setup', label: 'Smart Setup dispositivi (demo)', phase: 'C', state: 'implemented', note: 'Selezione reale microfono/camera/MIDI nel browser; non verificato su iOS/Android reali.' },
  { id: 'network-test', label: 'Test rete (RTT/jitter verso il server)', phase: 'C', state: 'implemented', note: 'Misura solo verso il server API, non la qualità WebRTC tra i due utenti.' },
  { id: 'lesson-room-ui', label: 'Stanza lezione per disciplina', phase: 'D', state: 'implemented', note: 'Videocamera/microfono, controlli, pannelli strumenti.' },
  { id: 'tuner', label: 'Accordatore e intonazione dal microfono', phase: 'F', state: 'implemented', note: 'Rilevamento monofonico (YIN semplificato), testato con segnali sintetici; da provare con strumenti reali.' },
  { id: 'metronome', label: 'Metronomo locale', phase: 'F', state: 'implemented', note: 'Locale a ciascun dispositivo; non sincronizzato tra docente e allievo.' },
  { id: 'breathing', label: 'Esercizi di respirazione guidati', phase: 'F', state: 'implemented', note: '' },
  { id: 'sheet-music', label: 'Spartiti condivisi', phase: 'F', state: 'planned', note: 'Oggi si può aprire un PDF/immagine solo sul proprio dispositivo.' },
  { id: 'webrtc-lesson', label: 'Videolezione WebRTC docente↔allievo', phase: 'D', state: 'implemented', note: 'Testata tra due browser Chromium (stessa macchina). Sulla stessa rete Wi-Fi non serve TURN; tra reti diverse serve un server TURN (non incluso). Da verificare su Mac + iPad reali.' },
  { id: 'signaling', label: 'Signaling autenticato (WebSocket + riserva HTTP)', phase: 'D', state: 'implemented', note: 'Solo collegamenti approvati; la revoca chiude la lezione.' },
  { id: 'midi-remote', label: 'Pianoforte condiviso (eventi MIDI in diretta)', phase: 'D', state: 'implemented', note: 'Note e dinamica via canale dati; sustain dal MIDI fisico pianificato in lezione. Safari/iPad: solo pianoforte a schermo.' },
  { id: 'lesson-stats', label: 'Misura ritardo, jitter, perdita durante la lezione', phase: 'D', state: 'implemented', note: 'Da statistiche WebRTC reali.' },
  { id: 'mac-ipad', label: 'Pacchetto Mac + link per iPad (stessa rete)', phase: 'D', state: 'implemented', note: 'Server locale con database integrato (PGlite) e HTTPS autofirmato. Non firmato Apple: richiede conferma di apertura.' },
  { id: 'synced-backing', label: 'Basi sincronizzate', phase: 'E', state: 'planned', note: '' },
  { id: 'drums-multicam', label: 'Multicamera batteria (1–4 per lato)', phase: 'G', state: 'planned', note: 'Solo batteria. Nessuna UI che la presenti come disponibile.' },
  { id: 'trial', label: 'Prova docente 24 h (server-side)', phase: 'H', state: 'implemented', note: 'Calcolata con orologio del database, non del client.' },
  { id: 'license', label: 'Licenza permanente €99,90', phase: 'H', state: 'mock', note: 'PaymentProvider mock solo in sviluppo; acquisti reali bloccati fino a account store/Stripe.' },
  { id: 'store-billing', label: 'Acquisti in-app Apple/Google', phase: 'H', state: 'blocked', note: 'Servono account sviluppatore e verifica delle policy vigenti.' },
];
