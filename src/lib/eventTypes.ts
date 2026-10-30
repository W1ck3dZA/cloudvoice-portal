// Event types the platform publishes to webhooks and WebSocket clients, in
// the groups shown in the portal. Keep in step with cloudvoice-backend.
export type EventTypeInfo = { type: string; label: string };
export type EventGroup = {
  label: string;
  /** Wildcard that subscribes to the whole group, and what it covers. */
  wildcard?: { pattern: string; label: string };
  types: EventTypeInfo[];
};
export const EVENT_GROUPS: EventGroup[] = [
  {
    label: 'Calls',
    wildcard: {
      pattern: 'call.*',
      label:
        'Every event starting with call., including flows, queues and recordings',
    },
    types: [
      { type: 'call.created', label: 'A call was created' },
      { type: 'call.trying', label: 'Dialling has started' },
      { type: 'call.progress', label: 'The far end is ringing' },
      {
        type: 'call.progress-media',
        label: 'Early media is playing, e.g. ringback or an announcement',
      },
      { type: 'call.answered', label: 'The call was answered' },
      { type: 'call.completed', label: 'The call ended normally' },
      {
        type: 'call.failed',
        label: "The call couldn't connect: busy, no answer or an error",
      },
      { type: 'call.amd', label: 'Answering machine detection result' },
    ],
  },
  {
    label: 'Call flows',
    wildcard: { pattern: 'call.flow.*', label: 'Every call flow event' },
    types: [
      { type: 'call.flow.started', label: 'An application flow started' },
      { type: 'call.flow.verb', label: 'A flow step ran' },
      { type: 'call.flow.gather', label: 'Digits were collected' },
      {
        type: 'call.flow.unsupported_verb',
        label: "A flow step was skipped because it isn't supported",
      },
      { type: 'call.flow.completed', label: 'The flow finished' },
    ],
  },
  {
    label: 'Call queues',
    wildcard: { pattern: 'call.queue.*', label: 'Every call queue event' },
    types: [
      { type: 'call.queue.entered', label: 'A caller joined a queue' },
      { type: 'call.queue.agent_bridged', label: 'An agent picked up' },
      { type: 'call.queue.left', label: 'A caller left the queue' },
    ],
  },
  {
    label: 'Recordings',
    types: [
      { type: 'call.recording.started', label: 'Recording started' },
      { type: 'call.recording.complete', label: 'Recording stopped' },
      {
        type: 'recording.uploaded',
        label: 'The recording file is stored and can be downloaded',
      },
    ],
  },
  {
    label: 'SMS',
    wildcard: { pattern: 'sms.*', label: 'Every SMS event' },
    types: [
      { type: 'sms.queued', label: 'A message is waiting to be sent' },
      { type: 'sms.sent', label: 'A message was handed to the carrier' },
      { type: 'sms.failed', label: "A message couldn't be sent" },
      {
        type: 'sms.received',
        label: 'A message arrived on one of your numbers',
      },
    ],
  },
];
export const ALL_EVENT_TYPES = EVENT_GROUPS.flatMap((g) => g.types);
export const describeEventType = (type: string) =>
  ALL_EVENT_TYPES.find((t) => t.type === type)?.label;
