# Claude Code — istruzioni repository FPM

Leggere `PROMPT_CLAUDE_CODE_AVVIO.md` e `SPECIFICA_FPM_CONSOLIDATA.md` prima di modificare il codice. Le specifiche consolidate prevalgono sui PDF storici. UI uniforme nero/oro; logo sorgente `Logo neon FpM con volto barbuto.png`, preservare silhouette; multicamera specializzata esclusivamente batteria; docente acquista una volta €99,90 permanente dopo trial di 24 ore a funzioni ridotte; allievo gratis e collegato con invito approvato; niente crediti/abbonamenti obbligatori. Backend autorizza ogni accesso. Non riportare come funzionanti mock/prototipi. Scrivere test e README a ogni milestone. In caso di impossibilità tecnica browser/OS, documentare alternativa/fallback.

## Percorsi in questo repository
- Specifiche: `docs/reference/SPECIFICA_FPM_CONSOLIDATA.md`, `docs/reference/PROMPT_CLAUDE_CODE_AVVIO.md`
- Logo originale: `brand/logo-fpm-original.png` (copia di `Logo neon FpM con volto barbuto.png`); versione oro: `scripts/derive_gold_logo.py`
- Stato funzioni: `packages/shared/src/featureStatus.ts` (aggiornarlo a ogni milestone)
- Verifica completa: `npm run check` e `npm run test:e2e`
