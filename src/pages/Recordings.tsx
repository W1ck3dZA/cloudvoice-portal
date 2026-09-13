import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileAudio, PlayCircle } from 'lucide-react';
import { api, recordingsApi } from '../lib/api';
import type { Recording } from '../types/api';
import {
  Card,
  Drawer,
  Empty,
  PageHeader,
  RowActions,
  Spinner,
} from '../components/UI';
export default function Recordings() {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ['recordings'],
    queryFn: recordingsApi.list,
  });
  const [selected, setSelected] = useState<Recording | null>(null);
  const [audio, setAudio] = useState('');
  const del = useMutation({
    mutationFn: recordingsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recordings'] }),
  });
  async function play(r: Recording) {
    setSelected(r);
    const res = await api.get(`/v1/recordings/${r.id}/download`, {
      responseType: 'blob',
    });
    setAudio(URL.createObjectURL(res.data));
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
        eyebrow="Voice"
        title="Recordings"
        description="Listen to, download and delete call recordings."
      />
      <Card>
        {data.isLoading ? (
          <Spinner />
        ) : (data.data || []).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Call</th>
                  <th>Format</th>
                  <th>Duration</th>
                  <th>Size</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((r) => (
                  <tr key={r.id}>
                    <td>{r.call_id || '—'}</td>
                    <td>{r.content_type}</td>
                    <td>
                      {r.duration_seconds == null
                        ? '—'
                        : `${r.duration_seconds}s`}
                    </td>
                    <td>{(r.size_bytes / 1024 / 1024).toFixed(2)} MB</td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          onClick={() => play(r)}
                        >
                          <PlayCircle size={14} /> Play
                        </button>
                        <button
                          className="table-action"
                          onClick={() => download(r)}
                        >
                          <Download size={14} /> Download
                        </button>
                        <button
                          className="table-action danger-text"
                          onClick={() =>
                            confirm('Delete this recording?') &&
                            del.mutate(r.id)
                          }
                        >
                          Delete
                        </button>
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
      <Drawer
        open={!!selected}
        onClose={() => {
          setSelected(null);
          if (audio) URL.revokeObjectURL(audio);
          setAudio('');
        }}
        title="Recording player"
      >
        {selected && (
          <>
            <div className="recording-card">
              <strong>Call {selected.call_id || '—'}</strong>
              <span>
                {selected.duration_seconds || 0}s ·{' '}
                {(selected.size_bytes / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            {audio ? (
              <audio controls autoPlay src={audio} className="audio-player" />
            ) : (
              <Spinner />
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
