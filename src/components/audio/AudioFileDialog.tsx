import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { audioFilesApi, errorMessage } from '../../lib/api';
import type { AudioFile } from '../../types/api';
import { ErrorBox, Field } from '../UI';
import AudioFilePicker from './AudioFilePicker';

export type AudioAction =
  { mode: 'upload' } | { mode: 'rename' | 'delete'; file: AudioFile };
export default function AudioFileDialog({
  action,
  orgId,
  onClose,
  onSaved,
}: {
  action: AudioAction;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(
    action.mode === 'upload' ? '' : action.file.name,
  );
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [validation, setValidation] = useState('');
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const save = useMutation({
    mutationFn: async () => {
      if (action.mode === 'delete')
        return audioFilesApi.remove(action.file.id, orgId);
      if (action.mode === 'rename')
        return audioFilesApi.rename(action.file.id, name.trim(), orgId);
      return audioFilesApi.upload(file!, name, orgId, setProgress);
    },
    onSuccess: onSaved,
  });
  const title =
    action.mode === 'upload'
      ? 'Upload audio'
      : action.mode === 'rename'
        ? 'Rename audio'
        : 'Delete audio';
  return (
    <dialog
      ref={dialog}
      className="audio-dialog"
      aria-labelledby="audio-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!save.isPending) onClose();
      }}
    >
      <div className="audio-dialog-heading">
        <h2 id="audio-dialog-title">{title}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="Close dialog"
          disabled={save.isPending}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <form
        className="audio-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          setValidation('');
          if (
            action.mode === 'upload' &&
            (!file ||
              !/\.(wav|mp3|ogg|flac)$/i.test(file.name) ||
              file.size === 0)
          ) {
            setValidation('Choose a non-empty WAV, MP3, Ogg, or FLAC file.');
            return;
          }
          if (action.mode === 'rename' && !name.trim()) {
            setValidation('Enter a name.');
            return;
          }
          setProgress(0);
          save.mutate();
        }}
      >
        {action.mode === 'delete' ? (
          <p>
            Delete “{action.file.name}”? Its playback URL will stop working.
            Update any applications and call-center sounds using it before
            deleting. This cannot be undone.
          </p>
        ) : (
          <>
            {action.mode === 'upload' && (
              <AudioFilePicker
                file={file}
                disabled={save.isPending}
                onChange={(next) => {
                  setFile(next);
                  setValidation('');
                  save.reset();
                }}
                onError={setValidation}
              />
            )}
            <Field
              label={action.mode === 'upload' ? 'Name (optional)' : 'Name'}
              hint={
                action.mode === 'rename'
                  ? 'Renaming keeps the same playback URL.'
                  : 'Leave blank to use the filename.'
              }
            >
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={255}
                required={action.mode === 'rename'}
                disabled={save.isPending}
              />
            </Field>
            {action.mode === 'upload' && (
              <p className="muted">
                Audio is converted to WAV for playback. To replace an existing
                sound, upload a new file and update its URL in your
                applications.
              </p>
            )}
          </>
        )}
        <div role="alert">
          <ErrorBox
            message={
              validation ||
              (save.isError
                ? (save.error as { response?: { status: number } }).response
                    ?.status === 503
                  ? 'The audio processor is busy. Please retry later.'
                  : errorMessage(save.error)
                : '')
            }
          />
        </div>
        {save.isPending && action.mode === 'upload' && (
          <div role="status">
            <progress
              className="audio-progress"
              value={progress}
              max={100}
              aria-label="Upload progress"
            />
            <p>
              {progress < 100
                ? `Uploading… ${progress}%`
                : 'Processing audio… This may take up to a minute.'}
            </p>
          </div>
        )}
        <div className="button-row">
          <button
            type="button"
            className="btn"
            disabled={save.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`btn ${action.mode === 'delete' ? 'danger' : 'primary'}`}
            disabled={save.isPending}
          >
            {save.isPending ? 'Please wait…' : title}
          </button>
        </div>
      </form>
    </dialog>
  );
}
