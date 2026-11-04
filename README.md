# CIDnow — Constatazione Amichevole di Incidente digitale

Versione 0.2 (prima funzione: compilazione completa del CID dal luogo dell'incidente).

## Cosa fa
1. **Profilo (Veicolo A)**: dati conducente, patente, veicolo e assicurazione salvati sul telefono. Compilabili da foto dei documenti (AI) o a mano.
2. **Luogo**: GPS → via, civico, CAP, comune, provincia, tipo di luogo (parcheggio, rotatoria). Senza GPS l'app avvisa che molte funzioni non sono disponibili e chiede l'inserimento manuale. Data e ora automatiche.
3. **Foto guidate**: scena, danni A, danni B, targa B, documenti B, extra. Con le zone d'urto toccate sul disegno dell'auto l'app stima il tipo di incidente (tamponamento, urto laterale, frontale, strisciamento, retromarcia, veicolo fermo) e pre-seleziona le 17 circostanze. Con l'analisi AI attiva legge anche targa e documenti.
4. **Veicolo B**: scambio dati tra telefoni via QR (funziona tra iPhone e Android), lettura AI dei documenti di B, o inserimento manuale.
5. **Dinamica**: circostanze 1–17 per A e B, punto d'urto, danni visibili, grafico (schizzo automatico + disegno a mano), osservazioni.
6. **REC**: ciascun conducente (in particolare chi ha tamponato) registra la propria versione dei fatti; trascrizione vocale automatica dove supportata. Allegata al PDF come dichiarazione unilaterale.
7. **Firme**: entrambi firmano col dito sul telefono.
8. **CID PDF**: modulo completo (caselle 1–15) + allegati (foto, GPS, dichiarazioni REC) + impronta SHA-256. Archivio dei CID firmati.

## Novità 0.2
- **Privacy all'avvio**: informativa (artt. 13–14 GDPR) e consensi (obbligatori: termini, informativa; facoltativi: GPS, fotocamera, microfono, analisi AI). Si ripresenta se cambia la versione dell'informativa; modificabili da «Privacy e consensi».
- **Compilazione automatica dei campi**: suggerimenti dei comuni italiani (archivio ISTAT, 7.904 comuni + comuni soppressi e Stati esteri per la nascita), CAP → comune e provincia, comune → CAP e provincia, iniziali maiuscole, compagnie assicurative, marche e categorie patente. Per il proprietario i campi usano l'autocompilazione del telefono (nome, residenza, telefono, email) e, su Android, la rubrica.
- **Codice fiscale calcolato** da cognome, nome, sesso, data e luogo di nascita, con verifica del carattere di controllo e avviso se un codice inserito a mano non corrisponde (omocodia).
- **REC**: registrazione audio + trascrizione in tempo reale (browser: Web Speech API; app: plugin nativo `@capacitor-community/speech-recognition`).
- **GPS**: plugin nativo `@capacitor/geolocation` nell'app installata.
- **Icona** con ali d'angelo: `assets/icon.svg`, `assets/icon-1024.png`, `assets/icon-store-1024.png` (quadrata, senza trasparenza, per App Store e Play Store).

## Novità 0.4
- **PDF = modulo CAI ufficiale** (`assets/modulo-cai.pdf`) compilato in automatico in ogni casella: data, luogo, feriti, danni, testimoni, contraenti, veicoli, assicurazioni, conducenti, circostanze con le X e il loro numero, frecce del punto d'urto sulle sagome, danni visibili, grafico, osservazioni, firme; targhe anche nel foglio «Altre informazioni». In coda: foto, dati GPS e dichiarazioni REC.
- **Modifica dopo la firma**: dal CID firmato si va avanti e indietro tra i passi (anche toccando la barra in alto). Ogni modifica viene segnata con data e ora nel PDF finché entrambi non rifirmano.
- **Vie della città**: scegliendo il comune, la via si completa con i suggerimenti di OpenStreetMap (servizio Photon, serve la rete) e il CAP esatto si inserisce da solo.
- **Lettura documenti sul telefono** (Tesseract, senza server e senza inviare foto): patente (campi 1, 2, 3, 4b, 5, 9), codice fiscale, targa, polizza. Il codice fiscale si calcola dai dati letti.

## Novità 0.5
- **Riquadro 13 disegnato in automatico** dalla dinamica (circostanze, zone d'urto, tipo di luogo, via): tamponamento, incrocio con precedenza, frontale, cambio di corsia/sorpasso, rotatoria, parcheggio, retromarcia, portiera, veicolo in sosta. Se il disegno viene ritoccato a mano, nel PDF va quello.
- **REC con trascrizione sul telefono** (Whisper base, ~80 MB scaricati una volta da Hugging Face e poi in cache): si registra, allo STOP compare il testo. Su iPhone il riconoscimento live di Safari è disattivato perché va in conflitto con la registrazione.

## Novità 0.5.1
- **Eliminazione** di un CID anche firmato (archivio o schermata del CID), con conferma e proposta di scaricare prima lo ZIP; anche la bozza si può eliminare.
- **Scarica tutto (ZIP)**: PDF del modulo ufficiale, foto, registrazioni audio, trascrizioni, firme, grafico e dati in JSON.
- Le **registrazioni REC** restano salvate sul telefono insieme al CID.

## Novità 0.6
- **Scanner documenti con autoscatto**: fotocamera dal vivo con cornice nella forma del documento (patente, libretto, certificato assicurativo). Ogni lato della cornice diventa verde quando il bordo del documento è allineato; con 4 lati verdi, immagine ferma e a fuoco, lo scatto parte da solo. Per la patente chiede anche il retro (si può saltare).
- **Lettura migliorata**: ritaglio sulla cornice, contrasto automatico, doppio passaggio di lettura; campi della patente, del libretto (A, D.1, D.3) e del certificato (impresa, polizza, validità).

## Struttura
- `src/app.html` — l'app (HTML/CSS/JS, nessun build step)
- `src/data/comuni.json` — comuni (ISTAT, CC BY 3.0 IT, via matteocontrini/comuni-json) e codici catastali (via codice-fiscale-js, CC BY-SA)
- `scripts/build-www.sh` — crea `www/index.html` per Capacitor
- `capacitor.config.json`, `package.json` — progetto per iOS e Android

## Installare su iPhone (uso personale, senza App Store)
CIDnow è anche un'app web installabile (PWA): si aggiunge alla schermata Home da Safari, si apre a schermo intero e funziona anche senza rete.
1. La cartella `docs/` (copia di `www/`) va pubblicata su un indirizzo **https** (GitHub Pages: Settings → Pages → Branch `main`, cartella `/docs`; oppure Netlify Drop trascinando la cartella `www`).
2. Su iPhone apri l'indirizzo con **Safari**.
3. Tocca **Condividi** → **Aggiungi alla schermata Home** → **Aggiungi**.
4. Apri CIDnow dall'icona e accetta i permessi di posizione, fotocamera e microfono quando li chiede.
5. Per la trascrizione vocale: Impostazioni → Generali → Tastiera → **Abilita Dettatura**.

Dati: restano sul telefono (IndexedDB). Non eliminare i dati di Safari per il sito, o si perde l'archivio.

## Pubblicare su App Store / Play Store
```bash
npm install
npx cap add ios
npx cap add android
npm run ios      # apre Xcode
npm run android  # apre Android Studio
```
Icone: `cp assets/icon-store-1024.png assets/icon-only.png && npm run icons`.

Permessi da dichiarare: fotocamera, posizione, microfono, riconoscimento vocale (iOS: `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`).

## Prossimi passi
- Backend per l'analisi AI delle foto (impostare `window.CIDNOW_AI_ENDPOINT`; la chiave API resta sul server, mai nell'app).
- Scambio dati avvicinando i telefoni via Bluetooth LE / NFC (plugin nativo).
- Aggiornare l'archivio comuni (dati 2020) e verificare i CAP con la banca dati di Poste.
- Archiviazione cifrata dei dati personali (Keychain / Keystore) al posto di localStorage.
- Invio diretto del PDF alla compagnia; informativa privacy GDPR.
