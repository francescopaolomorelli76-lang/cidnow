import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { ErrorBox } from '../components/Layout.js';
import { VirtualPiano } from '../components/VirtualPiano.js';
import { put } from '../lib/api.js';
import { SimpleSynth, audioContext, playTestTone, rmsLevel } from '../lib/audio.js';
import { deviceKey, loadLocalPrefs, looksBluetooth, mediaErrorMessage, saveLocalPrefs } from '../lib/device.js';
import { midiSupport, noteName, parseMidiMessage } from '../lib/midi.js';
import { browserConnectionHint, measureServerRtt, verdict, type NetStats } from '../lib/net.js';
import { useSession } from '../session.js';

const STEPS = ['Benvenuto', 'Microfono', 'Cuffie', 'Videocamera', 'MIDI', 'Rete', 'Riepilogo'] as const;
type ConnType = 'wifi' | 'ethernet' | 'cellular' | 'hotspot' | 'unknown';

interface Choices {
  audioIn?: MediaDeviceInfo;
  audioOut?: MediaDeviceInfo;
  videoIn?: MediaDeviceInfo;
  midiIn?: { id: string; name: string };
  headphones: boolean;
  connection: ConnType;
  net?: NetStats;
}

export function SmartSetup() {
  const { me, loading } = useSession();
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Choices>({ headphones: false, connection: 'unknown' });
  const update = useCallback((p: Partial<Choices>) => setChoices((c) => ({ ...c, ...p })), []);

  if (loading) return <p>Caricamento…</p>;
  if (!me) return <Navigate to="/accedi?modo=login" replace />;
  const teacher = me.role === 'teacher';

  return (
    <div className="stack" style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1>
        FPM <span className="gold-text">Smart Setup</span>
      </h1>
      <ol className="steps" aria-label="Passaggi">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="card stack">
        {step === 0 && <Welcome teacher={teacher} />}
        {step === 1 && <MicStep choices={choices} update={update} />}
        {step === 2 && <OutputStep choices={choices} update={update} />}
        {step === 3 && <CameraStep choices={choices} update={update} teacher={teacher} />}
        {step === 4 && <MidiStep choices={choices} update={update} teacher={teacher} />}
        {step === 5 && <NetStep choices={choices} update={update} />}
        {step === 6 && <Summary choices={choices} teacher={teacher} />}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Indietro
        </button>
        {step < STEPS.length - 1 && (
          <button className="btn primary" onClick={() => setStep((s) => s + 1)} data-testid="setup-next">
            {step === 0 ? 'Iniziamo' : 'Avanti'}
          </button>
        )}
      </div>
      <p className="dim">Ogni passaggio si può saltare e rifare in qualsiasi momento.</p>
    </div>
  );
}

type StepProps = { choices: Choices; update: (p: Partial<Choices>) => void };

function Welcome({ teacher }: { teacher: boolean }) {
  return (
    <>
      <h2>{teacher ? 'Prepariamo la tua postazione di insegnamento' : 'Prepariamo il tuo dispositivo per la lezione'}</h2>
      <p>
        {teacher
          ? 'Sceglieremo microfono o interfaccia audio, cuffie, videocamera e, se ce l’hai, la tastiera MIDI con il pedale. Poi controlliamo la rete.'
          : 'Bastano pochi minuti: proviamo microfono, cuffie, videocamera e connessione. Ti serve solo il dispositivo con cui seguirai la lezione.'}
      </p>
      <ul className="muted">
        <li>Il browser ti chiederà il permesso per microfono e fotocamera: serve solo per le prove su questo dispositivo.</li>
        <li>Consigliate cuffie con il filo: evitano l’eco e hanno meno ritardo del Bluetooth.</li>
        <li>FPM non legge né salva password Wi-Fi e non cambia la rete al posto tuo.</li>
      </ul>
    </>
  );
}

