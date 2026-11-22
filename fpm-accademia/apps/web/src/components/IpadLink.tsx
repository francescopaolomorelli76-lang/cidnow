import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { get } from '../lib/api.js';
import { UiIcon } from './UiIcon.js';

interface LanInfo {
  enabled: boolean;
  hostname?: string;
  urls: string[];
}

/**
 * Modalità "Mac + iPad": mostra al docente il link (e il QR code) da aprire sull'iPad dell'allievo.
 * Il QR è generato localmente, senza servizi esterni.
 */
export function IpadLink({ compact = false }: { compact?: boolean }) {
  const [info, setInfo] = useState<LanInfo | null>(null);
  const [qr, setQr] = useState<string>('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    get<LanInfo>('/api/lan-info').then(setInfo).catch(() => setInfo(null));
  }, []);
  const url = info?.urls[0];
  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#050506', light: '#f6e3a1' } }).then(setQr).catch(() => setQr(''));
  }, [url]);
  if (!info?.enabled) return null;

  return (
    <section className="panel ipad-link" aria-label="Collega l’iPad dell’allievo" data-testid="ipad-link">
      <header className="panel-head">
        <UiIcon name="screen" className="panel-icon" />
        <h3>Collega l’iPad dell’allievo</h3>
      </header>
      <div className="panel-body ipad-body">
        {url ? (
          <>
            {qr && <div className="qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />}
            <div className="stack tight">
              <p>Sull’iPad, collegato alla <strong>stessa rete Wi-Fi</strong>, inquadra il QR con la Fotocamera oppure apri in Safari:</p>
              <code className="lan-url" data-testid="lan-url">{url}</code>
              <div className="row">
                <button className="btn small" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } }}>
                  {copied ? 'Copiato' : 'Copia link'}
                </button>
              </div>
              {!compact && (
                <ol className="dim small steps-list">
                  <li>Safari mostrerà «Questa connessione non è privata»: tocca <em>Mostra dettagli</em> → <em>visita questo sito web</em>. Il certificato è generato dal tuo Mac, il collegamento resta cifrato.</li>
                  <li>Accedi come allievo (demo: allievo@demo.local / demo-password-123).</li>
                  <li>Apri <em>Lezione Live</em> e tocca <em>Attiva videocamera e microfono</em>, consentendo l’accesso.</li>
                </ol>
              )}
              {info.urls.length > 1 && <p className="dim small">Altri indirizzi del Mac: {info.urls.slice(1).join(' · ')}</p>}
            </div>
          </>
        ) : (
          <p className="dim">Il Mac non risulta collegato a una rete Wi-Fi o Ethernet.</p>
        )}
      </div>
    </section>
  );
}
