import {
  Agent,
  PolicyRule,
  ActionEvent,
  ApprovalRequest,
  ThreatAlert,
  AuditEntry,
  AuditVerifyResult,
  SystemOverview,
  ActionExecuteResponse,
} from '../types'

const BASE_URL = 'https://agentguard-931q.onrender.com/api/v1'

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  getHealth: () => request<any>('/health'),
  getOverview: () => request<SystemOverview>('/overview'),

  executeAction: (payload: {
    agent_id: string
    action: string
    parameters?: Record<string, any>
    context?: Record<string, any>
    idempotency_key?: string
  }) =>
    request<ActionExecuteResponse>('/actions/execute', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getEvents: (params?: {
    agent_id?: string
    decision?: string
    search?: string
    min_risk?: number
    action?: string
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams()

    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.set(key, String(value))
      }
    })

    return request<{
      total: number
      offset: number
      limit: number
      items: ActionEvent[]
    }>(`/events?${query.toString()}`)
  },

  getEventDetails: (id: string) =>
    request<ActionEvent>(`/events/${encodeURIComponent(id)}`),

  getAgents: () => request<Agent[]>('/agents'),

  createAgent: (agent: Partial<Agent>) =>
    request<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    }),

  updateAgent: (id: string, updates: Partial<Agent>) =>
    request<Agent>(`/agents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  getPolicies: () => request<PolicyRule[]>('/policies'),

  updatePolicy: (id: string, updates: Partial<PolicyRule>) =>
    request<PolicyRule>(`/policies/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  resetPolicies: () =>
    request<{ status: string; message: string }>('/policies/reset', {
      method: 'POST',
    }),

  getApprovals: (status?: string) =>
    request<ApprovalRequest[]>(
      status ? `/approvals?status=${encodeURIComponent(status)}` : '/approvals'
    ),

  approveRequest: (
    id: string,
    reviewerId: string,
    reviewerComment: string
  ) =>
    request<ApprovalRequest>(
      `/approvals/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          reviewer_id: reviewerId,
          reviewer_comment: reviewerComment,
        }),
      }
    ),

  rejectRequest: (
    id: string,
    reviewerId: string,
    reviewerComment: string
  ) =>
    request<ApprovalRequest>(
      `/approvals/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({
          reviewer_id: reviewerId,
          reviewer_comment: reviewerComment,
        }),
      }
    ),

  getAlerts: (status?: string, severity?: string) => {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (severity) query.set('severity', severity)

    return request<ThreatAlert[]>(`/alerts?${query.toString()}`)
  },

  updateAlert: (
    id: string,
    updates: { status?: string; analyst_notes?: string }
  ) =>
    request<ThreatAlert>(`/alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  verifyAudit: () => request<AuditVerifyResult>('/audit/verify'),

  getAuditRecords: (limit = 50, offset = 0) =>
    request<{
      total: number
      offset: number
      limit: number
      items: AuditEntry[]
    }>(`/audit/records?limit=${limit}&offset=${offset}`),

  exportAuditCsvUrl: () => `${BASE_URL}/audit/export`,

  simulateTampering: (tamper: boolean) =>
    request<{ status: string; message: string; record_id: number }>(
      `/audit/tamper-demo?tamper=${tamper}`,
      { method: 'POST' }
    ),

  getProtectionStatus: () =>
    request<{
      protection_enabled: boolean
      mode: string
      description: string
      last_updated: string
    }>('/settings/protection'),

  disableProtection: (
    operatorId = 'secops-admin',
    reason = 'Emergency lockdown requested'
  ) =>
    request<any>('/settings/protection/disable', {
      method: 'POST',
      body: JSON.stringify({ operator_id: operatorId, reason }),
    }),

  enableProtection: (
    operatorId = 'secops-admin',
    reason = 'Normal posture restored'
  ) =>
    request<any>('/settings/protection/enable', {
      method: 'POST',
      body: JSON.stringify({ operator_id: operatorId, reason }),
    }),

  resetDemo: () =>
    request<{ status: string; message: string; timestamp: string }>(
      '/settings/reset-demo',
      { method: 'POST' }
    ),
}