import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  DISCIPLINES, TOOL_LABELS, getDiscipline, isDisciplineId,
  type Discipline, type DisciplineId, type FeatureState, type TeachingTool,
} from '@fpm/shared';
import { DisciplineIcon } from '../components/Icons.js';
import { IpadLink } from '../components/IpadLink.js';
import { StatusBadge } from '../components/Layout.js';
import { UiIcon, type IconName } from '../components/UiIcon.js';
import { VirtualPiano } from '../components/VirtualPiano.js';
import {
  AudioMonitor, BreathingPanel, DevicePanel, MetronomePanel, MulticamPanel, Panel, SheetPanel, Tuner,
} from '../components/Widgets.js';
import { IS_DEMO } from '../demo/env.js';
import { get } from '../lib/api.js';
import { SimpleSynth } from '../lib/audio.js';
import { useLesson, type DataMsg, type LessonState, type LessonStats } from '../lib/useLesson.js';
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
  archi: 'Violino e Archi',
  fiati: 'Flauto e Fiati',
  teoria: 'Teoria e Composizione',
};

const STATE_TEXT: Record<LessonState, string> = {
  idle: 'Non collegato',
  waiting: 'In attesa dell’altra persona',
  connecting: 'Collegamento in corso…',
  connected: 'In diretta',
  reconnecting: 'Riconnessione…',
  failed: 'Collegamento non riuscito',
  closed: 'Lezione chiusa',
  forbidden: 'Accesso alla lezione non consentito',
};

interface Peer { linkId: string; name: string }

