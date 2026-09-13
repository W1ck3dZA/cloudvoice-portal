export type Role = 'owner' | 'admin' | 'developer' | 'viewer';
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}
export interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
}
export interface Organisation {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise' | 'custom';
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  role: Role;
}
export interface Member {
  id: string;
  email: string;
  name: string;
  status: string;
  role: Role;
  joined_at: string;
}
export interface OrganisationLimits {
  organisation_id: string;
  requests_per_minute: number;
  requests_per_day: number;
  max_users: number;
  max_api_keys: number;
}
export interface NumberResource {
  id: string;
  organisation_id: string;
  e164: string;
  capabilities: ('voice' | 'sms')[];
  application_id: string | null;
  active: boolean;
  created_at: string;
}
export interface SipUser {
  id: string;
  organisation_id: string;
  extension: string;
  realm: string;
  display_name: string | null;
  voicemail_enabled: boolean;
  application_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  password?: string;
}
export interface SipGateway {
  id: string;
  organisation_id: string;
  name: string;
  profile: string;
  realm: string;
  proxy: string | null;
  username: string;
  caller_id_number: string | null;
  caller_id_name: string | null;
  codecs: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}
export interface Recording {
  id: string;
  organisation_id: string;
  call_id: string | null;
  content_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  created_at: string;
}
export interface Call {
  id: string;
  organisation_id: string;
  gateway_id: string | null;
  application_id: string | null;
  application_version: number | null;
  record_calls: boolean;
  tag: Record<string, unknown> | null;
  time_limit_secs: number | null;
  direction: 'outbound' | 'inbound';
  from_number: string;
  to_number: string;
  caller_id_name: string | null;
  status:
    | 'initiated'
    | 'ringing'
    | 'answered'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'no_answer'
    | 'busy';
  hangup_cause: string | null;
  duration_seconds: number | null;
  initiated_at: string;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
}
export type VerbPlay = {
  verb: 'play';
  url: string | string[];
  loop?: number;
  timeoutSecs?: number;
  seekOffset?: number;
  earlyMedia?: boolean;
};
export type VerbGather = {
  verb: 'gather';
  input?: string[];
  prompt?: string | string[];
  numDigits?: number;
  minDigits?: number;
  maxDigits?: number;
  timeoutSecs?: number;
  finishOnKey?: string;
  repeatOnInvalid?: number;
  branches?: Record<string, Verb[]>;
  defaultVerbs?: Verb[];
};
export type VerbDial = {
  verb: 'dial';
  target: string;
  callerId?: string;
  callerIdName?: string;
  timeoutSecs?: number;
  answerOnBridge?: boolean;
};
export type VerbListen = {
  verb: 'listen';
  url: string;
  maxLengthSecs?: number;
  finishOnKey?: string;
  playBeep?: boolean;
};
export type VerbPause = { verb: 'pause'; length: number };
export type VerbSay = {
  verb: 'say';
  text: string;
  voice?: string;
  language?: string;
};
export type VerbHangup = {
  verb: 'hangup';
  reason?: string;
  headers?: Record<string, string>;
};
export type VerbQueue = {
  verb: 'queue';
  queue_id: string;
  maxWaitSecs?: number;
  answeredVerbs?: Verb[];
  timeoutVerbs?: Verb[];
  abandonVerbs?: Verb[];
};
export type Verb =
  | VerbPlay
  | VerbGather
  | VerbDial
  | VerbListen
  | VerbPause
  | VerbSay
  | VerbHangup
  | VerbQueue;
export interface Application {
  id: string;
  organisation_id: string;
  name: string;
  description: string | null;
  flow: Verb[];
  config: { record_calls?: boolean };
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}
export interface Queue {
  id: string;
  organisation_id: string;
  name: string;
  fs_name: string;
  strategy: string;
  moh_sound?: string | null;
  announce_sound?: string | null;
  announce_frequency_secs?: number;
  max_wait_time: number;
  max_wait_time_with_no_agent?: number;
  tier_rules_apply?: boolean;
  tier_rule_wait_second?: number;
  discard_abandoned_after: number;
  abandoned_resume_allowed?: boolean;
  agent_no_answer_status: string;
  ring_progressively_delay?: number;
  calls_answered: number;
  calls_abandoned: number;
  active: boolean;
  created_at: string;
}
export interface Agent {
  id: string;
  organisation_id: string;
  name: string;
  fs_name: string;
  type: 'callback' | 'uuid-standby';
  contact: string;
  sip_user_id: string | null;
  status: 'Available' | 'Available (On Demand)' | 'On Break' | 'Logged Out';
  state: string;
  max_no_answer: number;
  wrap_up_time: number;
  reject_delay_time: number;
  busy_delay_time: number;
  no_answer_delay_time: number;
  calls_answered: number;
  talk_time_seconds: number;
  last_status_change: string | null;
  active: boolean;
  created_at: string;
}
export interface QueueTier {
  id: string;
  queue_id: string;
  agent_id: string;
  organisation_id: string;
  level: number;
  position: number;
  state: string;
  agent_name: string;
  agent_fs_name: string;
  agent_status: string;
  agent_state: string;
}
export interface QueueStats {
  queue_id: string;
  fs_queue_name: string;
  calls_answered: number;
  calls_abandoned: number;
  total_callers: number;
  currently_waiting: number;
  currently_bridged: number;
  total_answered: number;
  total_abandoned: number;
  avg_wait_seconds: number | null;
  avg_talk_seconds: number | null;
  total_agents: number;
  available_agents: number;
  agents_on_call: number;
}
export interface SmsMessage {
  id: string;
  organisation_id: string;
  direction: 'outbound' | 'inbound';
  from_number: string | null;
  to_number: string;
  body: string;
  encoding: 'gsm7' | 'ucs2';
  segments: number;
  status: string;
  provider_message_id?: string | null;
  error_code?: string | null;
  diagnostic_info?: string | null;
  tag?: Record<string, unknown> | null;
  submitted_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
}
export interface WebhookEndpoint {
  id: string;
  organisation_id: string;
  url: string;
  event_types: string[];
  active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  secret?: string;
}
export interface WebhookDelivery {
  id: string;
  webhook_endpoint_id: string;
  event_id: string;
  event_type: string;
  status: 'pending' | 'delivered' | 'failed';
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  duration_ms: number | null;
  attempt_count: number;
  delivered_at: string | null;
  next_retry_at: string | null;
  created_at: string;
}
export interface ApiKey {
  id: string;
  prefix: string;
  name: string;
  status: 'active' | 'revoked';
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  organisation_id: string;
  key?: string;
}

export interface SmsCredential {
  id: string;
  organisation_id: string;
  jasmin_username: string;
  jasmin_password?: string;
  default_sender_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallCenterMember {
  id: string;
  queue_id: string;
  organisation_id: string;
  freeswitch_uuid: string;
  call_id: string | null;
  agent_id: string | null;
  agent_name: string | null;
  cid_name: string | null;
  cid_number: string | null;
  status: 'waiting' | 'bridged' | 'completed' | 'abandoned';
  leaving_reason: string | null;
  joined_at: string;
  bridged_at: string | null;
  left_at: string | null;
}
