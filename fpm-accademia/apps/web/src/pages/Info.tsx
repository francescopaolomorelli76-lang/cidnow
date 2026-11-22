import { useState } from 'react';
import { BRAND, COMMERCIAL, FEATURES } from '@fpm/shared';
import { Logo } from '../components/Brand.js';
import { ErrorBox, StatusBadge } from '../components/Layout.js';
import { ApiError, get, post } from '../lib/api.js';
import { useSession } from '../session.js';
import { APP_VERSION } from '../version.js';


export function Info() {
  const { me, refresh } = useSession();
  return (
    <div className="stack">
      <section className="card gold stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Logo size={256} className="hero-logo" />
        <h1 className="gold-text">{BRAND.appName}</h1>
        <p className="muted">Versione {APP_VERSION} · anteprima di sviluppo</p>
        <p data-testid="copyright">{BRAND.copyright}</p>
      </section>

      <section className="card stack">
        <h2>Licenza e costi</h2>
        <ul>
          <li>Docente: prova gratuita di {COMMERCIAL.trialHours} ore a funzioni ridotte, senza carta; poi {COMMERCIAL.teacherLicenseLabel}.</li>
          <li>Allievo: gratuito.</li>
          <li>Nessun abbonamento obbligatorio, nessun credito, nessuna ricarica.</li>
          <li>Il traffico Internet (Wi-Fi, SIM, hotspot) è a carico di ciascun utente secondo il proprio contratto. I server di collegamento (signaling/TURN) sono un costo della piattaforma.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Stato delle funzioni</h2>
        <p className="dim">“Implementato” = presente e testato automaticamente in locale. Nulla è ancora verificato su reti e dispositivi reali.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Funzione</th><th>Fase</th><th>Stato</th><th>Note</th></tr></thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.id}>
                  <td>{f.label}</td>
                  <td>{f.phase}</td>
                  <td><StatusBadge state={f.state} /></td>
                  <td className="dim">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h2>Limiti da conoscere</h2>
        <ul className="muted">
          <li>Via Internet la latenza zero non esiste: suonare perfettamente insieme a distanza non è garantito.</li>
          <li>Una base precaricata riduce i problemi della base, ma la voce dal vivo arriva comunque con ritardo.</li>
          <li>Web MIDI non è disponibile in Safari (iPhone, iPad, Mac): lì si usa il pianoforte a schermo.</li>
          <li>La web app non può leggere password Wi-Fi né cambiare rete: si usano le impostazioni del sistema operativo.</li>
          <li>Un hotspot non è riconoscibile con certezza dal browser: chiediamo all’utente come è collegato.</li>
          <li>Cuffie e microfoni Bluetooth aggiungono ritardo.</li>
        </ul>
      </section>

      {me && <PrivacyTools onDeleted={refresh} />}
    </div>
  );
}

function PrivacyTools({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function exportData() {
    const data = await get('/api/me/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fpm-miei-dati.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function del() {
    if (!confirm('Eliminare definitivamente account e dati? L’operazione non si può annullare.')) return;
    setError(null);
    try {
      await post('/api/me/delete', { password });
      await onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore');
    }
  }
  return (
    <section className="card stack">
      <h2>Privacy e dati</h2>
      <p className="dim">Informativa e termini sono bozze da validare con un consulente privacy prima della pubblicazione.</p>
      <div><button className="btn" onClick={exportData}>Scarica i miei dati (JSON)</button></div>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="delpw">Elimina account — conferma con la password</label>
        <input id="delpw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <ErrorBox error={error} />
      <div><button className="btn danger" disabled={!password} onClick={del}>Elimina account</button></div>
    </section>
  );
}