export function LessonRoom() {
  const { me, loading } = useSession();
  const [params, setParams] = useSearchParams();
  const [profileDiscipline, setProfileDiscipline] = useState<DisciplineId | null>(null);
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const media = useLocalMedia();
  const navigate = useNavigate();
  const [cams, setCams] = useState<1 | 2 | 4>(1);
  const [remoteNotes, setRemoteNotes] = useState<Set<number>>(new Set());
  const synth = useRef<SimpleSynth | null>(null);
  const s = () => (synth.current ??= new SimpleSynth());

  // Disciplina e collegamenti disponibili per questa persona
  useEffect(() => {
    if (!me) return;
    if (me.role === 'teacher') {
      get<{ discipline: DisciplineId | null }>('/api/teacher/profile').then((p) => setProfileDiscipline(p.discipline)).catch(() => {});
      get<{ id: string; status: string; studentName: string }[]>('/api/teacher/links')
        .then((l) => {
          const ok = l.filter((x) => x.status === 'approved').map((x) => ({ linkId: x.id, name: x.studentName }));
          setPeers(ok);
          setLinkId((cur) => cur ?? ok[0]?.linkId ?? null);
        })
        .catch(() => setPeers([]));
    } else {
      get<{ discipline: DisciplineId | null }>('/api/student/teacher').then((p) => setProfileDiscipline(p.discipline)).catch(() => {});
      get<{ id: string; status: string; teacherName: string } | null>('/api/student/link')
        .then((l) => {
          const ok = l && l.status === 'approved' ? [{ linkId: l.id, name: l.teacherName }] : [];
          setPeers(ok);
          setLinkId(ok[0]?.linkId ?? null);
        })
        .catch(() => setPeers([]));
    }
  }, [me]);

  // Note ricevute dall'altra persona (pianoforte/tastiera MIDI remota)
  const onData = useCallback((m: DataMsg) => {
    if (m.t === 'n') {
      if (m.on) s().noteOn(m.note, m.vel);
      else s().noteOff(m.note);
      setRemoteNotes((prev) => {
        const c = new Set(prev);
        if (m.on) c.add(m.note);
        else c.delete(m.note);
        return c;
      });
    } else if (m.t === 'p') {
      s().setSustain(m.on);
    }
  }, []);

  const lesson = useLesson(joined && !IS_DEMO ? linkId : null, media.stream, onData);

  if (loading) return <p>Caricamento…</p>;
  if (!me) return <Navigate to="/accedi?modo=login" replace />;

  const q = params.get('d') ?? '';
  const id: DisciplineId = isDisciplineId(q) ? q : profileDiscipline ?? 'canto';
  const d = getDiscipline(id)!;
  const teacher = me.role === 'teacher';
  const drums = d.video.kind === 'drums-multicam';
  const peerName = peers?.find((p) => p.linkId === linkId)?.name ?? '';
  const teacherName = teacher ? me.displayName : peerName;
  const studentName = teacher ? peerName : me.displayName;

  async function start() {
    await media.start();
    setJoined(true);
  }

  return (
    <div className="room">
      <div className="room-banner">
        <span className="rule" aria-hidden="true" />
        <DisciplineIcon id={d.id} className="room-banner-icon" />
        <h1 className="display-caps">{ROOM_TITLE[d.id]}</h1>
        <span className="rule" aria-hidden="true" />
      </div>

      <div className="lesson-bar">
        <span className={`live-pill ${lesson.state}`} data-testid="lesson-state">
          <i className="dot" /> {IS_DEMO ? 'Demo: collegamento non disponibile' : STATE_TEXT[lesson.state]}
        </span>
        {teacher && peers && peers.length > 0 && (
          <label className="field-inline">
            <UiIcon name="users" size={18} />
            <select value={linkId ?? ''} onChange={(e) => setLinkId(e.target.value)} aria-label="Allievo della lezione" disabled={joined}>
              {peers.map((p) => <option key={p.linkId} value={p.linkId}>{p.name}</option>)}
            </select>
          </label>
        )}
        <select className="room-switch" value={d.id} onChange={(e) => setParams({ d: e.target.value })} aria-label="Disciplina della stanza">
          {DISCIPLINES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <StatsChips stats={lesson.stats} />
        {lesson.transport === 'polling' && lesson.state === 'connected' && (
          <span className="stats-chips"><span title="Il canale WebSocket non era disponibile: si usa HTTP">canale di riserva</span></span>
        )}
      </div>

      {peers && peers.length === 0 && (
        <div className="alert warn">
          {teacher
            ? <>Nessun allievo collegato: crea un invito in <Link to="/docente">Allievi e Calendario</Link> e approva la richiesta.</>
            : <>Non hai ancora un docente approvato: inserisci il codice in <Link to="/allievo">Le mie lezioni</Link>.</>}
        </div>
      )}
      {lesson.state === 'forbidden' && <div className="alert error">Il collegamento con questa persona non è più attivo.</div>}

      <div className="room-grid">
        <div className="stage-wrap">
          <Stage
            media={media}
            remote={lesson.remote}
            teacher={teacher}
            teacherName={teacherName}
            studentName={studentName}
            state={lesson.state}
            cams={drums ? cams : 1}
            views={d.video.kind === 'drums-multicam' ? d.video.views : []}
            onStart={start}
            canStart={!!linkId || IS_DEMO}
          />
          <ControlBar media={media} onEnd={() => { media.stop(); setJoined(false); navigate(teacher ? '/docente' : '/allievo'); }} />
          <ToolTabs d={d} />
          <div className="widgets">
            {(d.tools.includes('intonazione') || d.tools.includes('accordatore')) && (
              <div id="w-tuner"><Tuner media={media} title={d.id === 'canto' ? 'Intonazione' : 'Accordatore'} /></div>
            )}
            {d.tools.includes('respirazione') && <div id="w-breath"><BreathingPanel /></div>}
            <div id="w-metro"><MetronomePanel initialBpm={drums ? 120 : 80} /></div>
            <AudioMonitor media={media} remote={lesson.remote} localLabel={teacher ? 'Insegnante (tu)' : 'Allievo (tu)'} remoteLabel={teacher ? 'Allievo' : 'Insegnante'} />
          </div>
        </div>
        <aside className="room-side">
          {teacher && <IpadLink compact={lesson.state === 'connected'} />}
          {drums && <MulticamPanel count={cams} setCount={setCams} views={d.video.kind === 'drums-multicam' ? d.video.views : []} />}
          {!drums && <div id="w-sheet"><SheetPanel /></div>}
          <ToolsPanel d={d} />
          <DevicePanel media={media} />
        </aside>
      </div>

      {d.midiRelevant && !drums && (
        <div id="w-piano">
          <RoomPiano remoteNotes={remoteNotes} connected={lesson.state === 'connected'} send={lesson.sendData} synth={s} />
        </div>
      )}

      <div id="w-backing">
        <Panel icon="play" title="Basi musicali sincronizzate" state="planned" className="backing">
          <div className="backing-bar" aria-disabled="true">
            <button className="play-btn" disabled aria-label="Riproduci base (non ancora disponibile)"><UiIcon name="play" /></button>
            <span className="dim">00:00 / 00:00</span>
            <div className="wave-placeholder" aria-hidden="true" />
            <span className="dim small">Caricamento WAV/MP3 e comandi sincronizzati: Fase E</span>
          </div>
        </Panel>
      </div>

      <p className="room-motto" aria-hidden="true">Tecnica · Espressione · Interpretazione · Repertorio</p>
    </div>
  );
}

function StatsChips({ stats }: { stats: LessonStats }) {
  if (stats.rttMs === null && stats.jitterMs === null) return null;
  return (
    <span className="stats-chips" data-testid="lesson-stats" title="Misure reali della connessione WebRTC">
      {stats.rttMs !== null && <span>Ritardo {stats.rttMs} ms</span>}
      {stats.jitterMs !== null && <span>Jitter {stats.jitterMs} ms</span>}
      {stats.lossPct !== null && <span>Persi {stats.lossPct}%</span>}
      {stats.path && <span>{stats.path}</span>}
      {stats.videoKbps !== null && <span>Video {stats.videoKbps} kbit/s</span>}
    </span>
  );
}

function VideoTile({ stream, muted, label, live, mirror, className = '', children, testId }: {
  stream?: MediaStream | null; muted?: boolean; label: string; live?: boolean; mirror?: boolean; className?: string; children?: React.ReactNode; testId?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream ?? null;
    if (stream) v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
  }, [stream]);
  return (
    <div className={`tile ${className}`} data-testid={testId}>
      {stream ? <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? 'mirror' : ''} /> : <div className="tile-empty">{children}</div>}
      <span className="tile-label gold-pill"><UiIcon name="user" size={15} /> {label} <i className={`dot${live ? ' live' : ''}`} /></span>
      {needsTap && (
        <button className="btn small primary tap-audio" onClick={() => ref.current?.play().then(() => setNeedsTap(false)).catch(() => {})}>
          Tocca per attivare l’audio
        </button>
      )}
    </div>
  );
}

