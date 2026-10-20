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

const BASE_URL = `${import.meta.env.VITE_API_URL || 'https://agentguard-931q.onrender.com'}/api/v1`

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}: ${res.statusText}`
    try {
      const errJson = await res.json()
      if (errJson.detail) errorMsg = errJson.detail
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }

  return res.json()
}

export const api = {
  // Overview & Health
  getHealth: () => request<any>('/health'),
  getOverview: () => request<SystemOverview>('/overview'),

  // Actions
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

  // Events
  getEvents: (params?: {
    agent_id?: string
    decision?: string
    search?: string
    min_risk?: number
    action?: string
    limit?: number
    offset?: number
  }) => {
    const q = new URLSearchParams()
    if (params?.agent_id) q.set('agent_id', params.agent_id)
    if (params?.decision) q.set('decision', params.decision)
    if (params?.search) q.set('search', params.search)
    if (params?.min_risk !== undefined) q.set('min_risk', params.min_risk.toString())
    if (params?.action) q.set('action', params.action)
    if (params?.limit) q.set('limit', params.limit.toString())
    if (params?.offset) q.set('offset', params.offset.toString())
    return request<{ total: number; offset: number; limit: number; items: ActionEvent[] }>(
      `/events?${q.toString()}`
    )
  },
  getEventDetails: (eventId: string) => request<ActionEvent>(`/events/${eventId}`),

  // Agents
  getAgents: () => request<Agent[]>('/agents'),
  createAgent: (agent: Partial<Agent>) =>
    request<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    }),
  updateAgent: (agentId: string, updates: Partial<Agent>) =>
    request<Agent>(`/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Policies
  getPolicies: () => request<PolicyRule[]>('/policies'),
  updatePolicy: (policyId: string, updates: Partial<PolicyRule>) =>
    request<PolicyRule>(`/policies/${policyId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  resetPolicies: () =>
    request<{ status: string; message: string }>('/policies/reset', {
      method: 'POST',
    }),

  // Approvals
  getApprovals: (status?: string) => {
    const q = status ? `?status=${status}` : ''
    return request<ApprovalRequest[]>(`/approvals${q}`)
  },
  approveRequest: (approvalId: string, reviewerId: string, reviewerComment: string) =>
    request<ApprovalRequest>(`/approvals/${approvalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_id: reviewerId, reviewer_comment: reviewerComment }),
    }),
  rejectRequest: (approvalId: string, reviewerId: string, reviewerComment: string) =>
    request<ApprovalRequest>(`/approvals/${approvalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_id: reviewerId, reviewer_comment: reviewerComment }),
    }),

  // Alerts
  getAlerts: (status?: string, severity?: string) => {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    if (severity) q.set('severity', severity)
    return request<ThreatAlert[]>(`/alerts?${q.toString()}`)
  },
  updateAlert: (alertId: string, updates: { status?: string; analyst_notes?: string }) =>
    request<ThreatAlert>(`/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Audit
  verifyAudit: () => request<AuditVerifyResult>('/audit/verify'),
  getAuditRecords: (limit = 50, offset = 0) =>
    request<{ total: number; offset: number; limit: number; items: AuditEntry[] }>(
      `/audit/records?limit=${limit}&offset=${offset}`
    ),
  exportAuditCsvUrl: () => `${BASE_URL}/audit/export`,
  simulateTampering: (tamper: boolean) =>
    request<{ status: string; message: string; record_id: number }>(
      `/audit/tamper-demo?tamper=${tamper}`,
      { method: 'POST' }
    ),

  // Settings & Protection
  getProtectionStatus: () =>
    request<{ protection_enabled: boolean; mode: string; description: string; last_updated: string }>(
      '/settings/protection'
    ),
  disableProtection: (operatorId = 'secops-admin', reason = 'Emergency lockdown requested') =>
    request<any>('/settings/protection/disable', {
      method: 'POST',
      body: JSON.stringify({ operator_id: operatorId, reason }),
    }),
  enableProtection: (operatorId = 'secops-admin', reason = 'Normal posture restored') =>
    request<any>('/settings/protection/enable', {
      method: 'POST',
      body: JSON.stringify({ operator_id: operatorId, reason }),
    }),
  resetDemo: () =>
    request<{ status: string; message: string; timestamp: string }>('/settings/reset-demo', {
      method: 'POST',
    }),
}
