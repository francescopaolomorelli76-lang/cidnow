import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  DISCIPLINES, TOOL_LABELS, getDiscipline, isDisciplineId,
  type Discipline, type DisciplineId, type FeatureState, type TeachingTool,
} from '@fpm/shared';
import { DisciplineIcon } from '../components/Icons.js';
import { StatusBadge } from '../components/Layout.js';
import { UiIcon, type IconName } from '../components/UiIcon.js';
import { VirtualPiano } from '../components/VirtualPiano.js';
import {
  AudioMonitor, BreathingPanel, DevicePanel, MetronomePanel, MulticamPanel, Panel, SheetPanel, Tuner,
} from '../components/Widgets.js';
import { get } from '../lib/api.js';
import { SimpleSynth } from '../lib/audio.js';
import { useLocalMedia, type LocalMedia } from '../lib/useLocalMedia.js';
import { useSession } from '../session.js';

/** Stato reale di ogni strumento didattico dentro la stanza lezione. */
const TOOL_STATE: Record<TeachingTool, { state: FeatureState; icon: IconName }> = {
  metronomo: { state: 'implemented', icon: 'metronome' },
  intonazione: { state: 'implemented', icon: 'tuner' },
  accordatore: { state: 'implemented', icon: 'tuner' },
  respirazione: { state: 'implemented', icon: 'breath' },
  'pianoforte-midi': { state: 'implemented', icon: 'music' },
  calendario: { state: 'implemented', icon: 'calendar' },
  spartiti: { state: 'planned', icon: 'sheet' },
  'basi-sincronizzate': { state: 'planned', icon: 'play' },
  esercizi: { state: 'planned', icon: 'book' },
  note: { state: 'planned', icon: 'sheet' },
  vocalizzi: { state: 'planned', icon: 'wave' },
  'accordi-tablature': { state: 'planned', icon: 'sheet' },
  'pattern-ritmici': { state: 'planned', icon: 'metronome' },
  armonia: { state: 'planned', icon: 'book' },
};

const ROOM_TITLE: Record<DisciplineId, string> = {
  canto: 'Sezione Canto',
  pianoforte: 'Pianoforte e Tastiere',
  'chitarra-basso': 'Chitarra e Basso',
  batteria: 'Batteria e Percussioni',
  archi: 'Archi',
  fiati: 'Fiati',
  teoria: 'Teoria e Composizione',
};

