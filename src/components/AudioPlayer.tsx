import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AudioLines, Download, Pause, Play, X } from 'lucide-react';
import { api } from '../lib/api';
// A player docked to the bottom of the page. Mounted once in the layout, so a
// recording keeps playing while you move between pages. Recordings need the
// auth header, so each one is fetched as a blob and played from an object URL.
export type Track = {
  recordingId: string;
  title: string;
  subtitle?: string;
};
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
  const value = { track, play: setTrack, close: () => setTrack(null) };
  return (
    <Ctx.Provider value={value}>
      {children}
      {track && (
        <>
          <div className="player-spacer" aria-hidden="true" />
          <PlayerBar track={track} onClose={value.close} />
        </>
      )}
    </Ctx.Provider>
  );
}
const SPEEDS = [1, 1.5, 2];
const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
function PlayerBar({ track, onClose }: { track: Track; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
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
    api
      .get(`/v1/recordings/${track.recordingId}/download`, {
        responseType: 'blob',
      })
      .then((res) => {
        if (cancelled) return;
        url = URL.createObjectURL(res.data);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [track.recordingId]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, src]);
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
    a.download = `recording-${track.recordingId}.wav`;
    a.click();
  };
  const progress = duration ? (time / duration) * 100 : 0;
  return (
    <section className="player-bar" aria-label="Recording player">
      <audio
        ref={audioRef}
        src={src || undefined}
        autoPlay
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onError={() => src && setFailed(true)}
      />
      <div className="player-meta">
        <span className="player-art" aria-hidden="true">
          <AudioLines size={18} />
        </span>
        <div className="player-copy">
          <strong>{track.title}</strong>
          {failed ? (
            <span className="player-error" role="alert">
              The recording couldn't be loaded. It may still be uploading.
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
          aria-label="Download recording"
          title="Download recording"
        >
          <Download size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close player"
          title="Close player"
        >
          <X size={18} />
        </button>
      </div>
    </section>
  );
}
