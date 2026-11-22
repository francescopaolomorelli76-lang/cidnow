# MASTER PROMPT — ACCADEMIA MUSICALE ONLINE FPM

Sei un team senior composto da product manager, architetto full-stack, progettista WebRTC/audio a bassa latenza, sviluppatore MIDI, esperto privacy/GDPR e designer UI/UX. Progetta una piattaforma realmente sviluppabile di lezioni musicali online. Considera i PDF e le immagini allegati come riferimenti: le specifiche seguenti prevalgono sulle versioni precedenti ove divergenti. Non dichiarare implementate funzioni non testate.

## Identità grafica
Interfaccia premium nero profondo e oro metallizzato, elegante, accessibile e responsive. Usa esclusivamente il **logo grafico FPM originale fornito dal committente**, senza inventarlo né sostituirlo con la sigla. Mostralo nelle schermate principali e piccolo nel footer. In Impostazioni > Informazioni inserisci: «© 2026 FP Morelli — Web Design Tech». Se il file logo originale non è disponibile, chiedilo prima dell'integrazione grafica finale.

## Utenti, licenze e sicurezza
Due ruoli: insegnante e allievo. Il docente acquista **una licenza permanente una tantum da 99,90 €**, senza abbonamenti obbligatori, crediti, ricariche o limitazioni di tempo delle lezioni acquistate. Prima dell'acquisto, **prova gratuita di 24 ore con funzioni ridotte**: configurazione dispositivi, una dimostrazione audio/video di durata limitata, test MIDI e basi demo. La prova parte dall'attivazione, senza carta di credito o addebiti automatici. L'allievo scarica e usa l'app gratuitamente. Eventuali funzioni premium future saranno facoltative. Verifica distribuzione, acquisti in-app e ripristino licenza secondo le regole attuali di ciascuno store. Non scambiare i consumi Internet degli utenti con i costi ricorrenti di server TURN, signaling o cloud: progetta un'architettura economicamente sostenibile, privilegiando P2P dove possibile.

L'insegnante crea codici d'invito unici, con scadenza e revoca. L'allievo si registra, inserisce un codice e richiede l'associazione; il docente approva. Una volta approvato, l'allievo trova solo il proprio docente, il proprio calendario, le lezioni e i materiali autorizzati. Il codice non sostituisce la login sicura. Nessun marketplace pubblico nella prima release, ma predisposizione multi-docente futura. Adegua trattamento dei dati e registrazioni al GDPR e ai minori.

## FPM Smart Setup e Smart Connection
Primo avvio guidato differenziato docente/allievo: scelta disciplina, selezione ingresso audio e microfono (USB, interfaccia, integrato, compatibile Bluetooth), uscita cuffie, test livelli, MIDI e sustain se presente, webcam con anteprima, test connessione e collegamento docente-allievo. Salva impostazioni per dispositivo e consenti di modificarle. Guida alla scelta di Wi-Fi di casa, Ethernet, SIM 4G/5G e hotspot smartphone (Wi-Fi o USB se compatibile); QR per Wi-Fi solo dove permesso. Non salvare password Wi-Fi e non promettere controllo di funzioni vietate dal sistema operativo. Misura upload, download, RTT, jitter, perdita pacchetti; preserva qualità dell'audio musicale riducendo prima il video. Gestisci perdita di rete e riconnessione.

## Discipline
Canto lirico, pop e musical; pianoforte/tastiere; chitarra e basso; batteria e percussioni; archi (violino, viola, violoncello, contrabbasso); fiati (flauto traverso, clarinetto, oboe, fagotto, sax, ottoni); teoria, armonia e composizione. Interfaccia standard condivisa e strumenti dedicati a ogni disciplina.

## Selezione e personalizzazione visiva per disciplina
All’avvio, il docente seleziona lo strumento insegnato: la schermata e gli strumenti didattici si adattano automaticamente alla disciplina. Mantieni però identità comune nera e oro, senza colori differenti per ogni strumento. Permetti al docente di personalizzare alcuni elementi grafici della propria disciplina (immagine di copertina, disposizione dei pannelli e preferenze) senza modificare il brand FPM, la leggibilità o il layout di base. Le schermate richieste includono canto, pianoforte, chitarra, basso, batteria, violino e flauto traverso.

## Canto: primo prototipo prioritario
Audio/video bidirezionale con impostazioni musicali, pianoforte virtuale e MIDI remoto: note on/off, velocity, sustain, tasti premuti, timbri. Valuta routing dell'audio da Logic Pro; metronomo, vocalizzi, scale, spartiti, trasposizione, playback basi, loop, velocità, intonazione, esercizi e registrazioni con consenso. Basi WAV/MP3 rese disponibili localmente ai partecipanti prima della lezione con comandi sincronizzati play, pause, stop, riprendi e «CORREGGI». Spiega che pre-caricare una base non elimina la latenza della voce in diretta; non promettere latenza zero né accompagnamento perfettamente simultaneo su Internet.

## Multicamera
**SOLO PER BATTERIA**, opzionale sia lato docente sia lato allievo: 1 camera base, 2 intermedio, fino a 4 professionale. Viste: completa, postura, mani/bacchette, piedi/pedali. Entrambi possono selezionare e ingrandire la vista dell'altro. Consentire connessione di più dispositivi con appropriata autorizzazione e sincronizzazione, previa verifica della compatibilità reale. Per tutti gli altri strumenti mantenere una videocamera standard, non la regia multicamera specializzata.

## Dotazione hardware consigliata
Base: smartphone/tablet o computer con camera, auricolari e rete stabile. Intermedio: PC/Mac, cuffie cablate, microfono di qualità, interfaccia USB e webcam. Professionale: CPU e RAM adeguate allo streaming (da dimensionare con test), interfaccia audio a bassa latenza/multicanale, microfoni appropriati, rete Ethernet preferita e per batteria fino a quattro camere facoltative. Proponi modelli e requisiti minimi solo dopo analisi verificata di prestazioni e compatibilità.

## Processo richiesto
1. Analizza fattibilità tecnica, costi reali d'infrastruttura, rischi e limitazioni Apple/Google/Microsoft/browser.
2. Proponi architettura per macOS, Windows, iOS/iPadOS e Android, autentificazione, signaling, WebRTC/TURN, MIDI, audio, storage e permessi.
3. Definisci flussi UX completi: avvio, setup, accesso, invito, prova, licenza, lezione e impostazioni/info.
4. Crea prototipi grafici, poi una prova tecnica **pianoforte MIDI docente → suono allievo → ritorno voce**, con misure di latenza documentate.
5. Implementa basi sincronizzate; quindi estendi a discipline e batteria multicamera.
6. Fornisci piano test per reti domestiche, Ethernet, hotspot e 4G/5G, matrici dispositivi, costi per sessione e stima di sviluppo.
7. Non avviare tutto lo sviluppo senza prima presentare analisi, roadmap e punti che necessitano approvazione.

Prima risposta: architettura proposta, fattibilità per funzione, rischi, MVP canto, costi, prove necessarie, domande tecniche essenziali. Usa il materiale allegato e segnala esplicitamente qualsiasi asset grafico mancante.
