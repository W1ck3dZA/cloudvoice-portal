import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Music, Upload } from 'lucide-react';
import { audioFilesApi, authApi, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import type { AudioFile, Role } from '../types/api';
import { Card, Empty, ErrorBox, Field, PageHeader } from '../components/UI';
import AudioFileDialog, {
  type AudioAction,
} from '../components/audio/AudioFileDialog';

export default function AudioFiles() {
  const { session } = useSession();
  const [selectedOrg, setSelectedOrg] = useState('');
  const organisations = useQuery({
    queryKey: ['audio-organisations', session?.user.id],
    queryFn: authApi.organisations,
    enabled: !session?.orgId,
  });
  const orgId = session?.orgId || selectedOrg;
  const organisation = organisations.data?.find((org) => org.id === orgId);
  const role = session?.orgId ? session.role : organisation?.role;
  return (
    <>
      {!session?.orgId && (
        <Card>
          <Field label="Organisation">
            <select
              value={selectedOrg}
              onChange={(event) => setSelectedOrg(event.target.value)}
            >
              <option value="">Select an organisation</option>
              {organisations.data
                ?.filter((org) => org.status === 'active')
                .map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
            </select>
          </Field>
          {organisations.isLoading && (
            <p role="status">Loading organisations…</p>
          )}
          {organisations.isError && (
            <>
              <ErrorBox message={errorMessage(organisations.error)} />
              <button className="btn" onClick={() => organisations.refetch()}>
                Retry
              </button>
            </>
          )}
        </Card>
      )}
      {orgId ? (
        <AudioLibrary key={orgId} orgId={orgId} role={role} />
      ) : (
        <PageHeader
          eyebrow="Voice"
          title="Audio files"
          description="Select an organisation to manage its prompts, greetings, and hold music."
        />
      )}
    </>
  );
}

function AudioLibrary({ orgId, role }: { orgId: string; role?: Role | null }) {
  const qc = useQueryClient();
  const [action, setAction] = useState<AudioAction | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const canManage =
    role === 'owner' || role === 'admin' || role === 'developer';
  const pageSize = 50;
  const rows = useQuery({
    queryKey: ['audio-files', orgId],
    queryFn: async () => {
      const files: AudioFile[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = await audioFilesApi.list(orgId, pageSize, offset);
        files.push(...page);
        if (page.length < pageSize) return files;
      }
    },
  });
  const files = rows.data || [];
  async function copy(url: string) {
    setError('');
    setNotice('');
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Playback URL copied.');
    } catch {
      setError(
        'Could not copy the URL. Select and copy it from the preview below.',
      );
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Voice"
        title="Audio files"
        description="Reusable prompts, greetings, and hold music for your organisation."
        action={
          canManage && (
            <button
              className="btn primary"
              onClick={() => setAction({ mode: 'upload' })}
            >
              <Upload size={16} /> Upload audio
            </button>
          )
        }
      />
      <p className="muted">
        Use a playback URL in application audio steps or call-center sound
        fields. Anyone with the URL can play that file; share it only where
        needed.
      </p>
      {!canManage && (
        <p className="muted">
          You have read-only access. An owner, admin, or developer can manage
          audio files.
        </p>
      )}
      <p role="status">{notice}</p>
      <div role="alert">
        <ErrorBox message={error} />
      </div>
      <Card className="audio-library">
        {rows.isLoading ? (
          <div role="status" className="audio-loading">
            Loading audio files…
          </div>
        ) : rows.isError ? (
          <div role="alert">
            <ErrorBox message={errorMessage(rows.error)} />
            <button className="btn" onClick={() => rows.refetch()}>
              Retry
            </button>
          </div>
        ) : files.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Size</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td className="audio-name">
                      <strong>{file.name}</strong>
                      <span className="muted">{file.original_filename}</span>
                      {preview === file.id && (
                        <div className="audio-preview">
                          <audio
                            controls
                            preload="none"
                            src={file.url}
                            aria-label={`Preview ${file.name}`}
                            onError={() =>
                              setError(
                                'Audio could not be played. The file may be unavailable; try refreshing the library.',
                              )
                            }
                          />
                          <Field label="Playback URL">
                            <input
                              readOnly
                              value={file.url}
                              onFocus={(event) => event.target.select()}
                            />
                          </Field>
                          <a
                            className="table-action"
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open WAV file
                          </a>
                        </div>
                      )}
                    </td>
                    <td>
                      {Math.floor(file.duration_seconds / 60)}:
                      {String(Math.floor(file.duration_seconds % 60)).padStart(
                        2,
                        '0',
                      )}
                    </td>
                    <td>
                      {file.size_bytes < 1024 * 1024
                        ? `${(file.size_bytes / 1024).toFixed(1)} KiB`
                        : `${(file.size_bytes / 1024 / 1024).toFixed(1)} MiB`}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          aria-expanded={preview === file.id}
                          onClick={() => {
                            setError('');
                            setPreview(preview === file.id ? null : file.id);
                          }}
                        >
                          {preview === file.id ? 'Close preview' : 'Preview'}
                        </button>
                        <button
                          className="table-action"
                          onClick={() => {
                            setPreview(file.id);
                            void copy(file.url);
                          }}
                        >
                          Copy URL
                        </button>
                        {canManage && (
                          <>
                            <button
                              className="table-action"
                              onClick={() =>
                                setAction({ mode: 'rename', file })
                              }
                            >
                              Rename
                            </button>
                            <button
                              className="table-action danger-text"
                              onClick={() =>
                                setAction({ mode: 'delete', file })
                              }
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Music size={16} />}
            title="No audio files yet"
            text={
              canManage
                ? 'Upload a greeting, prompt, or hold music to get started.'
                : 'Audio uploaded by your team will appear here.'
            }
          />
        )}
      </Card>
      {action && canManage && (
        <AudioFileDialog
          action={action}
          orgId={orgId}
          onClose={() => setAction(null)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['audio-files', orgId] });
            if (action.mode === 'delete') {
              setPreview(null);
            }
            setNotice(
              action.mode === 'upload'
                ? 'Audio uploaded and ready to use.'
                : action.mode === 'rename'
                  ? 'Audio renamed.'
                  : 'Audio deleted.',
            );
            setError('');
            setAction(null);
          }}
        />
      )}
    </>
  );
}