export function LessonRoom() {
  const { me, loading } = useSession();
  const [params, setParams] = useSearchParams();
  const [profileDiscipline, setProfileDiscipline] = useState<DisciplineId | null>(null);
  const media = useLocalMedia();
  const navigate = useNavigate();
  const [cams, setCams] = useState<1 | 2 | 4>(1);

  useEffect(() => {
    if (!me) return;
    const url = me.role === 'teacher' ? '/api/teacher/profile' : '/api/student/teacher';
    get<{ discipline: DisciplineId | null }>(url).then((p) => setProfileDiscipline(p.discipline)).catch(() => {});
  }, [me]);

  if (loading) return <p>Caricamento…</p>;
  if (!me) return <Navigate to="/accedi?modo=login" replace />;

  const q = params.get('d') ?? '';
  const id: DisciplineId = isDisciplineId(q) ? q : profileDiscipline ?? 'canto';
  const d = getDiscipline(id)!;
  const teacher = me.role === 'teacher';
  const localRole = teacher ? 'Docente' : 'Allievo';
  const remoteRole = teacher ? 'Allievo' : 'Docente';
  const drums = d.video.kind === 'drums-multicam';
  const withRemote = teacher ? 'con l’allievo' : 'con il docente';

  return (
    <div className="room">
      <div className="room-banner">
        <span className="rule" aria-hidden="true" />
        <DisciplineIcon id={d.id} className="room-banner-icon" />
        <h1 className="display-caps">{ROOM_TITLE[d.id]}</h1>
        <span className="rule" aria-hidden="true" />
      </div>

      <div className="room-note-row">
      <div className="alert info room-note" role="note">
        <strong>Anteprima della stanza lezione.</strong> Videocamera, microfono, accordatore, metronomo, respirazione e
        pianoforte funzionano davvero <em>su questo dispositivo</em>. Il collegamento audio/video {withRemote} non
        è ancora attivo (Fase D).
      </div>
        <select className="room-switch" value={d.id} onChange={(e) => setParams({ d: e.target.value })} aria-label="Disciplina della stanza">
          {DISCIPLINES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>

      <div className="room-grid">
        <div className="stage-wrap">
          <Stage media={media} d={d} me={me.displayName} localRole={localRole} remoteRole={remoteRole} cams={drums ? cams : 1} />
          <ControlBar media={media} onEnd={() => { media.stop(); navigate(teacher ? '/docente' : '/allievo'); }} />
          <div className="widgets">
            {(d.tools.includes('intonazione') || d.tools.includes('accordatore')) && (
              <Tuner media={media} title={d.id === 'canto' ? 'Intonazione' : 'Accordatore'} />
            )}
            {d.tools.includes('respirazione') && <BreathingPanel />}
            <MetronomePanel initialBpm={drums ? 120 : 80} />
            <AudioMonitor media={media} localLabel={`${localRole} (tu)`} remoteLabel={remoteRole} />
          </div>
        </div>
        <aside className="room-side">
          {drums && <MulticamPanel count={cams} setCount={setCams} views={d.video.kind === 'drums-multicam' ? d.video.views : []} />}
          {!drums && <SheetPanel />}
          <ToolsPanel d={d} />
          <DevicePanel media={media} />
        </aside>
      </div>

      {d.midiRelevant && !drums && <RoomPiano />}

      <Panel icon="play" title="Basi musicali sincronizzate" state="planned" className="backing">
        <div className="backing-bar" aria-disabled="true">
          <button className="play-btn" disabled aria-label="Riproduci base (non ancora disponibile)"><UiIcon name="play" /></button>
          <span className="dim">00:00 / 00:00</span>
          <div className="wave-placeholder" aria-hidden="true" />
          <span className="dim small">Caricamento WAV/MP3 e comandi sincronizzati: Fase E</span>
        </div>
      </Panel>

      <div className="room-status">
        <span><UiIcon name="calendar" size={18} /> Lezione online · {d.label}</span>
        <span>{media.stream ? '● Anteprima locale attiva' : '○ Anteprima non attiva'}</span>
        <span>Connessione {withRemote}: <strong>non collegato</strong></span>
        <Link to="/setup">Smart Setup</Link>
      </div>
    </div>
  );
}

function VideoTile({ stream, muted, label, live, className = '', children }: { stream?: MediaStream | null; muted?: boolean; label: string; live?: boolean; className?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null;
  }, [stream]);
  return (
    <div className={`tile ${className}`}>
      {stream ? <video ref={ref} autoPlay playsInline muted={muted} /> : <div className="tile-empty">{children}</div>}
      <span className="tile-label"><UiIcon name="user" size={16} /> {label} <i className={`dot${live ? ' live' : ''}`} /></span>
    </div>
  );
}

