import axios from 'axios';
import { showToast } from './toast';
import type {
  Agent,
  AudioFile,
  ApiEnvelope,
  ApiKey,
  Application,
  Call,
  CallCenterMember,
  Member,
  NumberResource,
  Organisation,
  OrganisationLimits,
  Queue,
  QueueStats,
  QueueTier,
  Recording,
  SipGateway,
  SipUser,
  SmsCredential,
  SmsMessage,
  User,
  WebhookDelivery,
  WebhookEndpoint,
} from '../types/api';
const baseURL =
  import.meta.env.VITE_API_URL || 'https://api.cloudvoice.network';
export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('cv_token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      localStorage.removeItem('cv_token');
      localStorage.removeItem('cv_session');
      if (!location.pathname.endsWith('/login')) location.href = '/login';
      return Promise.reject(e);
    }
    const err = e.response?.data?.error;
    if (err?.code === 'rate_limit_exceeded') {
      const resetAt = err.reset_at ? new Date(err.reset_at) : null;
      showToast({
        kind: 'error',
        message: resetAt
          ? `Too many requests — you've hit the daily limit (${err.limit}). Try again after ${resetAt.toLocaleTimeString()}.`
          : "Too many requests — you've hit the daily rate limit. Please try again later.",
        durationMs: 10000,
      });
    } else if (err?.message) {
      showToast({ kind: 'error', message: err.message });
    } else if (e.message && e.code !== 'ERR_CANCELED') {
      showToast({ kind: 'error', message: e.message });
    }
    return Promise.reject(e);
  },
);
const unwrap = <T>(r: { data: ApiEnvelope<T> }) => r.data.data;
function list<T>(r: { data: ApiEnvelope<unknown> }, keys: string[] = []): T[] {
  const d = r.data?.data as any;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object')
    for (const k of keys) if (Array.isArray(d[k])) return d[k];
  return [];
}
export const errorMessage = (e: any) =>
  e?.response?.data?.error?.message || e?.message || 'Request failed';
