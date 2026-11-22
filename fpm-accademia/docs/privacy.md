# Privacy by design — note tecniche (NON è una consulenza legale)

Questo documento descrive cosa fa il software. **Non** attesta conformità al GDPR: informativa, termini, basi giuridiche, registro dei trattamenti, DPIA per le registrazioni e gestione dei minori vanno definiti con un consulente privacy/legale prima della pubblicazione.

## Già implementato
- Dati minimi: email, nome visualizzato, ruolo, dichiarazione di maggiore età, hash della password.
- Consensi separati e versionati (`consents`): termini e informativa obbligatori; la tabella prevede già `recording` (registrazioni) e `parental` (genitore) come consensi distinti.
- **Minorenni**: registrazione autonoma bloccata lato server finché non esiste il flusso di consenso del genitore/tutore.
- Esportazione dati in JSON (`GET /api/me/export`) e cancellazione account con conferma password (`POST /api/me/delete`, cancellazione a cascata).
- Preferenze dispositivo: al server solo etichette e scelte; gli identificativi dei dispositivi restano nel browser; la "chiave dispositivo" è casuale e azzerabile.
- Nessuna password Wi-Fi raccolta; nessun font/CDN di terze parti; log senza IP, cookie, email o corpo delle richieste.

## Da decidere con il consulente
- Basi giuridiche e tempi di conservazione (account inattivi, lezioni, sessioni scadute).
- Ruoli titolare/responsabile tra piattaforma e docente (il docente tratta dati dei propri allievi).
- Consenso genitoriale: modalità di verifica e soglia d'età (in Italia 14 anni per i servizi della società dell'informazione, art. 2-quinquies Codice privacy — da confermare).
- Registrazioni audio/video: consenso specifico di entrambe le parti, conservazione, accesso.
- Conservazione delle ricevute di acquisto (obblighi fiscali) in caso di cancellazione account.
- Trasferimenti extra-UE (hosting, TURN, store) e nomine dei fornitori.
