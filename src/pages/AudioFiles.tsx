import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Music, Play, PlayCircle, Upload } from 'lucide-react';
import { audioFilesApi, authApi, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { showToast } from '../lib/toast';
import type { AudioFile, Role } from '../types/api';
import {
  Card,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  PageHeader,
  Spinner,
} from '../components/UI';
import { usePlayer } from '../components/AudioPlayer';
import {
  CopyValue,
  DetailRow,
  DetailRows,
  DetailSection,
  DetailSummary,
  DetailView,
  DrawerActions,
} from '../components/Details';
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

const duration = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KiB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
const format = (f: AudioFile) =>
  (f.content_type.split('/')[1] || f.content_type)
    .replace(/^x-/, '')
    .replace(/^mpeg$/, 'mp3')
    .toUpperCase();

function AudioLibrary({ orgId, role }: { orgId: string; role?: Role | null }) {
  const qc = useQueryClient();
  const player = usePlayer();
  const [action, setAction] = useState<AudioAction | null>(null);
  const [viewing, setViewing] = useState<AudioFile | null>(null);
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
    try {
      await navigator.clipboard.writeText(url);
      showToast({ kind: 'success', message: 'Playback URL copied.' });
    } catch {
      showToast({
        kind: 'error',
        message: "Couldn't copy the URL. Open the file's details to copy it.",
      });
    }
  }
  const play = (f: AudioFile) =>
    player.play({
      src: f.url,
      title: f.name,
      subtitle: `${f.original_filename} · ${duration(f.duration_seconds)}`,
    });
  return (
    <>
      <PageHeader
        eyebrow="Voice"
        title="Audio files"
        description="Reusable prompts, greetings and hold music. Copy a file's playback URL into an application audio step or a call-center sound field."
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
      {!canManage && (
        <p className="muted">
          You have read-only access. An owner, admin or developer can upload,
          rename and delete audio files.
        </p>
      )}
      <Card className="audio-library">
        {rows.isLoading ? (
          <Spinner />
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
                  <th scope="col">Format</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Size</th>
                  <th scope="col" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <div className="cell-stack audio-name">
                        <strong>{file.name}</strong>
                        <span>{file.original_filename}</span>
                      </div>
                    </td>
                    <td>{format(file)}</td>
                    <td>{duration(file.duration_seconds)}</td>
                    <td>{size(file.size_bytes)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          aria-label={`Play ${file.name}`}
                          title="Play"
                          onClick={() => play(file)}
                        >
                          <PlayCircle size={18} />
                        </button>
                        <button
                          className="table-action"
                          onClick={() => void copy(file.url)}
                        >
                          Copy URL
                        </button>
                        <button
                          className="table-action"
                          onClick={() => setViewing(file)}
                        >
                          View <ChevronRight size={14} />
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
                ? 'Upload a greeting, prompt or hold music to get started.'
                : 'Audio uploaded by your team will appear here.'
            }
          />
        )}
      </Card>
      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Audio file details"
      >
        {viewing && (
          <DetailView>
            <DetailSummary
              kind="Audio file"
              title={viewing.name}
              subtitle={viewing.original_filename}
              facts={
                <>
                  <span>{format(viewing)}</span>
                  <span>{duration(viewing.duration_seconds)}</span>
                  <span>{size(viewing.size_bytes)}</span>
                </>
              }
            >
              <button className="btn primary" onClick={() => play(viewing)}>
                <Play size={15} fill="currentColor" /> Play
              </button>
              <button className="btn" onClick={() => void copy(viewing.url)}>
                Copy URL
              </button>
              <a
                className="btn"
                href={viewing.url}
                target="_blank"
                rel="noreferrer"
              >
                Open file
              </a>
            </DetailSummary>
            <DetailSection title="Playback URL">
              <DetailRows>
                <DetailRow label="URL">
                  <CopyValue value={viewing.url} label="playback URL" />
                </DetailRow>
              </DetailRows>
              <p className="dv-note dv-note-block">
                Paste it into an application audio step or a call-center sound
                field. Anyone with the URL can play this file, so share it only
                where it's needed.
              </p>
            </DetailSection>
            <DetailSection title="Details">
              <DetailRows>
                <DetailRow label="File ID">
                  <CopyValue value={viewing.id} label="file ID" />
                </DetailRow>
                <DetailRow label="Original file">
                  {viewing.original_filename}
                </DetailRow>
                <DetailRow label="Format">{format(viewing)}</DetailRow>
                <DetailRow label="Duration">
                  {duration(viewing.duration_seconds)}
                </DetailRow>
                <DetailRow label="Size">{size(viewing.size_bytes)}</DetailRow>
              </DetailRows>
            </DetailSection>
            {canManage && (
              <DrawerActions>
                <button
                  className="btn"
                  onClick={() => {
                    setAction({ mode: 'rename', file: viewing });
                    setViewing(null);
                  }}
                >
                  Rename
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    setAction({ mode: 'delete', file: viewing });
                    setViewing(null);
                  }}
                >
                  Delete
                </button>
              </DrawerActions>
            )}
          </DetailView>
        )}
      </Drawer>
      {action && canManage && (
        <AudioFileDialog
          action={action}
          orgId={orgId}
          onClose={() => setAction(null)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['audio-files', orgId] });
            if (
              action.mode === 'delete' &&
              player.track?.src === action.file.url
            ) {
              player.close();
            }
            showToast({
              kind: 'success',
              message:
                action.mode === 'upload'
                  ? 'Audio uploaded and ready to use.'
                  : action.mode === 'rename'
                    ? 'Audio renamed.'
                    : 'Audio deleted.',
            });
            setAction(null);
          }}
        />
      )}
    </>
  );
}
