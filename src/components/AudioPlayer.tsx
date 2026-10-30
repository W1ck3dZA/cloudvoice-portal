import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { AudioLines, Download, Pause, Play, X } from 'lucide-react';
import { AnimatedIcon } from './AnimatedIcon';
import { api } from '../lib/api';
// A player docked to the bottom of the page. Mounted once in the layout, so
// audio keeps playing while you move between pages. Call recordings need the
// auth header, so they're fetched as a blob and played from an object URL;
// audio files have a public playback URL and are played from it directly.
//
// iOS Safari only starts audio from inside a tap. A recording arrives after an
// async fetch, so one <audio> element lives here for good and play() starts a
// short silent clip on it during the tap; that unlocks the element, and the
// recording then plays on it once it has loaded.
export type Track = {
  title: string;
  subtitle?: string;
} & (
  { recordingId: string; src?: never } | { src: string; recordingId?: never }
);
const SILENCE =
  'data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
type PlayerCtx = {
  track: Track | null;
  play: (t: Track) => void;
  close: () => void;
};
const Ctx = createContext<PlayerCtx | null>(null);
export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer must be used inside PlayerProvider');
  return c;
}
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const play = (t: Track) => {
    const a = audioRef.current;
    if (a) {
      a.src = SILENCE;
      a.play().catch(() => {});
    }
    // On phones a drawer is a bottom sheet over the docked player, so close it.
    if (window.matchMedia('(max-width: 639px)').matches)
      document
        .querySelectorAll<HTMLDialogElement>('dialog.drawer[open]')
        .forEach((d) => d.close());
    setTrack(t);
  };
  const close = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    setTrack(null);
  };
  return (
    <Ctx.Provider value={{ track, play, close }}>
      {children}
      <audio ref={audioRef} preload="auto" playsInline hidden />
      {track && (
        <>
          <div className="player-spacer" aria-hidden="true" />
          <PlayerBar track={track} audioRef={audioRef} onClose={close} />
        </>
      )}
    </Ctx.Provider>
  );
}
const SPEEDS = [1, 1.5, 2];
/**
 * Safari plays an object URL only when the blob has an audio type, and
 * recordings are often stored as application/octet-stream. Read the first
 * bytes to find the format and retype the blob.
 */
async function asAudio(blob: Blob): Promise<Blob> {
  if (/^audio\//.test(blob.type)) return blob;
  const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const text = (from: number, to: number) =>
    String.fromCharCode(...b.slice(from, to));
  const type =
    text(0, 4) === 'RIFF' && text(8, 12) === 'WAVE'
      ? 'audio/wav'
      : text(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
        ? 'audio/mpeg'
        : text(0, 4) === 'OggS'
          ? 'audio/ogg'
          : text(4, 8) === 'ftyp'
            ? 'audio/mp4'
            : text(0, 4) === 'fLaC'
              ? 'audio/flac'
              : 'audio/wav';
  return new Blob([blob], { type });
}
const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
function PlayerBar({
  track,
  audioRef,
  onClose,
}: {
  track: Track;
  audioRef: RefObject<HTMLAudioElement | null>;
  onClose: () => void;
}) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    let url = '';
    let cancelled = false;
    setSrc('');
    setFailed(false);
    setPlaying(false);
    setTime(0);
    setDuration(0);
    if (track.src) {
      setSrc(track.src);
      return;
    }
    api
      .get(`/v1/recordings/${track.recordingId}/download`, {
        responseType: 'blob',
      })
      .then(async (res) => {
        const audio = await asAudio(res.data);
        if (cancelled) return;
        url = URL.createObjectURL(audio);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [track.recordingId, track.src]);
  // Load the track on the shared element and start it. The element was unlocked
  // by the tap that chose the track, so iOS lets this play.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !src) return;
    a.src = src;
    a.playbackRate = speed;
    a.play().catch(() => setPlaying(false));
    // Speed is applied separately below; only a new source restarts playback.
  }, [src, audioRef]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioRef]);
  // Mirror the element's state into the bar.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const real = () => !!src && a.currentSrc !== SILENCE;
    const onPlay = () => real() && setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => real() && setTime(a.currentTime);
    const onMeta = () =>
      real() && Number.isFinite(a.duration) && setDuration(a.duration);
    const onError = () => real() && setFailed(true);
    a.addEventListener('play', onPlay);
    a.addEventListener('playing', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onPause);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('playing', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onPause);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('error', onError);
    };
  }, [src, audioRef]);
  const loading = !src && !failed;
  const toggle = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const seek = (v: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = v;
    setTime(v);
  };
  const download = () => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    if (track.src) {
      // Cross-origin downloads ignore the filename, so open it instead.
      a.target = '_blank';
      a.rel = 'noreferrer';
    } else {
      a.download = `recording-${track.recordingId}.wav`;
    }
    a.click();
  };
  const progress = duration ? (time / duration) * 100 : 0;
  return (
    <section className="player-bar" aria-label="Audio player">
      <div className="player-meta">
        <span className="player-art" aria-hidden="true">
          <AudioLines size={18} />
        </span>
        <div className="player-copy">
          <strong>{track.title}</strong>
          {failed ? (
            <span className="player-error" role="alert">
              {track.src
                ? "The audio couldn't be played. The file may be unavailable."
                : "The recording couldn't be loaded. It may still be uploading."}
            </span>
          ) : (
            track.subtitle && <span>{track.subtitle}</span>
          )}
        </div>
      </div>
      <div className="player-controls">
        <button
          className="player-play"
          onClick={toggle}
          disabled={!src}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
        >
          {loading ? (
            <span className="player-spinner" aria-label="Loading" />
          ) : playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>
        <span className="player-time">{clock(time)}</span>
        <input
          className="player-seek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          disabled={!src || !duration}
          onChange={(e) => seek(+e.target.value)}
          aria-label="Seek"
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          style={{ ['--p' as string]: `${progress}%` }}
        />
        <span className="player-time">{clock(duration)}</span>
      </div>
      <div className="player-actions">
        <button
          className="player-speed"
          onClick={() =>
            setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])
          }
          aria-label={`Playback speed ${speed} times, change speed`}
          title="Playback speed"
        >
          {speed}×
        </button>
        <button
          className="icon-btn"
          onClick={download}
          disabled={!src}
          aria-label="Download"
          title="Download"
        >
          <AnimatedIcon
            icon={Download}
            size={18}
            animation="press"
            trigger="click"
          />
        </button>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close player"
          title="Close player"
        >
          <AnimatedIcon icon={X} size={18} animation="press" trigger="click" />
        </button>
      </div>
    </section>
  );
}