export const authApi = {
  register: async (email: string, name: string, password: string) =>
    unwrap<{
      user: User;
      orgId: string | null;
      role: string | null;
      token: string;
    }>(await api.post('/v1/auth/register', { email, name, password })),
  login: async (email: string, password: string) =>
    unwrap<{
      user: User;
      orgId: string | null;
      role: string | null;
      token: string;
    }>(await api.post('/v1/auth/login', { email, password })),
  me: async () => unwrap<User>(await api.get('/v1/users/me')),
  updateMe: async (body: { name: string }) =>
    unwrap<User>(await api.patch('/v1/users/me', body)),
  changePassword: async (body: {
    current_password: string;
    new_password: string;
  }) => unwrap<any>(await api.post('/v1/users/me/change-password', body)),
  organisations: async () =>
    list<Organisation>(await api.get('/v1/users/me/organisations'), [
      'organisations',
    ]),
};
export const numbersApi = {
  list: async (orgId?: string) =>
    list<NumberResource>(
      await api.get('/v1/numbers', { params: orgId ? { org_id: orgId } : {} }),
      ['numbers'],
    ),
  get: async (id: string) =>
    unwrap<NumberResource>(await api.get(`/v1/numbers/${id}`)),
  create: async (body: any, orgId?: string) =>
    unwrap<NumberResource>(
      await api.post('/v1/numbers', body, {
        params: orgId ? { org_id: orgId } : {},
      }),
    ),
  update: async (id: string, body: any) =>
    unwrap<NumberResource>(await api.patch(`/v1/numbers/${id}`, body)),
  remove: async (id: string) => api.delete(`/v1/numbers/${id}`),
};
export const sipUsersApi = {
  list: async () =>
    list<SipUser>(await api.get('/v1/sip-users'), ['users', 'sip_users']),
  get: async (id: string) =>
    unwrap<SipUser>(await api.get(`/v1/sip-users/${id}`)),
  create: async (body: any) =>
    unwrap<SipUser>(await api.post('/v1/sip-users', body)),
  update: async (id: string, body: any) =>
    unwrap<SipUser>(await api.patch(`/v1/sip-users/${id}`, body)),
  remove: async (id: string) => api.delete(`/v1/sip-users/${id}`),
  rotate: async (id: string, password?: string) =>
    unwrap<any>(
      await api.post(
        `/v1/sip-users/${id}/password`,
        password ? { password } : {},
      ),
    ),
};
export const gatewaysApi = {
  list: async () =>
    list<SipGateway>(await api.get('/v1/gateways'), ['gateways']),
  get: async (id: string) =>
    unwrap<SipGateway>(await api.get(`/v1/gateways/${id}`)),
  create: async (body: any) =>
    unwrap<any>(await api.post('/v1/gateways', body)),
  update: async (id: string, body: any) =>
    unwrap<SipGateway>(await api.patch(`/v1/gateways/${id}`, body)),
  remove: async (id: string) => api.delete(`/v1/gateways/${id}`),
  test: async (id: string) =>
    unwrap<any>(await api.post(`/v1/gateways/${id}/test`)),
};
export const callsApi = {
  list: async (params?: Record<string, unknown>) =>
    list<Call>(await api.get('/v1/calls', { params }), ['calls']),
  listPaged: async (params?: Record<string, unknown>) => {
    const r = await api.get('/v1/calls', { params });
    const d = r.data?.data as any;
    return {
      items: Array.isArray(d?.calls) ? (d.calls as Call[]) : [],
      total: typeof d?.total === 'number' ? d.total : 0,
    };
  },
  get: async (id: string) => unwrap<Call>(await api.get(`/v1/calls/${id}`)),
  create: async (body: any) => unwrap<any>(await api.post('/v1/calls', body)),
  hangup: async (id: string) => api.delete(`/v1/calls/${id}`),
};
export const audioFilesApi = {
  list: async (orgId: string, limit = 50, offset = 0) =>
    list<AudioFile>(
      await api.get('/v1/audio-files', {
        params: { org_id: orgId, limit, offset },
      }),
      ['audio_files'],
    ),
  get: async (id: string, orgId: string) =>
    unwrap<AudioFile>(
      await api.get(`/v1/audio-files/${id}`, {
        params: { org_id: orgId },
      }),
    ),
  upload: async (
    file: File,
    name: string,
    orgId: string,
    onProgress: (percent: number) => void,
  ) => {
    const body = new FormData();
    body.append('file', file);
    if (name.trim()) body.append('name', name.trim());
    return unwrap<AudioFile>(
      await api.post('/v1/audio-files', body, {
        params: { org_id: orgId },
        // Clear the JSON default so the browser supplies the multipart boundary.
        headers: { 'Content-Type': undefined },
        onUploadProgress: ({ loaded, total }) => {
          if (total) onProgress(Math.round((loaded / total) * 100));
        },
      }),
    );
  },
  rename: async (id: string, name: string, orgId: string) =>
    unwrap<AudioFile>(
      await api.patch(
        `/v1/audio-files/${id}`,
        { name },
        {
          params: { org_id: orgId },
        },
      ),
    ),
  remove: async (id: string, orgId: string) =>
    api.delete(`/v1/audio-files/${id}`, { params: { org_id: orgId } }),
};
export const recordingsApi = {
  list: async () =>
    list<Recording>(await api.get('/v1/recordings'), ['recordings']),
  get: async (id: string) =>
    unwrap<Recording>(await api.get(`/v1/recordings/${id}`)),
  remove: async (id: string) => api.delete(`/v1/recordings/${id}`),
  downloadUrl: (id: string) => `${baseURL}/v1/recordings/${id}/download`,
};
export const appsApi = {
  list: async () =>
    list<Application>(await api.get('/v1/applications'), ['applications']),
  get: async (id: string) =>
    unwrap<Application>(await api.get(`/v1/applications/${id}`)),
  create: async (body: any) =>
    unwrap<Application>(await api.post('/v1/applications', body)),
  update: async (id: string, body: any) =>
    unwrap<Application>(await api.patch(`/v1/applications/${id}`, body)),
  remove: async (id: string) => api.delete(`/v1/applications/${id}`),
};
export const queuesApi = {
  list: async () =>
    list<Queue>(await api.get('/v1/call-center/queues'), ['queues']),
  get: async (id: string) =>
    unwrap<Queue>(await api.get(`/v1/call-center/queues/${id}`)),
  create: async (body: any) =>
    unwrap<Queue>(await api.post('/v1/call-center/queues', body)),
  update: async (id: string, body: any) =>
    unwrap<Queue>(await api.patch(`/v1/call-center/queues/${id}`, body)),
  remove: async (id: string) => api.delete(`/v1/call-center/queues/${id}`),
  stats: async (id: string) =>
    unwrap<QueueStats>(await api.get(`/v1/call-center/queues/${id}/stats`)),
  members: async (id: string) =>
    list<CallCenterMember>(
      await api.get(`/v1/call-center/queues/${id}/members`),
      ['members'],
    ),
  tiers: async (id: string) =>
    list<QueueTier>(await api.get(`/v1/call-center/queues/${id}/tiers`), [
      'tiers',
    ]),
  addTier: async (id: string, body: any) =>
    unwrap<QueueTier>(
      await api.post(`/v1/call-center/queues/${id}/tiers`, body),
    ),
  updateTier: async (id: string, agentId: string, body: any) =>
    unwrap<QueueTier>(
      await api.patch(`/v1/call-center/queues/${id}/tiers/${agentId}`, body),
    ),
  removeTier: async (id: string, agentId: string) =>
    api.delete(`/v1/call-center/queues/${id}/tiers/${agentId}`),
};
export const agentsApi = {
  list: async () =>
    list<Agent>(await api.get('/v1/call-center/agents'), ['agents']),
  get: async (id: string) =>
    unwrap<Agent>(await api.get(`/v1/call-center/agents/${id}`)),
  create: async (body: any) =>
    unwrap<Agent>(await api.post('/v1/call-center/agents', body)),
  update: async (id: string, body: any) =>
    unwrap<Agent>(await api.patch(`/v1/call-center/agents/${id}`, body)),
  status: async (id: string, status: string) =>
    unwrap<Agent>(
      await api.patch(`/v1/call-center/agents/${id}/status`, { status }),
    ),
  remove: async (id: string) => api.delete(`/v1/call-center/agents/${id}`),
};
export const smsApi = {
  list: async (params?: Record<string, unknown>) =>
    list<SmsMessage>(await api.get('/v1/sms', { params }), ['messages', 'sms']),
  get: async (id: string) => unwrap<SmsMessage>(await api.get(`/v1/sms/${id}`)),
  send: async (body: any) => unwrap<any>(await api.post('/v1/sms', body)),
};
export const webhooksApi = {
  list: async () =>
    list<WebhookEndpoint>(await api.get('/v1/webhooks'), ['webhooks']),
  get: async (id: string) =>
    unwrap<WebhookEndpoint>(await api.get(`/v1/webhooks/${id}`)),
  create: async (body: any) =>
    unwrap<any>(await api.post('/v1/webhooks', body)),
  update: async (id: string, body: any) =>
    unwrap<WebhookEndpoint>(await api.patch(`/v1/webhooks/${id}`, body)),
  remove: async (id: string) => api.delete(`/v1/webhooks/${id}`),
  rotate: async (id: string) =>
    unwrap<any>(await api.post(`/v1/webhooks/${id}/rotate-secret`)),
  deliveries: async (id: string) =>
    list<WebhookDelivery>(await api.get(`/v1/webhooks/${id}/deliveries`), [
      'deliveries',
    ]),
  retry: async (id: string, deliveryId: string) =>
    unwrap<any>(
      await api.post(`/v1/webhooks/${id}/deliveries/${deliveryId}/retry`),
    ),
};
export const apiKeysApi = {
  list: async () =>
    list<ApiKey>(await api.get('/v1/api-keys'), ['api_keys', 'keys']),
  get: async (id: string) =>
    unwrap<ApiKey>(await api.get(`/v1/api-keys/${id}`)),
  create: async (body: any) =>
    unwrap<any>(await api.post('/v1/api-keys', body)),
  remove: async (id: string) => api.delete(`/v1/api-keys/${id}`),
  limits: async (id: string, body: any) =>
    unwrap<any>(await api.patch(`/v1/api-keys/${id}/limits`, body)),
};
export const orgApi = {
  list: async () =>
    list<Organisation>(await api.get('/v1/organisations'), ['organisations']),
  get: async (id: string) =>
    unwrap<Organisation>(await api.get(`/v1/organisations/${id}`)),
  create: async (body: any) =>
    unwrap<Organisation>(await api.post('/v1/organisations', body)),
  update: async (id: string, body: any) =>
    unwrap<Organisation>(await api.patch(`/v1/organisations/${id}`, body)),
  remove: async (id: string) => api.delete(`/v1/organisations/${id}`),
  members: async (id: string) =>
    list<Member>(await api.get(`/v1/organisations/${id}/members`), ['members']),
  addMember: async (id: string, body: any) =>
    unwrap<Member>(await api.post(`/v1/organisations/${id}/members`, body)),
  memberRole: async (id: string, userId: string, role: string) =>
    unwrap<Member>(
      await api.patch(`/v1/organisations/${id}/members/${userId}/role`, {
        role,
      }),
    ),
  removeMember: async (id: string, userId: string) =>
    api.delete(`/v1/organisations/${id}/members/${userId}`),
  limits: async (id: string) =>
    unwrap<OrganisationLimits>(await api.get(`/v1/organisations/${id}/limits`)),
  updateLimits: async (id: string, body: any) =>
    unwrap<OrganisationLimits>(
      await api.patch(`/v1/organisations/${id}/limits`, body),
    ),
  transferOwner: async (id: string, user_id: string) =>
    unwrap<any>(await api.patch(`/v1/organisations/${id}/owner`, { user_id })),
};

export const smsCredentialsApi = {
  get: async () =>
    unwrap<SmsCredential | null>(await api.get('/v1/sms-credentials')),
  create: async (body: any) =>
    unwrap<SmsCredential>(await api.post('/v1/sms-credentials', body)),
  update: async (body: any) =>
    unwrap<SmsCredential>(await api.patch('/v1/sms-credentials', body)),
  remove: async () => api.delete('/v1/sms-credentials'),
};

export const eventsApi = {
  publish: async (body: {
    type: string;
    payload?: Record<string, unknown>;
    org_id?: string;
  }) => unwrap<any>(await api.post('/v1/events', body)),
};
