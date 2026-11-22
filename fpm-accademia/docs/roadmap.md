# Roadmap — FPM Accademia Musicale Online

Stati: **implemented** (codice + test automatici locali) · **mock** · **planned** · **blocked** · **verified** (provato su hardware e reti reali). Al 22/11/2026 **nulla è verified**.

| Fase | Contenuto | Dipende da | Stato |
|---|---|---|---|
| A | Fondazioni: monorepo, lint/test, design tokens nero/oro, logo, layout, discipline, Informazioni | — | implemented |
| B | Auth, modello dati, inviti, approvazione, revoca, isolamento, lezioni base, export/cancellazione | A | implemented (minori: planned) |
| C | Smart Setup per ruolo: audio in/out, camera, MIDI, test rete, preferenze per dispositivo | A, B | implemented (demo; non verificato su iOS/Android) |
| D | Lezione canto: WebRTC, signaling, STUN/TURN, MIDI remoto, modalità musica, metriche | B, C, **TURN** | implemented per stessa rete (Mac + iPad); TURN/reti diverse: blocked |
| E | Basi sincronizzate WAV/MP3: upload privato, precarico, play/stop/pause/loop/CORREGGI | D | planned |
| F | Moduli per disciplina: metronomo, spartiti, accordatore, esercizi, calendario completo | A, D | planned |
| G | Batteria multicamera 1–4 camere per lato | D | planned |
| H | Trial e licenza reali, store, rilascio | B, account store | trial implemented · licenza mock · store blocked |

## Criteri di accettazione

**A** — `npm run check` verde; tutte le schermate con logo FPM oro (derivato dal PNG originale) e footer «© 2026 FP Morelli — Web Design Tech»; nessuna palette per disciplina; nessuno scroll orizzontale a 412 px. ✅ (E2E desktop + Pixel 7)

**B** — Test di integrazione su PostgreSQL per: registrazione/login, ruoli lato server, invito monouso/multiuso/scaduto/revocato, riscatto concorrente, approvazione/rifiuto, revoca immediata, isolamento tra docenti, export/cancellazione. ✅
Mancano: verifica email, recupero password, consenso genitoriale, 2FA facoltativa per docenti.

**C** — Permessi negati e dispositivi assenti gestiti con messaggi chiari; nessuna password Wi-Fi; al server solo etichette, non deviceId. ✅ in Chromium con dispositivi finti.
Da fare: prova manuale su iPhone (Safari), Android (Chrome), iPad, Mac/Windows con interfaccia audio e tastiera MIDI reali; misura banda.

**D** — Due browser su reti diverse si collegano (con TURN quando serve); audio in modalità musica; eventi MIDI con sequenza/timestamp arrivano in ordine e suonano sul dispositivo dell'allievo; RTT/jitter/perdita mostrati; test con perdita simulata. Test WAN dichiarati solo se eseguiti davvero.
**Blocco**: serve un server TURN (o servizio gestito) con credenziali.

**E** — Upload limitato per dimensione e MIME/estensione verificati, storage privato con URL firmati; comandi con orario d'esecuzione e conferma; drift misurato < soglia definita in 10 min; recupero dopo disconnessione.

**F** — Ogni disciplina mostra i propri strumenti; la personalizzazione del docente non cambia permessi né brand.

**G** — 1–4 camere per lato selezionabili e ingrandibili dall'altro partecipante; audio prioritario; consumo di banda misurato per 1/2/4 camere. Non visibile come "disponibile" prima delle misure.

**H** — Trial unico per account (server-side) ✅; acquisto reale verificato lato server per ogni canale; ripristino licenza; nessun rinnovo; condizioni Apple/Google verificate.
**Blocchi**: account sviluppatore Apple/Google, eventuale account Stripe, parere su regole store per contenuti digitali, informativa e termini definitivi (legale).