/* ---------------- Microfono ---------------- */
function MicStep({ choices, update }: StepProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<string>(loadLocalPrefs().audioInputId ?? '');
  const [musicMode, setMusicMode] = useState(true);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
    setLevel(0);
  }, []);
  useEffect(() => stop, [stop]);

  async function start(deviceId = selected) {
    stop();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Questo browser non permette l’accesso al microfono (serve HTTPS o un browser aggiornato).');
      return;
    }
    try {
      // "Modalità musica": disattiva cancellazione eco, soppressione rumore e controllo automatico del guadagno,
      // che alterano voce e strumenti. Richiede cuffie per evitare l'eco.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: !musicMode,
          noiseSuppression: !musicMode,
          autoGainControl: !musicMode,
        },
      });
      streamRef.current = stream;
      const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
      setDevices(list);
      const track = stream.getAudioTracks()[0]!;
      const actualId = track.getSettings().deviceId ?? '';
      setSelected(actualId);
      const dev = list.find((d) => d.deviceId === actualId);
      update({ audioIn: dev });
      saveLocalPrefs({ ...loadLocalPrefs(), audioInputId: actualId });
      const ac = audioContext();
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        setLevel(rmsLevel(analyser, buf));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setActive(true);
    } catch (e) {
      setError(mediaErrorMessage(e));
    }
  }

  const pct = Math.min(100, Math.round(level * 300));
  const label = choices.audioIn?.label ?? '';
  return (
    <>
      <h2>Microfono o interfaccia audio</h2>
      <p className="muted">Integrato, USB, interfaccia audio o Bluetooth compatibile. Parla o canta: la barra deve muoversi.</p>
      <label className="check">
        <input type="checkbox" checked={musicMode} onChange={(e) => setMusicMode(e.target.checked)} />
        <span>
          Modalità musica (niente filtri automatici sulla voce). <span className="dim">Con questa modalità usa le cuffie.</span>
        </span>
      </label>
      {devices.length > 0 && (
        <div className="field">
          <label htmlFor="mic">Ingresso</label>
          <select id="mic" value={selected} onChange={(e) => { setSelected(e.target.value); void start(e.target.value); }}>
            {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microfono ${i + 1}`}</option>)}
          </select>
        </div>
      )}
      <div className="row">
        <button className="btn primary" onClick={() => start()} data-testid="mic-start">{active ? 'Riavvia prova' : 'Prova il microfono'}</button>
        {active && <button className="btn" onClick={stop}>Ferma</button>}
      </div>
      {active && (
        <div className={`meter${pct > 90 ? ' hot' : ''}`} role="meter" aria-label="Livello microfono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
      {active && pct > 90 && <div className="alert warn">Segnale molto alto: abbassa il guadagno dell’interfaccia o allontanati dal microfono.</div>}
      {label && looksBluetooth(label) && (
        <div className="alert warn">Sembra un dispositivo Bluetooth: può aggiungere ritardo e ridurre la qualità del microfono. Per cantare meglio un microfono con il filo.</div>
      )}
      <ErrorBox error={error} />
    </>
  );
}

/* ---------------- Cuffie / uscita ---------------- */
function OutputStep({ choices, update }: StepProps) {
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState(loadLocalPrefs().audioOutputId ?? '');
  const sinkSupported = typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((l) => setOutputs(l.filter((d) => d.kind === 'audiooutput'))).catch(() => {});
  }, []);

  return (
    <>
      <h2>Cuffie e uscita audio</h2>
      {sinkSupported && outputs.length > 0 ? (
        <div className="field">
          <label htmlFor="out">Uscita</label>
          <select
            id="out"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              update({ audioOut: outputs.find((o) => o.deviceId === e.target.value) });
              saveLocalPrefs({ ...loadLocalPrefs(), audioOutputId: e.target.value });
            }}
          >
            {outputs.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Uscita ${i + 1}`}</option>)}
          </select>
        </div>
      ) : (
        <p className="muted">
          Questo browser non permette di scegliere l’uscita audio dall’app (es. Safari, Firefox): usa le impostazioni audio del
          sistema operativo o del Centro di Controllo.
        </p>
      )}
      <div className="row">
        <button className="btn" onClick={() => playTestTone('left', selected || undefined)}>Suono a sinistra</button>
        <button className="btn" onClick={() => playTestTone('right', selected || undefined)}>Suono a destra</button>
      </div>
      <label className="check">
        <input type="checkbox" checked={choices.headphones} onChange={(e) => update({ headphones: e.target.checked })} />
        <span>Sento i suoni in cuffia, a sinistra e a destra correttamente</span>
      </label>
      {choices.audioOut && looksBluetooth(choices.audioOut.label) && (
        <div className="alert warn">Cuffie Bluetooth: il ritardo può essere di centinaia di millisecondi. Per suonare a tempo preferisci cuffie con il filo.</div>
      )}
    </>
  );
}

