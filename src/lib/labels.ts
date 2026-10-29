export const AGENT_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'available_on_demand', label: 'Available on demand' },
  { value: 'on_break', label: 'On break' },
  { value: 'logged_out', label: 'Logged out' },
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number]['value'];
// API values are lowercase snake_case; show them as sentence-case words.
export const humanize = (v?: string | null) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1).replaceAll('_', ' ') : '—';
