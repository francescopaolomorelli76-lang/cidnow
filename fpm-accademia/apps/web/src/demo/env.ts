/** true nella build demo pubblicata online (VITE_DEMO=1): API simulata nel browser. */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';

/** Percorso di un file pubblico (immagini, logo) valido sia in locale sia nella demo pubblicata. */
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

/** Conferma di un'azione. Nella demo online i dialoghi del browser sono bloccati: si procede. */
export function confirmAction(message: string): boolean {
  return IS_DEMO ? true : window.confirm(message);
}