function Stage({ media, remote, teacher, teacherName, studentName, state, cams, views, onStart, canStart }: {
  media: LocalMedia; remote: MediaStream | null; teacher: boolean; teacherName: string; studentName: string; state: LessonState;
  cams: 1 | 2 | 4; views: readonly string[]; onStart: () => void; canStart: boolean;
}) {
  // Come nelle anteprime: Insegnante nel riquadro grande, Allievo nel riquadro piccolo (scambiabili).
  const [swap, setSwap] = useState(false);
  const local = media.camOn ? media.stream : null;
  const teacherStream = teacher ? local : remote;
  const studentStream = teacher ? remote : local;
  const waiting = (
    <>
      <UiIcon name="user" size={30} />
      <span>{state === 'connecting' ? 'Collegamento…' : teacher ? 'In attesa dell’allievo' : 'In attesa del docente'}</span>
    </>
  );
  const tileFor = (who: 'teacher' | 'student', cls: string) => {
    const isLocal = (who === 'teacher') === teacher;
    const label = who === 'teacher' ? `Insegnante${teacherName ? `: ${teacherName}` : ''}` : `Allievo${studentName ? `: ${studentName}` : ''}`;
    const stream = who === 'teacher' ? teacherStream : studentStream;
    return (
      <VideoTile
        key={who}
        stream={stream}
        muted={isLocal}
        mirror={isLocal}
        label={label}
        live={isLocal ? !!media.stream : state === 'connected'}
        className={cls}
        testId={isLocal ? 'local-tile' : 'remote-tile'}
      >
        {isLocal ? <><UiIcon name="camOff" size={36} /><span>Videocamera spenta</span></> : waiting}
      </VideoTile>
    );
  };

  if (!media.stream) {
    return (
      <div className="stage">
        <div className="stage-start">
          <UiIcon name="cam" size={44} />
          <p>{canStart ? 'Attiva videocamera e microfono per entrare in lezione.' : 'Serve un collegamento docente–allievo approvato.'}</p>
          <button className="btn primary" onClick={onStart} disabled={!canStart} data-testid="room-start">Attiva videocamera e microfono</button>
          {media.error && <p className="error-text" role="alert">{media.error}</p>}
        </div>
      </div>
    );
  }
  if (cams > 1) {
    return (
      <>
        <div className="stage multicam" data-cams={cams}>
          {Array.from({ length: cams }, (_, i) =>
            i === 0 ? (
              <VideoTile key={i} stream={local} muted mirror label={`${views[0]} · ${teacher ? 'Insegnante' : 'Allievo'}`} live>
                <UiIcon name="camOff" size={34} /><span>Videocamera spenta</span>
              </VideoTile>
            ) : (
              <VideoTile key={i} label={`${views[i] ?? `Camera ${i + 1}`}`}>
                <UiIcon name="cam" size={30} /><span>Camera aggiuntiva</span><small className="dim">Fase G</small>
              </VideoTile>
            ),
          )}
        </div>
        <div className="remote-strip">{tileFor(teacher ? 'student' : 'teacher', 'pip')}</div>
      </>
    );
  }
  const big: 'teacher' | 'student' = swap ? 'student' : 'teacher';
  const small: 'teacher' | 'student' = swap ? 'teacher' : 'student';
  return (
    <div className="stage">
      {tileFor(big, 'main')}
      {tileFor(small, 'pip')}
      <button className="icon-btn swap-btn" onClick={() => setSwap((x) => !x)} aria-label="Scambia riquadri"><UiIcon name="loop" size={20} /></button>
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
      {btn('screen', 'Condividi', undefined, { disabled: 'pianificato' })}
      {btn('record', 'Registra', undefined, { disabled: 'richiede consenso di entrambi: pianificato' })}
      <button className="end-btn" onClick={onEnd}><UiIcon name="hangup" /> Termina lezione</button>
      <Link to="/setup" className="ctrl" aria-label="Impostazioni dispositivi"><UiIcon name="settings" /><span>Setup</span></Link>
    </div>
  );
}