/* ---------------- Videocamera ---------------- */
function CameraStep({ update, teacher }: StepProps & { teacher: boolean }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState(loadLocalPrefs().videoInputId ?? '');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  async function start(deviceId = selected) {
    stop();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setDevices(list);
      const id = stream.getVideoTracks()[0]!.getSettings().deviceId ?? '';
      setSelected(id);
      update({ videoIn: list.find((d) => d.deviceId === id) });
      saveLocalPrefs({ ...loadLocalPrefs(), videoInputId: id });
    } catch (e) {
      setError(mediaErrorMessage(e));
    }
  }

  return (
    <>
      <h2>Videocamera</h2>
      <p className="muted">
        Inquadra {teacher ? 'te e lo strumento' : 'te stesso e lo strumento'}: per il canto viso e postura, per gli strumenti anche le mani.
      </p>
      {devices.length > 1 && (
        <div className="field">
          <label htmlFor="cam">Videocamera</label>
          <select id="cam" value={selected} onChange={(e) => { setSelected(e.target.value); void start(e.target.value); }}>
            {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Videocamera ${i + 1}`}</option>)}
          </select>
        </div>
      )}
      <button className="btn primary" onClick={() => start()} data-testid="cam-start">Mostra anteprima</button>
      <video ref={videoRef} className="preview" autoPlay playsInline muted aria-label="Anteprima videocamera" />
      <ErrorBox error={error} />
      <p className="dim">Batteria: la multicamera (fino a 4 camere per lato) sarà configurabile in una fase successiva; ora si prova una camera.</p>
    </>
  );
}

/* ---------------- MIDI ---------------- */
function MidiStep({ update, teacher }: StepProps & { teacher: boolean }) {
  const support = midiSupport();
  const [inputs, setInputs] = useState<{ id: string; name: string }[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [activeNotes, setActive] = useState<Set<number>>(new Set());
  const [sustain, setSustain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synth = useRef<SimpleSynth | null>(null);
  const accessRef = useRef<MIDIAccess | null>(null);
  const getSynth = () => (synth.current ??= new SimpleSynth());

  const on = useCallback((n: number, v: number) => {
    getSynth().noteOn(n, v);
    setActive((s) => new Set(s).add(n));
  }, []);
  const off = useCallback((n: number) => {
    getSynth().noteOff(n);
    setActive((s) => {
      const c = new Set(s);
      c.delete(n);
      return c;
    });
  }, []);

  useEffect(
    () => () => {
      accessRef.current?.inputs.forEach((i) => (i.onmidimessage = null));
    },
    [],
  );

  async function connect() {
    setError(null);
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      const list: { id: string; name: string }[] = [];
      access.inputs.forEach((input) => {
        list.push({ id: input.id, name: input.name ?? 'Dispositivo MIDI' });
        input.onmidimessage = (msg) => {
          if (!msg.data) return;
          const ev = parseMidiMessage(msg.data);
          if (!ev) return;
          if (ev.type === 'noteon') on(ev.note, ev.velocity);
          if (ev.type === 'noteoff') off(ev.note);
          if (ev.type === 'sustain') {
            getSynth().setSustain(ev.on);
            setSustain(ev.on);
          }
          const text =
            ev.type === 'noteon' ? `Nota ${noteName(ev.note)} · velocity ${ev.velocity}`
            : ev.type === 'noteoff' ? `Rilascio ${noteName(ev.note)}`
            : ev.type === 'sustain' ? `Pedale sustain ${ev.on ? 'giù' : 'su'}`
            : `Controllo ${ev.controller} = ${ev.value}`;
          setLog((l) => [text, ...l].slice(0, 8));
        };
      });
      setInputs(list);
      if (list[0]) update({ midiIn: list[0] });
      if (list.length === 0) setError('Nessuna tastiera MIDI trovata. Collegala via USB e premi di nuovo.');
    } catch {
      setError('Accesso MIDI negato o non disponibile.');
    }
  }

  return (
    <>
      <h2>Tastiera MIDI e pedale {teacher ? '' : '(facoltativo)'}</h2>
      {support.supported ? (
        <>
          <p className="muted">Collega la tastiera via USB, premi “Collega MIDI” e suona: vedrai note, dinamica (velocity) e pedale.</p>
          <button className="btn primary" onClick={connect}>Collega MIDI</button>
          {inputs.length > 0 && <p>Dispositivi: {inputs.map((i) => i.name).join(', ')}</p>}
        </>
      ) : (
        <div className="alert info">{support.reason}</div>
      )}
      <ErrorBox error={error} />
      <p className="dim">
        Pianoforte a schermo (suono di prova sintetico, non un pianoforte campionato){sustain ? ' · sustain attivo' : ''}:
      </p>
      <VirtualPiano active={activeNotes} onNoteOn={on} onNoteOff={off} />
      {log.length > 0 && (
        <ul className="dim" aria-live="polite" style={{ margin: 0 }}>
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      <p className="dim">L’invio delle note al dispositivo dell’allievo durante la lezione arriverà con la Fase D.</p>
    </>
  );
}

/* ---------------- Rete ---------------- */
const CONN: { id: ConnType; label: string; tip: string }[] = [
  { id: 'ethernet', label: 'Cavo Ethernet', tip: 'La scelta più stabile per insegnare: collega il cavo dal router al computer (serve un adattatore USB-Ethernet su molti portatili).' },
  { id: 'wifi', label: 'Wi-Fi di casa', tip: 'Avvicinati al router, preferisci la rete a 5 GHz e chiedi a chi è in casa di sospendere download e streaming durante la lezione.' },
  { id: 'cellular', label: 'SIM 4G/5G', tip: 'Funziona, ma ritardo e stabilità variano molto con il segnale. Il 5G non è sempre migliore del 4G. Controlla il traffico dati del tuo piano.' },
  { id: 'hotspot', label: 'Hotspot dello smartphone', tip: 'Attivalo dalle impostazioni del telefono (Wi-Fi o, se supportato, cavo USB) e collegati dalle impostazioni di rete del computer. Il traffico consuma i dati del telefono.' },
];

function NetStep({ choices, update }: StepProps) {
  const [busy, setBusy] = useState(false);
  const hint = browserConnectionHint();
  async function run() {
    setBusy(true);
    try {
      update({ net: await measureServerRtt() });
    } finally {
      setBusy(false);
    }
  }
  const tip = CONN.find((c) => c.id === choices.connection)?.tip;
  return (
    <>
      <h2>Connessione</h2>
      <p className="muted">
        Collegati alla rete dalle impostazioni del sistema operativo (FPM non gestisce password Wi-Fi). Poi indica come sei connesso.
      </p>
      <div className="row" role="radiogroup" aria-label="Tipo di connessione">
        {CONN.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={choices.connection === c.id} className={`btn small${choices.connection === c.id ? ' primary' : ''}`} onClick={() => update({ connection: c.id })}>
            {c.label}
          </button>
        ))}
      </div>
      {tip && <div className="alert info">{tip}</div>}
      {hint && <p className="dim">Il browser indica: {hint} (informazione indicativa).</p>}
      <button className="btn primary" onClick={run} disabled={busy} data-testid="net-run">{busy ? 'Misura in corso…' : 'Misura la connessione'}</button>
      {choices.net && (
        <div className="stack" role="status" data-testid="net-result">
          <p>
            Qualità verso il server FPM: <strong className="gold-text">{verdict(choices.net)}</strong>
          </p>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr><th>Ritardo andata/ritorno (mediana)</th><td>{choices.net.rttMedianMs} ms</td></tr>
                <tr><th>Jitter</th><td>{choices.net.jitterMs} ms</td></tr>
                <tr><th>Richieste perse</th><td>{choices.net.lost}/{choices.net.samples} ({choices.net.lossPct}%)</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dim">
            Questa prova misura il collegamento con il server, non il ritardo audio con l’altra persona: quello verrà misurato
            durante la lezione. La banda disponibile (upload/download) non è ancora misurata.
          </p>
        </div>
      )}
    </>
  );
}

/* ---------------- Riepilogo ---------------- */
function Summary({ choices, teacher }: { choices: Choices; teacher: boolean }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    try {
      // Al server vanno solo etichette leggibili e scelte; gli identificativi dei dispositivi restano su questo browser.
      await put('/api/devices', {
        deviceKey: deviceKey(),
        label: navigator.userAgent.includes('Mobile') ? 'Dispositivo mobile' : 'Computer',
        audioInputLabel: choices.audioIn?.label || null,
        audioOutputLabel: choices.audioOut?.label || null,
        videoInputLabel: choices.videoIn?.label || null,
        midiInputLabel: choices.midiIn?.name || null,
        connectionType: choices.connection,
        headphonesConfirmed: choices.headphones,
      });
      setSaved(true);
    } catch {
      setError('Salvataggio non riuscito. Riprova.');
    }
  }
  const row = (k: string, v: string | undefined) => (
    <tr><th>{k}</th><td>{v || <span className="dim">non configurato</span>}</td></tr>
  );
  return (
    <>
      <h2>Riepilogo di questo dispositivo</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {row('Microfono', choices.audioIn?.label)}
            {row('Uscita audio', choices.audioOut?.label)}
            {row('Cuffie verificate', choices.headphones ? 'Sì' : undefined)}
            {row('Videocamera', choices.videoIn?.label)}
            {row('MIDI', choices.midiIn?.name)}
            {row('Connessione', CONN.find((c) => c.id === choices.connection)?.label)}
            {row('Qualità rete', choices.net ? `${verdict(choices.net)} (${choices.net.rttMedianMs} ms)` : undefined)}
          </tbody>
        </table>
      </div>
      {!choices.headphones && <div className="alert warn">Senza cuffie la voce dell’altra persona rientra nel microfono e crea eco.</div>}
      <ErrorBox error={error} />
      {saved ? (
        <div className="alert ok" role="status">
          Preferenze salvate per questo dispositivo. <Link to={teacher ? '/docente' : '/allievo'}>Vai alla tua area</Link>
        </div>
      ) : (
        <button className="btn primary" onClick={save} data-testid="setup-save">Salva per questo dispositivo</button>
      )}
    </>
  );
}
