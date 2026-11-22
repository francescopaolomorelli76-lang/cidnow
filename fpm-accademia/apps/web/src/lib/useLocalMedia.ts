import { useCallback, useEffect, useRef, useState } from 'react';
import { audioContext } from './audio.js';
import { loadLocalPrefs, mediaErrorMessage, saveLocalPrefs } from './device.js';

/**
 * Microfono + videocamera di QUESTO dispositivo (anteprima locale).
 * Espone un AnalyserNode condiviso da misuratore, accordatore e intonazione.
 * Nessun dato lascia il dispositivo: l'invio all'altra persona arriverà con WebRTC (Fase D).
 */
export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [musicMode, setMusicMode] = useState(true);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(
    async (opts: { audioId?: string; videoId?: string; video?: boolean } = {}) => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Questo browser non permette l’accesso a microfono e videocamera (serve HTTPS o un browser aggiornato).');
        return;
      }
      const prefs = loadLocalPrefs();
      const audioId = opts.audioId ?? prefs.audioInputId;
      const videoId = opts.videoId ?? prefs.videoInputId;
      stop();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(audioId ? { deviceId: { ideal: audioId } } : {}),
            echoCancellation: !musicMode,
            noiseSuppression: !musicMode,
            autoGainControl: !musicMode,
          },
          video:
            opts.video === false
              ? false
              : { ...(videoId ? { deviceId: { ideal: videoId } } : {}), width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = s;
        const ac = audioContext();
        const analyser = ac.createAnalyser();
        analyser.fftSize = 4096;
        ac.createMediaStreamSource(s).connect(analyser);
        analyserRef.current = analyser;
        setDevices(await navigator.mediaDevices.enumerateDevices());
        const a = s.getAudioTracks()[0]?.getSettings().deviceId;
        const v = s.getVideoTracks()[0]?.getSettings().deviceId;
        saveLocalPrefs({ ...loadLocalPrefs(), ...(a ? { audioInputId: a } : {}), ...(v ? { videoInputId: v } : {}) });
        setMicOn(true);
        setCamOn(opts.video !== false);
        setStream(s);
      } catch (e) {
        setError(mediaErrorMessage(e));
      }
    },
    [musicMode, stop],
  );

  useEffect(() => stop, [stop]);

  const toggleMic = useCallback(() => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMicOn(t.enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setCamOn(t.enabled);
  }, []);

  return {
    stream,
    error,
    micOn,
    camOn,
    devices,
    musicMode,
    setMusicMode,
    analyser: analyserRef,
    start,
    stop,
    toggleMic,
    toggleCam,
    currentAudioId: stream?.getAudioTracks()[0]?.getSettings().deviceId ?? '',
    currentVideoId: stream?.getVideoTracks()[0]?.getSettings().deviceId ?? '',
  };
}

export type LocalMedia = ReturnType<typeof useLocalMedia>;

/** Esegue `fn` a ogni frame finché il componente è montato. */
export function useAnimationFrame(fn: () => void, active: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = () => {
      ref.current();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}
