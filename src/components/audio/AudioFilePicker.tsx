import { useRef, useState } from 'react';
import { FileAudio, Upload } from 'lucide-react';

export default function AudioFilePicker({
  file,
  disabled,
  onChange,
  onError,
}: {
  file: File | null;
  disabled: boolean;
  onChange: (file: File) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  function select(files: FileList | null) {
    if (disabled || !files?.length) return;
    if (files.length !== 1) {
      onError('Please choose one audio file at a time.');
      return;
    }
    const next = files[0];
    if (!/\.(wav|mp3|ogg|flac)$/i.test(next.name) || next.size === 0) {
      onError('Choose a non-empty WAV, MP3, Ogg, or FLAC file.');
      return;
    }
    onChange(next);
  }
  return (
    <div className="audio-file-picker">
      <span className="audio-file-label" id="audio-file-label">
        Audio file
      </span>
      <input
        ref={input}
        type="file"
        hidden
        accept=".wav,.mp3,.ogg,.flac"
        disabled={disabled}
        onChange={(event) => {
          select(event.target.files);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        className={`audio-dropzone${dragging && !disabled ? ' is-dragging' : ''}`}
        disabled={disabled}
        aria-labelledby="audio-file-label audio-file-action"
        aria-describedby="audio-file-formats audio-file-selection"
        onClick={() => input.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) {
            dragDepth.current++;
            setDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          select(event.dataTransfer.files);
        }}
      >
        <span className="audio-dropzone-icon" aria-hidden="true">
          {file ? <FileAudio size={24} /> : <Upload size={24} />}
        </span>
        <strong id="audio-file-action">
          {dragging && !disabled
            ? 'Drop your audio file here'
            : file
              ? 'Drop another file or click to replace'
              : 'Drag and drop or click to choose'}
        </strong>
        <span className="muted" id="audio-file-formats">
          WAV, MP3, Ogg, or FLAC
        </span>
      </button>
      <div
        id="audio-file-selection"
        className="audio-file-selection"
        role="status"
      >
        {file && (
          <>
            <strong>{file.name}</strong>
            <span className="muted">
              {file.size < 1024 * 1024
                ? `${(file.size / 1024).toFixed(1)} KiB`
                : `${(file.size / 1024 / 1024).toFixed(1)} MiB`}{' '}
              · Ready to upload
            </span>
          </>
        )}
      </div>
      <small className="muted">
        Default limits: 50 MiB and 30 minutes; your server may use different
        limits.
      </small>
    </div>
  );
}