function Stage({ media, d, me, localRole, remoteRole, cams }: { media: LocalMedia; d: Discipline; me: string; localRole: string; remoteRole: string; cams: 1 | 2 | 4 }) {
  const views = d.video.kind === 'drums-multicam' ? d.video.views : [];
  const remote = (
    <VideoTile label={remoteRole} className="pip">
      <UiIcon name="user" size={34} />
      <span>{remoteRole === 'Allievo' ? 'In attesa dell’allievo' : 'In attesa del docente'}</span>
      <small className="dim">collegamento: Fase D</small>
    </VideoTile>
  );
  if (!media.stream) {
    return (
      <div className="stage">
        <div className="stage-start">
          <UiIcon name="cam" size={44} />
          <p>Attiva videocamera e microfono per provare la stanza.</p>
          <button className="btn primary" onClick={() => media.start()} data-testid="room-start">Attiva videocamera e microfono</button>
          {media.error && <p className="error-text" role="alert">{media.error}</p>}
        </div>
        {remote}
      </div>
    );
  }
  if (cams > 1) {
    return (
      <>
      <div className="stage multicam" data-cams={cams}>
        {Array.from({ length: cams }, (_, i) =>
          i === 0 ? (
            <VideoTile key={i} stream={media.camOn ? media.stream : null} muted label={`${views[0]} · ${localRole}`} live>
              <UiIcon name="camOff" size={34} /><span>Videocamera spenta</span>
            </VideoTile>
          ) : (
            <VideoTile key={i} label={`${views[i] ?? `Camera ${i + 1}`}`}>
              <UiIcon name="cam" size={30} /><span>Camera aggiuntiva</span><small className="dim">Fase G</small>
            </VideoTile>
          ),
        )}
      </div>
      <div className="remote-strip">{remote}</div>
      </>
    );
  }
  return (
    <div className="stage">
      <VideoTile stream={media.camOn ? media.stream : null} muted label={`${localRole}: ${me}`} live className="main">
        <UiIcon name="camOff" size={44} /><span>Videocamera spenta</span>
      </VideoTile>
      {remote}
    </div>
  );
}

function ControlBar({ media, onEnd }: { media: LocalMedia; onEnd: () => void }) {
  const on = !!media.stream;
  const btn = (icon: IconName, label: string, onClick?: () => void, opts: { active?: boolean; disabled?: string } = {}) => (
    <button
      className={`ctrl${opts.active === false ? ' off' : ''}`}
      onClick={onClick}
      disabled={!!opts.disabled || !onClick}
      title={opts.disabled ?? label}
      aria-label={opts.disabled ? `${label} — ${opts.disabled}` : label}
      aria-pressed={opts.active}
    >
      <UiIcon name={icon} />
      <span>{label}</span>
    </button>
  );
  return (
    <div className="control-bar">
      {btn(media.micOn ? 'mic' : 'micOff', media.micOn ? 'Microfono' : 'Muto', on ? media.toggleMic : undefined, { active: media.micOn })}
      {btn(media.camOn ? 'cam' : 'camOff', media.camOn ? 'Video' : 'Video spento', on ? media.toggleCam : undefined, { active: media.camOn })}
      {btn('screen', 'Condividi', undefined, { disabled: 'disponibile con la Fase D' })}
      {btn('record', 'Registra', undefined, { disabled: 'richiede consenso di entrambi: pianificato' })}
      {btn('addUser', 'Invita', undefined, { disabled: 'usa gli inviti dell’area docente' })}
      <button className="end-btn" onClick={onEnd}><UiIcon name="hangup" /> Termina</button>
      <Link to="/setup" className="ctrl" aria-label="Impostazioni dispositivi"><UiIcon name="settings" /><span>Setup</span></Link>
    </div>
  );
}

function ToolsPanel({ d }: { d: Discipline }) {
  return (
    <Panel icon="music" title="Strumenti didattici">
      <ul className="tool-list">
        {d.tools.map((t) => (
          <li key={t}>
            <UiIcon name={TOOL_STATE[t].icon} size={20} />
            <span>{TOOL_LABELS[t]}</span>
            {TOOL_STATE[t].state !== 'implemented' && <StatusBadge state={TOOL_STATE[t].state} />}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RoomPiano() {
  const synth = useRef<SimpleSynth | null>(null);
  const [active, setActive] = useState<Set<number>>(new Set());
  const s = () => (synth.current ??= new SimpleSynth());
  return (
    <Panel icon="music" title="Pianoforte (suono locale)" className="room-piano">
      <VirtualPiano
        from={48}
        to={84}
        active={active}
        onNoteOn={(n, v) => { s().noteOn(n, v); setActive((a) => new Set(a).add(n)); }}
        onNoteOff={(n) => { s().noteOff(n); setActive((a) => { const c = new Set(a); c.delete(n); return c; }); }}
      />
      <p className="dim small">Per ora suona solo su questo dispositivo; tastiera MIDI collegabile dallo Smart Setup. L’invio delle note all’allievo arriverà con la Fase D.</p>
    </Panel>
  );
}
