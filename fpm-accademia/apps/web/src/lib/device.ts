/**
 * Chiave locale casuale che identifica "questo browser su questo dispositivo" per le preferenze.
 * NON è un identificatore hardware: si azzera cancellando i dati del sito.
 */
const KEY = 'fpm.deviceKey';

export function deviceKey(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[a-zA-Z0-9_-]{16,64}$/.test(existing)) return existing;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const k = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY, k);
    return k;
  } catch {
    // Navigazione privata o storage bloccato: chiave valida solo per questa sessione.
    return `session${Math.random().toString(36).slice(2, 14).padEnd(12, '0')}`;
  }
}

/** Preferenze locali (deviceId del browser: restano sul dispositivo, non vanno al server). */
const LOCAL_PREFS = 'fpm.localDevicePrefs';
export interface LocalDevicePrefs {
  audioInputId?: string;
  audioOutputId?: string;
  videoInputId?: string;
  midiInputId?: string;
}
export function loadLocalPrefs(): LocalDevicePrefs {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PREFS) ?? '{}') as LocalDevicePrefs;
  } catch {
    return {};
  }
}
export function saveLocalPrefs(p: LocalDevicePrefs) {
  try {
    localStorage.setItem(LOCAL_PREFS, JSON.stringify(p));
  } catch {
    /* storage non disponibile: le scelte valgono solo per questa sessione */
  }
}

/** Indica se il nome del dispositivo suggerisce Bluetooth (euristica: solo per avvisare della latenza). */
export function looksBluetooth(label: string): boolean {
  return /bluetooth|airpods|buds|bt\b|hands-free|headset/i.test(label);
}

/** Traduce gli errori di getUserMedia in messaggi comprensibili. */
export function mediaErrorMessage(err: unknown): string {
  if (import.meta.env.VITE_DEMO === '1') {
    return 'Nella demo online videocamera e microfono non sono disponibili (limite della pagina di anteprima). Funzionano nell’app vera.';
  }
  const name = (err as { name?: string })?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permesso negato. Consenti microfono/fotocamera dalle impostazioni del browser (icona accanto all’indirizzo) e riprova.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nessun dispositivo trovato. Collega microfono o fotocamera e premi “Aggiorna elenco”.';
    case 'NotReadableError':
      return 'Il dispositivo è usato da un’altra applicazione (es. Zoom, FaceTime). Chiudila e riprova.';
    default:
      return 'Impossibile accedere al dispositivo in questo browser.';
  }
}
