import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  Plus,
  Reply,
  Save,
  UsersRound,
  Voicemail,
  Volume2,
  X,
} from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import {
  appsApi,
  errorMessage,
  gatewaysApi,
  queuesApi,
  sipUsersApi,
} from '../lib/api';
import type { CallTarget, SipGateway, SipUser, Verb } from '../types/api';
import { ErrorBox, Field, Spinner, Toggle } from '../components/UI';
import { HoldButton } from '../components/HoldButton';
type Path = (string | number)[];
const catalog = [
  ['play', 'Play audio', Play],
  ['gather', 'Gather digits', GitBranch],
  ['amd', 'Detect machine', Voicemail],
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
  amd: () => ({
    verb: 'amd',
    branches: { human: [], machine: [], unknown: [] },
  }),
  dial: () => ({
    verb: 'dial',
    to: { type: 'phone', number: '', gateway_id: '' },
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
const AMD_BRANCH_LABEL: Record<string, string> = {
  human: 'Human',
  machine: 'Machine',
  unknown: 'Not sure',
};
// Blank means the platform default, shown as the placeholder.
const AMD_FIELDS = [
  [
    'initialSilence',
    'Initial silence',
    2500,
    'Milliseconds. Longest silence before someone speaks',
  ],
  [
    'greeting',
    'Greeting length',
    1500,
    'Milliseconds. Longest greeting a person gives',
  ],
  [
    'afterGreetingSilence',
    'Silence after greeting',
    800,
    'Milliseconds. A pause this long after the greeting means a person',
  ],
  [
    'totalAnalysisTime',
    'Total analysis time',
    5000,
    'Milliseconds. Longest time to spend deciding',
  ],
  [
    'maxWords',
    'Maximum words',
    3,
    'Hearing this many words before a pause means a machine',
  ],
] as const;
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
function dialLabel(to?: CallTarget) {
  if (to?.type === 'phone') return to.number || 'Set number';
  if (to?.type === 'sip') return to.sip_uri || 'Set SIP URI';
  if (to?.type === 'user') return to.user || 'Choose SIP user';
  return 'Set destination';
}
function label(v: Verb) {
  switch (v.verb) {
    case 'play':
      return String(v.url || 'Choose audio URL');
    case 'gather':
      return `Collect ${v.numDigits || v.maxDigits || 'DTMF'} digit(s)`;
    case 'amd':
      return 'Person or answering machine';
    case 'dial':
      return dialLabel(v.to);
    case 'listen':
      return v.url || 'Set recording path';
    case 'pause':
      return `${v.length}s`;
    case 'say':
      return v.text || 'Enter text';
    case 'queue':
      return v.queue_id || 'Choose queue';
    case 'hangup':
      return (
        HANGUP_CAUSES.find(
          ([code]) => code === (v.reason || 'NORMAL_CLEARING'),
        )?.[1] ?? v.reason
      );
    case 'respond':
      return `${v.code} ${v.reason}`.trim() || 'Set response code';
  }
}
/** Where a node's branches live, in the order they're drawn. Flow carries on to the next node after a branch. */
function outputsOf(v: Verb): { key: Path; label: string }[] {
  if (v.verb === 'amd')
    return (['human', 'machine', 'unknown'] as const).map((b) => ({
      key: ['branches', b],
      label: AMD_BRANCH_LABEL[b],
    }));
  if (v.verb === 'gather')
    return [
      ...Object.keys(v.branches || {}).map((k) => ({
        key: ['branches', k],
        label: `Pressed ${k}`,
      })),
      { key: ['defaultVerbs'], label: 'No match' },
    ];
  if (v.verb === 'queue')
    return [
      { key: ['answeredVerbs'], label: 'Answered' },
      { key: ['timeoutVerbs'], label: 'Timed out' },
      { key: ['abandonVerbs'], label: 'Caller hung up' },
    ];
  return [];
}
/** A list that ends the call itself: its last step hangs up or responds. */
const endsCall = (items: Verb[]) =>
  ['hangup', 'respond'].includes(items[items.length - 1]?.verb);
const samePath = (a: Path | null, b: Path | null) =>
  !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
const verbName = (v: Verb) =>
  catalog.find((x) => x[0] === v.verb)?.[1] || v.verb;
const verbIcon = (v: Verb) => catalog.find((x) => x[0] === v.verb)?.[2] || Play;

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
  const gateways = useQuery({
    queryKey: ['gateways'],
    queryFn: gatewaysApi.list,
  });
  const sipUsers = useQuery({
    queryKey: ['sip-users'],
    queryFn: sipUsersApi.list,
  });
  const [root, setRoot] = useState<Verb[]>([]);
  // The selected node's full path, e.g. [0, 'branches', 'human', 1].
  const [sel, setSel] = useState<Path | null>(null);
  // The list the palette adds to: after the selected node if it's in this list, else at the end.
  const [active, setActive] = useState<Path>([]);
  // The list whose inline "Add step" picker is open.
  const [picker, setPicker] = useState<Path | null>(null);
  const [drag, setDrag] = useState<Path | null>(null);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState('');
  const canvasRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (app.data) {
      setRoot(structuredClone(app.data.flow || []));
      setDirty(false);
    }
  }, [app.data]);
  useEffect(() => {
    const c = canvasRef.current;
    if (c && app.data) c.scrollLeft = (c.scrollWidth - c.clientWidth) / 2;
  }, [app.data]);
  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const draw = () =>
      c.querySelectorAll<HTMLElement>('.fc-outputs').forEach((o) => {
        const bar = o.querySelector<HTMLElement>(':scope > .fc-join');
        if (!bar) return;
        const xs = [
          ...o.querySelectorAll<HTMLElement>(':scope > .fc-branch.joins'),
        ].map((b) => b.offsetLeft + b.offsetWidth / 2);
        if (!xs.length) {
          bar.style.display = 'none';
          return;
        }
        xs.push(o.clientWidth / 2);
        const from = Math.min(...xs);
        const to = Math.max(...xs);
        bar.style.display = to - from < 2 ? 'none' : '';
        bar.style.left = `${from - 1}px`;
        bar.style.width = `${to - from + 2}px`;
      });
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  });
  const node = sel
    ? getFlow(root, sel.slice(0, -1))[sel[sel.length - 1] as number]
    : null;
  const save = useMutation({
    mutationFn: () => appsApi.update(id!, { flow: root }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['apps'] });
      qc.invalidateQueries({ queryKey: ['app', id] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  function updateList(list: Path, next: Verb[]) {
    setRoot((r) => setFlow(r, list, next));
    setDirty(true);
  }
  function insert(list: Path, type: string) {
    const items = getFlow(root, list);
    const at =
      sel && samePath(sel.slice(0, -1), list)
        ? (sel[sel.length - 1] as number) + 1
        : items.length;
    updateList(list, [
      ...items.slice(0, at),
      defaults[type](),
      ...items.slice(at),
    ]);
    setSel([...list, at]);
    setActive(list);
    setPicker(null);
  }
  function patch(p: any) {
    if (!sel || !node) return;
    const list = sel.slice(0, -1);
    const i = sel[sel.length - 1] as number;
    const next = [...getFlow(root, list)];
    next[i] = { ...next[i], ...p } as Verb;
    updateList(list, next);
  }
  function remove(path: Path) {
    const list = path.slice(0, -1);
    const i = path[path.length - 1] as number;
    updateList(
      list,
      getFlow(root, list).filter((_, x) => x !== i),
    );
    setSel(null);
    setActive(list);
  }
  function move(path: Path, d: number) {
    const list = path.slice(0, -1);
    const i = path[path.length - 1] as number;
    const items = [...getFlow(root, list)];
    const n = i + d;
    if (n < 0 || n >= items.length) return;
    [items[i], items[n]] = [items[n], items[i]];
    updateList(list, items);
    setSel([...list, n]);
  }
  // Drag to reorder within the same list.
  function drop(onto: Path) {
    if (!drag) return;
    const list = onto.slice(0, -1);
    if (samePath(drag.slice(0, -1), list) && !samePath(drag, onto)) {
      const items = [...getFlow(root, list)];
      const [item] = items.splice(drag[drag.length - 1] as number, 1);
      items.splice(onto[onto.length - 1] as number, 0, item);
      updateList(list, items);
      setSel(onto);
    }
    setDrag(null);
  }
  // The inspector's branch buttons point the palette at that branch.
  function focusBranch(childPath: Path) {
    if (!sel) return;
    setActive([...sel, ...childPath]);
  }
  function describe(list: Path) {
    if (!list.length) return 'the main flow';
    const parent = getFlow(root, list.slice(0, -2))[
      list[list.length - 2] as number
    ];
    const key = list[list.length - 1];
    const out =
      list[list.length - 2] === 'branches'
        ? undefined
        : outputsOf(parent || ({} as Verb)).find((o) => o.key[0] === key);
    if (out) return `${out.label}`;
    // branches/<name>: the parent node sits three steps up.
    const owner = getFlow(root, list.slice(0, -3))[
      list[list.length - 3] as number
    ];
    return (
      outputsOf(owner || ({} as Verb)).find(
        (o) => o.key[1] === key && o.key[0] === 'branches',
      )?.label ?? 'this branch'
    );
  }
  const addTarget =
    sel && samePath(sel.slice(0, -1), active) && node
      ? `after ${verbName(node)}`
      : `to ${describe(active)}`;

  // `after`: a step runs once this list finishes (the next step in an enclosing list). Without one the call ends.
  function renderList(list: Path, after: boolean): ReactNode {
    const items = getFlow(root, list);
    const isTarget = samePath(active, list);
    const last = items[items.length - 1];
    // The trailing Add step only connects up if something flows down to it.
    const lastOuts = last ? outputsOf(last) : [];
    const lastJoins =
      !lastOuts.length ||
      (after &&
        lastOuts.some(
          (o) =>
            !endsCall(getFlow(root, [...list, items.length - 1, ...o.key])),
        ));
    return (
      <div className="fc-list">
        {items.map((v, i) => {
          const p = [...list, i];
          const outs = outputsOf(v);
          const Icon = verbIcon(v);
          const next = i < items.length - 1 || after;
          return (
            <div className="fc-step" key={`${v.verb}-${i}`}>
              <div
                draggable
                className={
                  'canvas-node fc-node ' + (samePath(sel, p) ? 'selected' : '')
                }
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDrag(p);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  drop(p);
                }}
                onClick={() => {
                  setSel(p);
                  setActive(list);
                }}
              >
                <div className="node-rail" title="Drag to reorder">
                  <GripVertical size={15} />
                </div>
                <span className={`fc-icon verb-${v.verb}`} aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div className="node-copy">
                  <strong>{verbName(v)}</strong>
                  <span>{label(v)}</span>
                </div>
                <div className="node-buttons">
                  <button
                    aria-label={`Move ${verbName(v)} up`}
                    title="Move up"
                    disabled={i === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(p, -1);
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    aria-label={`Move ${verbName(v)} down`}
                    title="Move down"
                    disabled={i === items.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(p, 1);
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <span onClick={(e) => e.stopPropagation()}>
                    <HoldButton
                      iconOnly
                      aria-label={`Remove ${verbName(v)}${outs.length ? ' and its branches' : ''}`}
                      onHold={() => remove(p)}
                    />
                  </span>
                </div>
              </div>
              {outs.length > 0 && (
                <div className="fc-outputs">
                  {outs.map((o) => {
                    const bp = [...p, ...o.key];
                    const kids = getFlow(root, bp);
                    const stops = endsCall(kids);
                    const joins = next && !stops;
                    return (
                      <div
                        className={'fc-branch' + (joins ? ' joins' : '')}
                        key={o.key.join('.')}
                      >
                        <span className="fc-out">{o.label}</span>
                        {renderList(bp, next)}
                        {joins ? (
                          <span className="fc-fill" aria-hidden="true" />
                        ) : (
                          !stops && <span className="fc-stop">End</span>
                        )}
                      </div>
                    );
                  })}
                  <span className="fc-join" aria-hidden="true" />
                </div>
              )}
            </div>
          );
        })}
        <div className={'fc-add-wrap' + (lastJoins ? '' : ' detached')}>
          <button
            type="button"
            className={
              'fc-add' +
              (isTarget && !samePath(sel?.slice(0, -1) ?? null, list)
                ? ' target'
                : '')
            }
            aria-expanded={samePath(picker, list)}
            onClick={() => {
              setActive(list);
              setSel(null);
              setPicker(samePath(picker, list) ? null : list);
            }}
          >
            <Plus size={14} aria-hidden="true" /> Add step
          </button>
          {samePath(picker, list) && (
            <div className="fc-picker" role="menu">
              {catalog.map(([type, name, Icon]) => (
                <button
                  key={type}
                  role="menuitem"
                  onClick={() => insert(list, type)}
                >
                  <Icon size={15} aria-hidden="true" />
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (app.isLoading) return <Spinner />;
  if (!app.data) return <ErrorBox message="Application not found" />;
  return (
    <div className="flow-builder-page">
      <header className="builder-top">
        <button
          className="btn"
          onClick={() => nav('/applications')}
          aria-label="Back to applications"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span className="bt-label">Applications</span>
        </button>
        <div>
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
            <AnimatedIcon
              icon={Save}
              size={15}
              animation="press"
              trigger="click"
            />
            {save.isPending ? 'Saving…' : 'Save flow'}
          </button>
        </div>
      </header>
      <ErrorBox message={err} />
      <div className="builder-shell">
        <aside className="verb-palette">
          <div className="palette-title">Add {addTarget}</div>
          {catalog.map(([type, name, Icon]) => (
            <button key={type} onClick={() => insert(active, type)}>
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
        <section
          ref={canvasRef}
          className="builder-canvas"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSel(null);
              setPicker(null);
            }
          }}
        >
          <div className="fc">
            <div className="canvas-entry">Incoming call</div>
            {renderList([], false)}
            {!(root.length && outputsOf(root[root.length - 1]).length) && (
              <div className="canvas-exit">End</div>
            )}
          </div>
        </section>
        <aside className={'node-inspector ' + (node ? 'is-open' : 'is-empty')}>
          {node && (
            <button
              type="button"
              className="icon-btn inspector-close"
              aria-label="Close the inspector"
              title="Close"
              onClick={() => setSel(null)}
            >
              <X size={18} />
            </button>
          )}
          {node ? (
            <Inspector
              key={sel!.join('.')}
              node={node}
              patch={patch}
              drill={focusBranch}
              queues={queues.data || []}
              gateways={gateways.data || []}
              sipUsers={sipUsers.data || []}
            />
          ) : (
            <div className="inspector-empty">
              <strong>Node inspector</strong>
              <p>
                Select a step to configure it. Steps with outcomes, such as
                Detect machine, Gather digits and Queue, branch on the canvas;
                each branch carries on to the next step when it ends.
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
  gateways,
  sipUsers,
}: {
  node: Verb;
  patch: (p: any) => void;
  drill: (p: Path) => void;
  queues: any[];
  gateways: SipGateway[];
  sipUsers: SipUser[];
}) {
  const [branch, setBranch] = useState('');
  return (
    <div className="inspector-form">
      <div className="inspector-head">
        <h2>{catalog.find(([v]) => v === node.verb)?.[1] ?? node.verb}</h2>
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
          <Field label="Destination type">
            <select
              value={node.to?.type || ''}
              onChange={(e) =>
                patch({
                  to:
                    e.target.value === 'phone'
                      ? { type: 'phone', number: '', gateway_id: '' }
                      : e.target.value === 'sip'
                        ? { type: 'sip', sip_uri: '' }
                        : { type: 'user', user: '' },
                })
              }
            >
              {!node.to && <option value="">Choose destination…</option>}
              <option value="phone">Phone via gateway</option>
              <option value="sip">SIP URI</option>
              <option value="user">Registered SIP user</option>
            </select>
          </Field>
          {node.to?.type === 'phone' && (
            <>
              <Field label="Gateway">
                <select
                  value={node.to.gateway_id}
                  onChange={(e) =>
                    patch({ to: { ...node.to, gateway_id: e.target.value } })
                  }
                >
                  <option value="">Choose gateway…</option>
                  {gateways.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Number">
                <input
                  value={node.to.number}
                  onChange={(e) =>
                    patch({ to: { ...node.to, number: e.target.value } })
                  }
                  placeholder="+27115551234"
                />
              </Field>
            </>
          )}
          {node.to?.type === 'sip' && (
            <Field label="SIP URI">
              <input
                value={node.to.sip_uri}
                onChange={(e) =>
                  patch({ to: { ...node.to, sip_uri: e.target.value } })
                }
                placeholder="sip:bob@example.com"
              />
            </Field>
          )}
          {node.to?.type === 'user' && (
            <Field label="SIP user">
              <select
                value={node.to.user}
                onChange={(e) =>
                  patch({ to: { type: 'user', user: e.target.value } })
                }
              >
                <option value="">Choose SIP user…</option>
                {sipUsers.map((u) => (
                  <option key={u.id} value={`${u.extension}@${u.realm}`}>
                    {u.display_name
                      ? `${u.display_name} (${u.extension})`
                      : u.extension}
                  </option>
                ))}
              </select>
            </Field>
          )}
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
          <HangupReason
            value={node.reason || ''}
            onChange={(reason) => patch({ reason })}
          />
          <HeaderRows
            value={node.headers || {}}
            onChange={(headers) =>
              patch({
                headers: Object.keys(headers).length ? headers : undefined,
              })
            }
          />
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
                <HoldButton
                  iconOnly
                  aria-label={`Delete the branch for digits ${k}`}
                  onHold={() => {
                    const b = { ...(node.branches || {}) };
                    delete b[k];
                    patch({ branches: b });
                  }}
                />
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
      {node.verb === 'amd' && (
        <>
          <p className="muted">
            Listens to how the call is answered and runs the matching branch,
            then carries on with the next node. Use it on outbound calls, for
            example to leave a voicemail for machines and connect people to an
            agent.
          </p>
          {AMD_FIELDS.map(([key, text, def, hint]) => (
            <Field key={key} label={text} hint={hint}>
              <input
                type="number"
                min="1"
                placeholder={String(def)}
                value={node[key] ?? ''}
                onChange={(e) =>
                  patch({
                    [key]: e.target.value === '' ? undefined : +e.target.value,
                  })
                }
              />
            </Field>
          ))}
          <div className="branch-section">
            <strong>Result branches</strong>
            {(['human', 'machine', 'unknown'] as const).map((b) => (
              <button
                key={b}
                className="branch-link"
                onClick={() => drill(['branches', b])}
              >
                {AMD_BRANCH_LABEL[b]}{' '}
                <span>{node.branches?.[b]?.length || 0} nodes</span>
                <ChevronRight size={14} />
              </button>
            ))}
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
// How a Hang up step ends the call. A known cause is sent as the hangup cause; any other text goes to the far end
// as an X-Reason header on the BYE, with a normal hangup.
const HANGUP_CAUSES = [
  ['NORMAL_CLEARING', 'Normal hang up'],
  ['USER_BUSY', 'Busy'],
  ['CALL_REJECTED', 'Rejected'],
  ['NO_ANSWER', 'No answer'],
  ['UNALLOCATED_NUMBER', "Number doesn't exist"],
  ['NORMAL_TEMPORARY_FAILURE', 'Temporary failure'],
] as const;
const CAUSE_CODE = /^[A-Z][A-Z0-9_]{2,49}$/;
function HangupReason({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const known = HANGUP_CAUSES.some(([code]) => code === value);
  const otherCode = !known && CAUSE_CODE.test(value);
  const [custom, setCustom] = useState(!!value && !known && !otherCode);
  const choice = !value ? 'NORMAL_CLEARING' : custom ? 'custom' : value;
  return (
    <>
      <Field
        label="How the call ends"
        hint="What the other side is told when the call is cleared"
      >
        <select
          value={choice}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              setCustom(true);
              onChange('');
            } else {
              setCustom(false);
              onChange(e.target.value);
            }
          }}
        >
          {HANGUP_CAUSES.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
          {otherCode && <option value={value}>Cause {value}</option>}
          <option value="custom">Custom message</option>
        </select>
      </Field>
      {custom && (
        <Field
          label="Message"
          hint="Sent to the other side as an X-Reason header, with a normal hang up"
        >
          <input
            value={value}
            placeholder="Campaign finished"
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      )}
    </>
  );
}
/** SIP headers as name and value rows. Rows without a name are left out of the step. */
function HeaderRows({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const [rows, setRows] = useState<[string, string][]>(() =>
    Object.entries(value),
  );
  const update = (next: [string, string][]) => {
    setRows(next);
    onChange(
      Object.fromEntries(
        next
          .map(([k, v]) => [k.trim(), v] as [string, string])
          .filter(([k]) => k),
      ),
    );
  };
  return (
    <div className="kv">
      <div className="field-label">Extra headers</div>
      <p className="fs-hint">
        Optional. Sent on the hang-up (BYE). Start names with X-, e.g.
        X-Campaign, so every system passes them on.
      </p>
      {rows.map(([k, v], i) => (
        <div className="kv-row" key={i}>
          <input
            aria-label={`Header ${i + 1} name`}
            placeholder="X-Campaign"
            value={k}
            onChange={(e) =>
              update(rows.map((r, x) => (x === i ? [e.target.value, r[1]] : r)))
            }
          />
          <input
            aria-label={`Header ${i + 1} value`}
            placeholder="Value"
            value={v}
            onChange={(e) =>
              update(rows.map((r, x) => (x === i ? [r[0], e.target.value] : r)))
            }
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove header ${k || i + 1}`}
            title="Remove"
            onClick={() => update(rows.filter((_, x) => x !== i))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => setRows([...rows, ['', '']])}
      >
        <Plus size={15} aria-hidden="true" /> Add header
      </button>
    </div>
  );
}
