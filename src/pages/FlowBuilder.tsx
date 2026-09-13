import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  GitBranch,
  GripVertical,
  Headphones,
  MessageSquareText,
  Pause,
  PhoneForwarded,
  Play,
  Reply,
  Save,
  Trash2,
  UsersRound,
  Volume2,
} from 'lucide-react';
import { appsApi, errorMessage, queuesApi } from '../lib/api';
import type { Verb } from '../types/api';
import { ErrorBox, Field, Spinner, Toggle } from '../components/UI';
type Path = (string | number)[];
const catalog = [
  ['play', 'Play audio', Play],
  ['gather', 'Gather digits', GitBranch],
  ['dial', 'Dial', PhoneForwarded],
  ['listen', 'Record / Listen', Headphones],
  ['pause', 'Pause', Pause],
  ['say', 'Say text', MessageSquareText],
  ['queue', 'Queue', UsersRound],
  ['hangup', 'Hang up', Volume2],
  ['respond', 'Respond', Reply],
] as const;
const defaults: Record<string, () => Verb> = {
  play: () => ({ verb: 'play', url: '' }),
  gather: () => ({
    verb: 'gather',
    input: ['digits'],
    numDigits: 1,
    timeoutSecs: 5,
    finishOnKey: '#',
    branches: {},
    defaultVerbs: [],
  }),
  dial: () => ({
    verb: 'dial',
    target: '',
    timeoutSecs: 30,
    answerOnBridge: false,
  }),
  listen: () => ({
    verb: 'listen',
    url: '',
    maxLengthSecs: 3600,
    playBeep: false,
  }),
  pause: () => ({ verb: 'pause', length: 1 }),
  say: () => ({ verb: 'say', text: '' }),
  hangup: () => ({ verb: 'hangup', reason: 'NORMAL_CLEARING' }),
  respond: () => ({ verb: 'respond', code: 486, reason: 'Busy Here' }),
  queue: () => ({
    verb: 'queue',
    queue_id: '',
    maxWaitSecs: 600,
    answeredVerbs: [],
    timeoutVerbs: [],
    abandonVerbs: [],
  }),
};
function getFlow(root: Verb[], path: Path): Verb[] {
  let cur: any = root;
  for (const p of path) {
    cur = cur?.[p as any];
    if (!cur) return [];
  }
  return Array.isArray(cur) ? cur : [];
}
function setFlow(root: Verb[], path: Path, next: Verb[]): Verb[] {
  if (!path.length) return next;
  const copy = structuredClone(root) as any;
  let cur: any = copy;
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i];
    if (cur[p as any] == null)
      cur[p as any] = typeof path[i + 1] === 'number' ? [] : {};
    cur = cur[p as any];
  }
  cur[path[path.length - 1] as any] = next;
  return copy;
}
function label(v: Verb) {
  switch (v.verb) {
    case 'play':
      return String(v.url || 'Choose audio URL');
    case 'gather':
      return `Collect ${v.numDigits || v.maxDigits || 'DTMF'} digit(s)`;
    case 'dial':
      return v.target || 'Set dial target';
    case 'listen':
      return v.url || 'Set recording path';
    case 'pause':
      return `${v.length}s`;
    case 'say':
      return v.text || 'Enter text';
    case 'queue':
      return v.queue_id || 'Choose queue';
    case 'hangup':
      return v.reason || 'NORMAL_CLEARING';
    case 'respond':
      return `${v.code} ${v.reason}`.trim() || 'Set response code';
  }
}
export default function FlowBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const app = useQuery({
    queryKey: ['app', id],
    queryFn: () => appsApi.get(id!),
    enabled: !!id,
  });
  const queues = useQuery({ queryKey: ['queues'], queryFn: queuesApi.list });
  const [root, setRoot] = useState<Verb[]>([]);
  const [path, setPath] = useState<Path>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (app.data) {
      setRoot(structuredClone(app.data.flow || []));
      setDirty(false);
    }
  }, [app.data]);
  const current = getFlow(root, path);
  const node = selected == null ? null : current[selected];
  const save = useMutation({
    mutationFn: () => appsApi.update(id!, { flow: root }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['apps'] });
      qc.invalidateQueries({ queryKey: ['app', id] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  function updateCurrent(next: Verb[]) {
    setRoot((r) => setFlow(r, path, next));
    setDirty(true);
  }
  function add(type: string) {
    updateCurrent([...current, defaults[type]()]);
    setSelected(current.length);
  }
  function patch(p: any) {
    if (selected == null) return;
    const next = [...current];
    next[selected] = { ...next[selected], ...p } as Verb;
    updateCurrent(next);
  }
  function remove(i: number) {
    updateCurrent(current.filter((_, x) => x !== i));
    setSelected(null);
  }
  function move(i: number, d: number) {
    const n = i + d;
    if (n < 0 || n >= current.length) return;
    const next = [...current];
    [next[i], next[n]] = [next[n], next[i]];
    updateCurrent(next);
    setSelected(n);
  }
  function drill(childPath: Path) {
    setPath([...path, ...childPath]);
    setSelected(null);
  }
  const crumbs = useMemo(() => {
    const out = [{ label: 'Main flow', path: [] as Path }];
    let p: Path = [];
    for (let i = 0; i < path.length; i++) {
      p = [...p, path[i]];
      if (
        typeof path[i] === 'string' &&
        ['answeredVerbs', 'timeoutVerbs', 'abandonVerbs'].includes(
          String(path[i]),
        )
      )
        out.push({ label: String(path[i]).replace('Verbs', ''), path: [...p] });
      if (i > 0 && path[i - 1] === 'branches')
        out.push({ label: `DTMF ${path[i]}`, path: [...p] });
    }
    return out;
  }, [path]);
  if (app.isLoading) return <Spinner />;
  if (!app.data) return <ErrorBox message="Application not found" />;
  return (
    <div className="flow-builder-page">
      <header className="builder-top">
        <button className="btn" onClick={() => nav('/applications')}>
          <ArrowLeft size={15} /> Applications
        </button>
        <div>
          <span className="eyebrow">Application flow</span>
          <h1>{app.data.name}</h1>
        </div>
        <div className="builder-save">
          <span className={dirty ? 'unsaved' : 'saved'}>
            {dirty ? 'Unsaved changes' : `Version ${app.data.version}`}
          </span>
          <button
            className="btn primary"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            <Save size={15} />
            {save.isPending ? 'Saving…' : 'Save flow'}
          </button>
        </div>
      </header>
      <ErrorBox message={err} />
      <div className="builder-shell">
        <aside className="verb-palette">
          <div className="palette-title">Nodes</div>
          {catalog.map(([type, name, Icon]) => (
            <button key={type} onClick={() => add(type)}>
              <span>
                <Icon size={17} />
              </span>
              <div>
                <strong>{name}</strong>
                <small>{type}</small>
              </div>
              <ChevronRight size={14} />
            </button>
          ))}
        </aside>
        <section className="builder-canvas">
          <div className="flow-breadcrumbs">
            {crumbs.map((c, i) => (
              <button
                key={i}
                onClick={() => {
                  setPath(c.path);
                  setSelected(null);
                }}
              >
                {c.label}
                {i < crumbs.length - 1 && <ChevronRight size={12} />}
              </button>
            ))}
          </div>
          <div className="canvas-flow">
            <div className="canvas-entry">
              <span />
              Incoming call
            </div>
            {current.map((v, i) => (
              <div
                draggable
                className={'canvas-node ' + (selected === i ? 'selected' : '')}
                key={`${v.verb}-${i}`}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex != null && dragIndex !== i) {
                    const next = [...current];
                    const [item] = next.splice(dragIndex, 1);
                    next.splice(i, 0, item);
                    updateCurrent(next);
                    setSelected(i);
                  }
                  setDragIndex(null);
                }}
                onClick={() => setSelected(i)}
              >
                <div className="node-rail" title="Drag to reorder">
                  <GripVertical size={15} />
                </div>
                <div className={`node-type verb-${v.verb}`}>{v.verb}</div>
                <div className="node-copy">
                  <strong>
                    {catalog.find((x) => x[0] === v.verb)?.[1] || v.verb}
                  </strong>
                  <span>{label(v)}</span>
                </div>
                <div className="node-buttons">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      move(i, -1);
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      move(i, 1);
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className="danger-text"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(i);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!current.length && (
              <div className="canvas-empty">
                <GitBranch />
                <h3>This branch is empty</h3>
                <p>Add a node from the palette.</p>
              </div>
            )}
            <div className="canvas-exit">End</div>
          </div>
        </section>
        <aside className="node-inspector">
          {node ? (
            <Inspector
              node={node}
              patch={patch}
              drill={drill}
              queues={queues.data || []}
            />
          ) : (
            <div className="inspector-empty">
              <strong>Node inspector</strong>
              <p>
                Select a flow node to configure it. Every field maps directly to
                the application verb schema.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
function Inspector({
  node,
  patch,
  drill,
  queues,
}: {
  node: Verb;
  patch: (p: any) => void;
  drill: (p: Path) => void;
  queues: any[];
}) {
  const [branch, setBranch] = useState('');
  return (
    <div className="inspector-form">
      <div className="inspector-head">
        <span className="eyebrow">Configure node</span>
        <h2>{node.verb}</h2>
      </div>
      {node.verb === 'play' && (
        <>
          <Field label="Audio URL">
            <input
              value={Array.isArray(node.url) ? node.url.join(',') : node.url}
              onChange={(e) => patch({ url: e.target.value })}
            />
          </Field>
          <Field label="Loop count">
            <input
              type="number"
              min="1"
              max="100"
              value={node.loop || 1}
              onChange={(e) => patch({ loop: +e.target.value })}
            />
          </Field>
          <Field label="Timeout seconds">
            <input
              type="number"
              min="1"
              max="3600"
              value={node.timeoutSecs || ''}
              onChange={(e) =>
                patch({
                  timeoutSecs: e.target.value ? +e.target.value : undefined,
                })
              }
            />
          </Field>
          <Field label="Seek offset (samples)">
            <input
              type="number"
              min="0"
              value={node.seekOffset || ''}
              onChange={(e) =>
                patch({
                  seekOffset: e.target.value ? +e.target.value : undefined,
                })
              }
            />
          </Field>
          <Toggle
            checked={!!node.earlyMedia}
            onChange={(v) => patch({ earlyMedia: v })}
            label="Play as early media"
          />
        </>
      )}
      {node.verb === 'dial' && (
        <>
          <Field label="FreeSWITCH dial target">
            <input
              value={node.target}
              onChange={(e) => patch({ target: e.target.value })}
              placeholder="sofia/gateway/main/+2711…"
            />
          </Field>
          <Field label="Caller ID">
            <input
              value={node.callerId || ''}
              onChange={(e) => patch({ callerId: e.target.value })}
            />
          </Field>
          <Field label="Caller ID name">
            <input
              value={node.callerIdName || ''}
              onChange={(e) => patch({ callerIdName: e.target.value })}
            />
          </Field>
          <Field label="Timeout seconds">
            <input
              type="number"
              value={node.timeoutSecs || 30}
              onChange={(e) => patch({ timeoutSecs: +e.target.value })}
            />
          </Field>
          <Toggle
            checked={!!node.answerOnBridge}
            onChange={(v) => patch({ answerOnBridge: v })}
            label="Answer on bridge"
          />
        </>
      )}
      {node.verb === 'pause' && (
        <Field label="Length (seconds)">
          <input
            type="number"
            step="0.05"
            min="0.05"
            value={node.length}
            onChange={(e) => patch({ length: +e.target.value })}
          />
        </Field>
      )}
      {node.verb === 'say' && (
        <>
          <Field label="Text">
            <textarea
              rows={5}
              value={node.text}
              onChange={(e) => patch({ text: e.target.value })}
            />
          </Field>
          <Field label="Voice">
            <input
              value={node.voice || ''}
              onChange={(e) => patch({ voice: e.target.value })}
            />
          </Field>
          <Field label="Language">
            <input
              value={node.language || ''}
              onChange={(e) => patch({ language: e.target.value })}
            />
          </Field>
          <div className="note">
            The API currently marks the Say/TTS verb as a runtime stub. The
            builder still preserves its configuration.
          </div>
        </>
      )}
      {node.verb === 'listen' && (
        <>
          <Field label="Recording path / URL">
            <input
              value={node.url}
              onChange={(e) => patch({ url: e.target.value })}
            />
          </Field>
          <Field label="Max length seconds">
            <input
              type="number"
              value={node.maxLengthSecs || 3600}
              onChange={(e) => patch({ maxLengthSecs: +e.target.value })}
            />
          </Field>
          <Field label="Finish on key">
            <input
              maxLength={1}
              value={node.finishOnKey || ''}
              onChange={(e) => patch({ finishOnKey: e.target.value })}
            />
          </Field>
          <Toggle
            checked={!!node.playBeep}
            onChange={(v) => patch({ playBeep: v })}
            label="Play beep"
          />
        </>
      )}
      {node.verb === 'hangup' && (
        <>
          <Field label="Reason / SIP cause">
            <input
              value={node.reason || ''}
              onChange={(e) => patch({ reason: e.target.value })}
            />
          </Field>
          <Field label="Headers (JSON)">
            <textarea
              rows={6}
              value={JSON.stringify(node.headers || {}, null, 2)}
              onChange={(e) => {
                try {
                  patch({ headers: JSON.parse(e.target.value) });
                } catch {}
              }}
            />
          </Field>
        </>
      )}
      {node.verb === 'respond' && (
        <>
          <Field label="SIP status code" hint="e.g. 486, 603">
            <input
              type="number"
              min="100"
              max="699"
              value={node.code}
              onChange={(e) => patch({ code: +e.target.value })}
            />
          </Field>
          <Field label="Reason phrase" hint="e.g. 'Busy Here'">
            <input
              maxLength={255}
              value={node.reason}
              onChange={(e) => patch({ reason: e.target.value })}
            />
          </Field>
        </>
      )}
      {node.verb === 'gather' && (
        <>
          <Field
            label="Exact digit count"
            hint="Sets numDigits; leave blank to use min/max instead"
          >
            <input
              type="number"
              min="1"
              max="32"
              value={node.numDigits || ''}
              onChange={(e) =>
                patch({
                  numDigits: e.target.value ? +e.target.value : undefined,
                })
              }
            />
          </Field>
          <div className="form-grid">
            <Field label="Minimum digits">
              <input
                type="number"
                min="0"
                max="32"
                value={node.minDigits ?? ''}
                onChange={(e) =>
                  patch({
                    minDigits: e.target.value ? +e.target.value : undefined,
                  })
                }
              />
            </Field>
            <Field label="Maximum digits">
              <input
                type="number"
                min="1"
                max="32"
                value={node.maxDigits ?? ''}
                onChange={(e) =>
                  patch({
                    maxDigits: e.target.value ? +e.target.value : undefined,
                  })
                }
              />
            </Field>
          </div>
          <Field label="Prompt URL">
            <input
              value={typeof node.prompt === 'string' ? node.prompt : ''}
              onChange={(e) => patch({ prompt: e.target.value })}
            />
          </Field>
          <Field label="Timeout seconds">
            <input
              type="number"
              step="0.1"
              value={node.timeoutSecs || 5}
              onChange={(e) => patch({ timeoutSecs: +e.target.value })}
            />
          </Field>
          <Field label="Finish key">
            <input
              maxLength={1}
              value={node.finishOnKey || '#'}
              onChange={(e) => patch({ finishOnKey: e.target.value })}
            />
          </Field>
          <Field label="Repeat on invalid">
            <input
              type="number"
              min="0"
              max="10"
              value={node.repeatOnInvalid || 0}
              onChange={(e) => patch({ repeatOnInvalid: +e.target.value })}
            />
          </Field>
          <div className="branch-section">
            <strong>DTMF branches</strong>
            {Object.keys(node.branches || {}).map((k) => (
              <div className="branch-row" key={k}>
                <button
                  className="branch-link grow"
                  onClick={() => drill(['branches', k])}
                >
                  Digits “{k}”{' '}
                  <span>{node.branches?.[k]?.length || 0} nodes</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  className="icon-btn danger-text"
                  type="button"
                  title="Delete branch"
                  onClick={() => {
                    const b = { ...(node.branches || {}) };
                    delete b[k];
                    patch({ branches: b });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="inline-add">
              <input
                placeholder="Digits, e.g. 1"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
              <button
                className="btn"
                type="button"
                onClick={() => {
                  if (!branch) return;
                  patch({
                    branches: {
                      ...(node.branches || {}),
                      [branch]: node.branches?.[branch] || [],
                    },
                  });
                  setBranch('');
                }}
              >
                Add branch
              </button>
            </div>
            <button
              className="branch-link"
              onClick={() => drill(['defaultVerbs'])}
            >
              Default / invalid branch{' '}
              <span>{node.defaultVerbs?.length || 0} nodes</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
      {node.verb === 'queue' && (
        <>
          <Field label="Queue">
            <select
              value={node.queue_id}
              onChange={(e) => patch({ queue_id: e.target.value })}
            >
              <option value="">Select queue…</option>
              {queues.map((q) => (
                <option value={q.id} key={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Max wait seconds">
            <input
              type="number"
              min="1"
              max="7200"
              value={node.maxWaitSecs || 600}
              onChange={(e) => patch({ maxWaitSecs: +e.target.value })}
            />
          </Field>
          <div className="branch-section">
            <strong>Outcome branches</strong>
            <button
              className="branch-link"
              onClick={() => drill(['answeredVerbs'])}
            >
              Answered <span>{node.answeredVerbs?.length || 0} nodes</span>
              <ChevronRight size={14} />
            </button>
            <button
              className="branch-link"
              onClick={() => drill(['timeoutVerbs'])}
            >
              Timeout <span>{node.timeoutVerbs?.length || 0} nodes</span>
              <ChevronRight size={14} />
            </button>
            <button
              className="branch-link"
              onClick={() => drill(['abandonVerbs'])}
            >
              Abandoned <span>{node.abandonVerbs?.length || 0} nodes</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
