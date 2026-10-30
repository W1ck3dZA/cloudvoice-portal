import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileAudio, PlayCircle } from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { api, recordingsApi } from '../lib/api';
import type { Recording } from '../types/api';
import { usePlayer } from '../components/AudioPlayer';
import { Card, Empty, PageHeader, RowMain, Spinner } from '../components/UI';
import { HoldButton } from '../components/HoldButton';
export default function Recordings() {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ['recordings'],
    queryFn: recordingsApi.list,
  });
  const player = usePlayer();
  const del = useMutation({
    mutationFn: recordingsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recordings'] }),
  });
  function play(r: Recording) {
    player.play({
      recordingId: r.id,
      title: r.call_id ? `Call ${r.call_id}` : 'Recording',
      subtitle: [
        new Date(r.created_at).toLocaleString(),
        r.duration_seconds == null ? null : `${r.duration_seconds}s`,
        `${(r.size_bytes / 1024 / 1024).toFixed(2)} MB`,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  async function download(r: Recording) {
    const res = await api.get(`/v1/recordings/${r.id}/download`, {
      responseType: 'blob',
    });
    const u = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = u;
    a.download = `recording-${r.id}.wav`;
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <>
      <PageHeader
        title="Recordings"
        description="Listen to, download and delete call recordings."
      />
      <Card>
        {data.isLoading ? (
          <Spinner />
        ) : (data.data || []).length ? (
          <div className="table-wrap">
            <table className="rt">
              <thead>
                <tr>
                  <th>Call</th>
                  <th className="hide-md">Format</th>
                  <th>Duration</th>
                  <th className="hide-md">Size</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((r) => (
                  <tr key={r.id}>
                    <RowMain
                      title={new Date(r.created_at).toLocaleString()}
                      sub={[
                        r.duration_seconds == null
                          ? null
                          : `${r.duration_seconds}s`,
                        `${(r.size_bytes / 1024 / 1024).toFixed(2)} MB`,
                        r.call_id ? `call ${r.call_id}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {r.call_id || '—'}
                    </RowMain>
                    <td className="hide-md">{r.content_type}</td>
                    <td>
                      {r.duration_seconds == null
                        ? '—'
                        : `${r.duration_seconds}s`}
                    </td>
                    <td className="hide-md">
                      {(r.size_bytes / 1024 / 1024).toFixed(2)} MB
                    </td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td className="c-end">
                      <div className="row-actions">
                        <button
                          className="table-action"
                          onClick={() => play(r)}
                        >
                          <AnimatedIcon
                            icon={PlayCircle}
                            size={14}
                            animation="press"
                            trigger="click"
                          />{' '}
                          Play
                        </button>
                        <button
                          className="table-action wide-only"
                          onClick={() => download(r)}
                        >
                          <AnimatedIcon
                            icon={Download}
                            size={14}
                            animation="press"
                            trigger="click"
                          />{' '}
                          Download
                        </button>
                        <HoldButton
                          iconOnly
                          aria-label={`Delete the recording of call ${r.call_id}`}
                          onHold={() => del.mutate(r.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<FileAudio size={16} />}
            text="No recordings were returned."
          />
        )}
      </Card>
    </>
  );
}
