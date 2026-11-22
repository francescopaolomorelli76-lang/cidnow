# FPM — Accademia Musicale Online

Web app responsive/PWA per lezioni di musica dal vivo: un docente e i suoi allievi, collegati in modo privato tramite invito e approvazione. Identità unica nero profondo + oro, logo FPM originale.

> Versione 0.1.0 — **anteprima di sviluppo**. Fasi A e B complete, Smart Setup (Fase C) dimostrativo. Videolezione, MIDI remoto, basi sincronizzate e multicamera batteria **non ancora realizzati**. Stato dettagliato: pagina *Informazioni* dell'app e `docs/roadmap.md`.

## Requisiti
- Node.js ≥ 22.12 e npm
- PostgreSQL 14+ in locale

## Primo avvio (comandi esatti)

```bash
cd fpm-accademia
npm install

# Database (una volta sola; adatta utente/password se diversi)
sudo -u postgres psql -c "CREATE ROLE fpm LOGIN PASSWORD 'fpm_dev_only' CREATEDB;"
sudo -u postgres createdb -O fpm fpm_dev
sudo -u postgres createdb -O fpm fpm_test
sudo -u postgres createdb -O fpm fpm_e2e

cp .env.example .env        # nessun segreto reale nel file d'esempio
npm run db:seed             # crea migrazioni + utenti demo
npm run dev                 # API su :8787, app su http://localhost:5173
```

Utenti demo: `docente@demo.local` e `allievo@demo.local`, password `demo-password-123`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Migrazioni + API (Fastify) + frontend (Vite) con proxy `/api` |
| `npm run db:migrate` | Applica le migrazioni SQL |
| `npm run db:seed` | Utenti demo (vietato in produzione) |
| `npm run typecheck` | TypeScript strict su tutti i pacchetti |
| `npm run lint` | ESLint |
| `npm test` | Test unitari e di integrazione (API contro PostgreSQL `fpm_test`, ricreato a ogni esecuzione) |
| `npm run test:e2e` | Playwright: due ruoli in due browser, desktop + mobile (Pixel 7), su DB `fpm_e2e` |
| `npm run check` | typecheck + lint + test |
| `npm run build` | Build di produzione del frontend in `apps/web/dist` |

## Risultati ottenuti (22/11/2026, in questo ambiente Linux con Chromium headless)

- `npm run typecheck` ✅ · `npm run lint` ✅ · `npm run build` ✅
- `npm test` ✅ **49 test**: shared 6, server 33 (PostgreSQL 16 reale), web 10
- `npm run test:e2e` ✅ **10 test** (5 scenari × desktop e mobile): home, percorso invito→richiesta→approvazione→lezione→revoca tra due browser, Smart Setup con microfono/camera **finti** di Chromium, Informazioni, redirect/401 per anonimi
- Screenshot in `docs/screenshots/`

**Non verificato**: nessuna prova su iPhone/iPad/Android reali, interfacce audio o tastiere MIDI fisiche, né su reti reali diverse. Nessun test WAN.

## Cosa c'è

- **Brand**: `brand/logo-fpm-original.png` (originale, intatto) e versione oro derivata con `scripts/derive_gold_logo.py` (stessa sagoma pixel per pixel, cambia solo il colore). Footer «© 2026 FP Morelli — Web Design Tech» su ogni schermata.
- **Ruoli e accesso**: registrazione/login (scrypt, cookie httpOnly, rate limit), autorizzazione **lato server** su ogni API.
- **Inviti**: codice casuale `XXXXX-XXXXX` mostrato una sola volta, salvato come hash; scadenza, monouso o multiuso, revoca; il docente approva o rifiuta; l'allievo vede solo il proprio docente e le lezioni autorizzate; revoca immediata; isolamento tra docenti testato.
- **Discipline**: canto, pianoforte/tastiere, chitarra/basso, batteria/percussioni, archi, fiati, teoria — cambiano strumenti didattici e copertina, mai i colori. Multicamera indicata solo per la batteria e marcata *pianificata*.
- **Smart Setup** (per ruolo): microfono con misuratore di livello e "modalità musica", uscita/cuffie con tono sinistra/destra, anteprima videocamera, Web MIDI con note/velocity/sustain e pianoforte virtuale, guida connessione (Ethernet, Wi-Fi, SIM, hotspot — senza password) e misura RTT/jitter/perdita verso il server, salvataggio per dispositivo.
- **Prova e licenza**: prova docente 24 h server-side (1 allievo, 1 invito), licenza permanente €99,90 tramite `PaymentProvider` **mock** (solo sviluppo, disattivato in produzione), ripristino.
- **Privacy**: export JSON, cancellazione account, minorenni bloccati finché manca il consenso genitoriale. Vedi `docs/privacy.md`.

## Cosa manca (prossimi passi)

1. **Fase D** — videolezione WebRTC + signaling + MIDI remoto. Serve un **server TURN** (o servizio gestito) con credenziali.
2. Verifica email e recupero password (serve un servizio di invio email).
3. Prove manuali su dispositivi reali (iPhone Safari, Android Chrome, iPad, Mac/Windows con interfaccia audio e tastiera MIDI).
4. Pagamenti reali: account Apple/Google (e Stripe per il web), verifica regole store.
5. Informativa, termini e flusso minori con consulente legale.
6. Service worker per uso offline della PWA (oggi c'è solo il manifest).

## Struttura

```
fpm-accademia/
├─ apps/server     API Fastify + migrazioni SQL + test di integrazione
├─ apps/web        React + Vite (PWA)
├─ packages/shared discipline, schemi zod, brand, registro stato funzioni
├─ e2e/            test Playwright dei due ruoli
├─ brand/          logo originale + versioni oro + icone
├─ docs/           architecture.md, roadmap.md, privacy.md, reference/ (specifiche), screenshots/
└─ scripts/        derive_gold_logo.py
```