/** Barra degli strumenti in basso, come nelle anteprime: porta al pannello corrispondente. */
function ToolTabs({ d }: { d: Discipline }) {
  const tabs: { id: string; label: string; icon: IconName; target: string; state?: FeatureState }[] = [];
  if (d.tools.includes('intonazione')) tabs.push({ id: 'into', label: 'Intonazione', icon: 'tuner', target: 'w-tuner' });
  if (d.tools.includes('accordatore')) tabs.push({ id: 'acc', label: 'Accordatore', icon: 'tuner', target: 'w-tuner' });
  if (d.tools.includes('respirazione')) tabs.push({ id: 'resp', label: 'Respirazione', icon: 'breath', target: 'w-breath' });
  tabs.push({ id: 'metro', label: 'Metronomo', icon: 'metronome', target: 'w-metro' });
  if (d.midiRelevant && d.video.kind !== 'drums-multicam') tabs.push({ id: 'piano', label: 'Pianoforte', icon: 'music', target: 'w-piano' });
  if (d.video.kind !== 'drums-multicam') tabs.push({ id: 'sheet', label: 'Spartiti', icon: 'sheet', target: 'w-sheet' });
  tabs.push({ id: 'basi', label: 'Basi Musicali', icon: 'play', target: 'w-backing', state: 'planned' });
  if (d.tools.includes('vocalizzi')) tabs.push({ id: 'voc', label: 'Vocalizzi', icon: 'wave', target: 'w-backing', state: 'planned' });
  return (
    <nav className="tool-tabs" aria-label="Strumenti della lezione">
      {tabs.map((t, i) => (
        <button key={t.id} className={`tool-tab${i === 0 ? ' on' : ''}${t.state === 'planned' ? ' planned' : ''}`} onClick={() => document.getElementById(t.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
          <UiIcon name={t.icon} />
          <span>{t.label}</span>
          {t.state === 'planned' && <small>presto</small>}
        </button>
      ))}
    </nav>
  );
}

function ToolsPanel({ d }: { d: Discipline }) {
  return (
    <Panel icon="music" title="Percorso e strumenti">
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

function RoomPiano({ remoteNotes, connected, send, synth }: {
  remoteNotes: Set<number>; connected: boolean;
  send: (m: { t: 'n'; on: boolean; note: number; vel: number }) => boolean; synth: () => SimpleSynth;
}) {
  const [local, setLocal] = useState<Set<number>>(new Set());
  const active = new Set([...local, ...remoteNotes]);
  return (
    <Panel icon="music" title={connected ? 'Pianoforte condiviso (MIDI in diretta)' : 'Pianoforte'} className="room-piano">
      <VirtualPiano
        from={48}
        to={84}
        active={active}
        onNoteOn={(n, v) => { synth().noteOn(n, v); send({ t: 'n', on: true, note: n, vel: v }); setLocal((a) => new Set(a).add(n)); }}
        onNoteOff={(n) => { synth().noteOff(n); send({ t: 'n', on: false, note: n, vel: 0 }); setLocal((a) => { const c = new Set(a); c.delete(n); return c; }); }}
      />
      <p className="dim small">
        {connected
          ? 'Le note che suoni arrivano all’altro dispositivo come eventi MIDI (nota, dinamica) e suonano lì in locale: i tasti dorati mostrano anche le note ricevute. Il ritardo dipende dalla rete.'
          : 'Suona in locale; in lezione le note vengono inviate all’altra persona.'}
      </p>
    </Panel>
  );
}
