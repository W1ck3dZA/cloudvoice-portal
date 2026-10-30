import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Call } from '../types/api';
import { Drawer, Spinner } from './UI';
// Plays a call's recording in a drawer. The download needs the auth header,
// so the audio is fetched as a blob rather than used as a plain src.
export function RecordingPlayer({
  call,
  onClose,
}: {
  call: Call | null;
  onClose: () => void;
}) {
  const [audio, setAudio] = useState('');
  const [failed, setFailed] = useState(false);
  const id = call?.recording_id;
  useEffect(() => {
    if (!id) return;
    let url = '';
    let cancelled = false;
    setAudio('');
    setFailed(false);
    api
      .get(`/v1/recordings/${id}/download`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        url = URL.createObjectURL(res.data);
        setAudio(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return (
    <Drawer
      open={!!call?.recording_id}
      onClose={onClose}
      title="Recording player"
      subtitle={call ? `${call.from_number} to ${call.to_number}` : undefined}
    >
      {call && (
        <>
          <div className="recording-card">
            <strong>{new Date(call.initiated_at).toLocaleString()}</strong>
            <span>
              {call.duration_seconds == null
                ? '—'
                : `${call.duration_seconds}s`}
            </span>
          </div>
          {failed ? (
            <p className="muted" role="alert">
              The recording couldn't be loaded. It may still be uploading; try
              again in a minute.
            </p>
          ) : audio ? (
            <audio controls autoPlay src={audio} className="audio-player" />
          ) : (
            <Spinner />
          )}
        </>
      )}
    </Drawer>
  );
}
