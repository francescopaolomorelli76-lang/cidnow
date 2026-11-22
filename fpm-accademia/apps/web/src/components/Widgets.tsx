import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FeatureState } from '@fpm/shared';
import { audioContext, rmsLevel } from '../lib/audio.js';
import { Metronome, BPM_MAX, BPM_MIN, clampBpm } from '../lib/metronome.js';
import { detectPitch, frequencyToNote, type NoteReading } from '../lib/pitch.js';
import { useAnimationFrame, type LocalMedia } from '../lib/useLocalMedia.js';
import { StatusBadge } from './Layout.js';
import { UiIcon, type IconName } from './UiIcon.js';

export function Panel({
  icon, title, state, children, className = '', actions,
}: { icon: IconName; title: string; state?: FeatureState; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <header className="panel-head">
        <UiIcon name={icon} className="panel-icon" />
        <h3>{title}</h3>
        <span className="panel-actions">
          {actions}
          {state && state !== 'implemented' && <StatusBadge state={state} />}
        </span>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

/* ---------------- Altezza della nota (accordatore / intonazione) ---------------- */
function usePitch(media: LocalMedia, a4: number) {
  const [reading, setReading] = useState<(NoteReading & { hz: number }) | null>(null);
  const active = !!media.stream && media.micOn;
  useEffect(() => {
    if (!active) {
      setReading(null);
      return;
    }
    const buf = new Float32Array(4096);
    const id = setInterval(() => {
      const an = media.analyser.current;
      if (!an) return;
      an.getFloatTimeDomainData(buf);
      const p = detectPitch(buf, an.context.sampleRate);
      if (p && p.clarity > 0.8) setReading({ ...frequencyToNote(p.frequency, a4), hz: p.frequency });
    }, 90);
    return () => clearInterval(id);
  }, [active, media.analyser, a4]);
  return reading;
}

function CentsGauge({ cents }: { cents: number | null }) {
  const angle = cents === null ? 0 : Math.max(-50, Math.min(50, cents)) * 1.6; // ±80°
  const ok = cents !== null && Math.abs(cents) <= 5;
  return (
    <svg viewBox="0 0 200 110" className="gauge" aria-hidden="true">
      <path d="M20 100 A80 80 0 0 1 180 100" className="gauge-arc" />
      {[-50, -20, -10, 0, 10, 20, 50].map((c) => {
        const a = ((c * 1.6 - 90) * Math.PI) / 180;
        return (
          <g key={c}>
            <line x1={100 + 70 * Math.cos(a)} y1={100 + 70 * Math.sin(a)} x2={100 + 80 * Math.cos(a)} y2={100 + 80 * Math.sin(a)} className="gauge-tick" />
            <text x={100 + 58 * Math.cos(a)} y={100 + 58 * Math.sin(a) + 3} className="gauge-label">{c > 0 ? `+${c}` : c}</text>
          </g>
        );
      })}
      <line x1="100" y1="100" x2="100" y2="28" className={`gauge-needle${ok ? ' ok' : ''}`} transform={`rotate(${angle} 100 100)`} style={{ opacity: cents === null ? 0.25 : 1 }} />
      <circle cx="100" cy="100" r="5" className="gauge-hub" />
    </svg>
  );
}

export function Tuner({ media, title = 'Accordatore' }: { media: LocalMedia; title?: string }) {
  const [a4, setA4] = useState(440);
  const r = usePitch(media, a4);
  const ok = r && Math.abs(r.cents) <= 5;
  return (
    <Panel icon="tuner" title={title}>
      {!media.stream ? (
        <p className="dim">Attiva microfono e videocamera per usarlo.</p>
      ) : (
        <div className="tuner" data-testid="tuner">
          <div className="tuner-note">{r ? r.nameIt : '—'}</div>
          <div className="dim">{r ? `${r.nameEn} · ${r.hz.toFixed(1)} Hz · ${r.cents > 0 ? '+' : ''}${r.cents} cent` : 'Suona o canta una nota'}</div>
          <CentsGauge cents={r?.cents ?? null} />
          <div className={`tuner-status${ok ? ' ok' : ''}`}>{r ? (ok ? '✓ Intonato' : r.cents < 0 ? 'Calante' : 'Crescente') : ' '}</div>
          <label className="row small-row">
            La4 =
            <select value={a4} onChange={(e) => setA4(Number(e.target.value))} aria-label="Frequenza di riferimento La4">
              {[438, 440, 441, 442, 443].map((v) => <option key={v} value={v}>{v} Hz</option>)}
            </select>
          </label>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Metronomo ---------------- */
export function MetronomePanel({ initialBpm = 80 }: { initialBpm?: number }) {
  const m = useRef<Metronome | null>(null);
  const [bpm, setBpm] = useState(initialBpm);
  const [beats, setBeats] = useState(4);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const get = () => (m.current ??= new Metronome());
  useEffect(() => () => m.current?.stop(), []);
  const change = (v: number) => {
    const b = clampBpm(v);
    setBpm(b);
    get().bpm = b;
  };
  return (
    <Panel icon="metronome" title="Metronomo">
      <div className="metro">
        <div className="row metro-bpm">
          <button className="icon-btn" aria-label="Rallenta" onClick={() => change(bpm - 1)}>−</button>
          <output aria-live="polite" data-testid="bpm">♩ = {bpm}</output>
          <button className="icon-btn" aria-label="Accelera" onClick={() => change(bpm + 1)}>+</button>
        </div>
        <input type="range" min={BPM_MIN} max={BPM_MAX} value={bpm} onChange={(e) => change(Number(e.target.value))} aria-label="Battiti al minuto" />
        <div className="row" style={{ justifyContent: 'center' }}>
          <button
            className="play-btn"
            aria-label={running ? 'Ferma metronomo' : 'Avvia metronomo'}
            onClick={() => {
              const x = get();
              x.bpm = bpm;
              x.beatsPerBar = beats;
              x.onBeat = setBeat;
              if (x.running) { x.stop(); setRunning(false); setBeat(-1); } else { x.start(); setRunning(true); }
            }}
          >
            <UiIcon name={running ? 'pause' : 'play'} />
          </button>
          <select value={beats} onChange={(e) => { setBeats(Number(e.target.value)); get().beatsPerBar = Number(e.target.value); }} aria-label="Tempo">
            {[2, 3, 4, 6].map((b) => <option key={b} value={b}>{b}/4</option>)}
          </select>
        </div>
        <div className="beats" aria-hidden="true">
          {Array.from({ length: beats }, (_, i) => <span key={i} className={i === beat ? 'on' : ''} />)}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- Respirazione ---------------- */
const BREATH = [
  { id: '4-2-6', label: 'Respiro diaframmatico 4-2-6', phases: [['Inspira', 4], ['Trattieni', 2], ['Espira', 6]] },
  { id: '4-4-8', label: 'Sostegno 4-4-8', phases: [['Inspira', 4], ['Trattieni', 4], ['Espira', 8]] },
  { id: '3-0-12', label: 'Espirazione lunga 3-12', phases: [['Inspira', 3], ['Espira su "sss"', 12]] },
] as const;

export function BreathingPanel() {
  const [preset, setPreset] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(0);
  const p = BREATH[preset]!;
  useEffect(() => {
    if (!running) return;
    let ph = 0;
    let remaining: number = p.phases[0]![1];
    setPhase(0);
    setLeft(remaining);
    const id = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        ph = (ph + 1) % p.phases.length;
        remaining = p.phases[ph]![1];
        setPhase(ph);
      }
      setLeft(remaining);
    }, 1000);
    return () => clearInterval(id);
  }, [running, p]);
  const [label, secs] = p.phases[phase]!;
  const scale = !running ? 0.6 : label.startsWith('Inspira') ? 1 : label.startsWith('Tratt') ? 1 : 0.55;
  return (
    <Panel icon="breath" title="Respirazione">
      <div className="breath">
        <select value={preset} onChange={(e) => { setPreset(Number(e.target.value)); setRunning(false); }} aria-label="Esercizio">
          {BREATH.map((b, i) => <option key={b.id} value={i}>{b.label}</option>)}
        </select>
        <div className="breath-circle" style={{ transform: `scale(${scale})`, transitionDuration: `${running ? secs : 0.3}s` }} aria-hidden="true" />
        <div className="breath-text" aria-live="polite">{running ? `${label} · ${left}` : p.phases.map(([l, s]) => `${l} ${s}s`).join(' · ')}</div>
        <button className="play-btn" aria-label={running ? 'Ferma' : 'Avvia esercizio'} onClick={() => setRunning((r) => !r)}>
          <UiIcon name={running ? 'pause' : 'play'} />
        </button>
      </div>
    </Panel>
  );
}

/* ---------------- Monitoraggio audio ---------------- */
function LevelBar({ level, label, idle }: { level: number; label: string; idle?: string }) {
  const segs = 20;
  const lit = Math.round(Math.min(1, level * 3) * segs);
  return (
    <div className="level-row">
      <span>{label}</span>
      <div className="level" role="meter" aria-label={`Livello ${label}`} aria-valuemin={0} aria-valuemax={segs} aria-valuenow={lit}>
        {Array.from({ length: segs }, (_, i) => <i key={i} className={i < lit ? (i > 16 ? 'hot' : 'on') : ''} />)}
      </div>
      {idle && <span className="dim small">{idle}</span>}
    </div>
  );
}

export function AudioMonitor({ media, remote, localLabel, remoteLabel }: { media: LocalMedia; remote?: MediaStream | null; localLabel: string; remoteLabel: string }) {
  const [level, setLevel] = useState(0);
  const [rLevel, setRLevel] = useState(0);
  const buf = useRef(new Float32Array(2048));
  const rAnalyser = useRef<AnalyserNode | null>(null);
  useEffect(() => {
    if (!remote || remote.getAudioTracks().length === 0) {
      rAnalyser.current = null;
      return;
    }
    const ac = audioContext();
    const src = ac.createMediaStreamSource(remote);
    const an = ac.createAnalyser();
    an.fftSize = 2048;
    src.connect(an);
    rAnalyser.current = an;
    return () => {
      src.disconnect();
      rAnalyser.current = null;
    };
  }, [remote]);
  useAnimationFrame(() => {
    const an = media.analyser.current;
    setLevel(an && media.micOn ? rmsLevel(an, buf.current) : 0);
    const ra = rAnalyser.current;
    setRLevel(ra ? rmsLevel(ra, buf.current) : 0);
  }, !!media.stream);
  return (
    <Panel icon="wave" title="Monitoraggio del suono">
      <LevelBar level={level} label={localLabel} />
      <LevelBar level={rLevel} label={remoteLabel} idle={remote ? undefined : 'non collegato'} />
      <label className="check small">
        <input type="checkbox" checked={media.musicMode} onChange={(e) => media.setMusicMode(e.target.checked)} />
        <span>Modalità musica (nessun filtro sulla voce · usa le cuffie). Vale alla prossima attivazione.</span>
      </label>
    </Panel>
  );
}

/* ---------------- Configurazione dispositivi ---------------- */
export function DevicePanel({ media }: { media: LocalMedia }) {
  const ins = media.devices.filter((d) => d.kind === 'audioinput');
  const cams = media.devices.filter((d) => d.kind === 'videoinput');
  const ready = !!media.stream && media.micOn;
  return (
    <Panel icon="setup" title="Configurazione dispositivi">
      {!media.stream ? (
        <p className="dim">I dispositivi compaiono dopo l’attivazione.</p>
      ) : (
        <div className="stack tight">
          <label className="field-inline">
            <UiIcon name="cam" size={18} />
            <select value={media.currentVideoId} onChange={(e) => media.start({ videoId: e.target.value })} aria-label="Videocamera">
              {cams.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Videocamera ${i + 1}`}</option>)}
            </select>
          </label>
          <label className="field-inline">
            <UiIcon name="mic" size={18} />
            <select value={media.currentAudioId} onChange={(e) => media.start({ audioId: e.target.value })} aria-label="Microfono">
              {ins.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microfono ${i + 1}`}</option>)}
            </select>
          </label>
          <p className={ready ? 'ok-text' : 'dim'}>{ready ? '✓ Dispositivi pronti' : 'Microfono disattivato'}</p>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Spartito (file locale) ---------------- */
const MAX_SHEET_BYTES = 20 * 1024 * 1024;
export function SheetPanel() {
  const [file, setFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);
  return (
    <Panel icon="sheet" title="Spartito" state="planned" className="sheet-panel">
      {file ? (
        file.type === 'application/pdf' ? (
          <object data={file.url} type="application/pdf" className="sheet-view" aria-label={file.name}>
            <p>Il browser non mostra i PDF qui: <a href={file.url} target="_blank" rel="noreferrer">apri lo spartito</a>.</p>
          </object>
        ) : (
          <img src={file.url} alt={`Spartito: ${file.name}`} className="sheet-view" />
        )
      ) : (
        <div className="sheet-empty">
          <UiIcon name="sheet" size={40} />
          <p>Apri uno spartito (PDF o immagine) da questo dispositivo.</p>
        </div>
      )}
      <div className="row">
        <label className="btn small">
          {file ? 'Cambia spartito' : 'Apri spartito'}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setError(null);
              if (!f) return;
              if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return setError('Formato non supportato: usa PDF, PNG, JPG o WebP.');
              if (f.size > MAX_SHEET_BYTES) return setError('File troppo grande (massimo 20 MB).');
              if (file) URL.revokeObjectURL(file.url);
              setFile({ url: URL.createObjectURL(f), type: f.type, name: f.name });
            }}
          />
        </label>
        <span className="dim small">Visibile solo su questo dispositivo: la condivisione con l’allievo è pianificata.</span>
      </div>
      {error && <p className="error-text">{error}</p>}
    </Panel>
  );
}

/* ---------------- Multicamera batteria (anteprima) ---------------- */
export function MulticamPanel({ count, setCount, views }: { count: 1 | 2 | 4; setCount: (n: 1 | 2 | 4) => void; views: readonly string[] }) {
  return (
    <Panel icon="grid4" title="Regia multicamera (opzionale)" state="planned">
      <div className="row cam-choice" role="radiogroup" aria-label="Numero di camere">
        {([[1, 'grid1', 'Base'], [2, 'grid2', 'Intermedia'], [4, 'grid4', 'Professionale']] as const).map(([n, icon, lvl]) => (
          <button key={n} role="radio" aria-checked={count === n} className={`cam-opt${count === n ? ' on' : ''}`} onClick={() => setCount(n)}>
            <UiIcon name={icon} size={26} />
            <span>{n} {n === 1 ? 'camera' : 'camere'}</span>
            <small>{lvl}</small>
          </button>
        ))}
      </div>
      <p className="dim small">Viste: {views.join(', ')}. Solo anteprima della disposizione: la gestione di più camere non è ancora attiva (Fase G).</p>
    </Panel>
  );
}
