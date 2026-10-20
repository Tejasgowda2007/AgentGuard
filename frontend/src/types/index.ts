export interface Agent {
  id: string
  name: string
  description: string
  environment: string
  status: 'ACTIVE' | 'DISABLED' | 'SUSPENDED'
  allowed_actions: string[]
  rate_limit_rpm: number
  risk_multiplier: number
  created_at: string
  updated_at: string
}

export interface PolicyRule {
  id: string
  name: string
  description: string
  rule_type: string
  action_pattern: string
  condition_json: string
  decision: 'ALLOW' | 'BLOCK' | 'REVIEW'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface PolicyCheck {
  check_name: string
  passed: boolean
  severity: string
  details: string
}

export interface ActionEvent {
  event_id: string
  timestamp: string
  agent_id: string
  agent_name: string
  action: string
  decision: 'ALLOW' | 'BLOCK' | 'REVIEW'
  risk_score: number
  reasons: string[]
  executed: boolean
  audit_hash: string
  parameters?: Record<string, any>
  context?: Record<string, any>
  policy_checks?: PolicyCheck[]
  execution_receipt?: Record<string, any>
  anomaly_score?: number
  anomaly_signals?: string[]
}

export interface ApprovalRequest {
  id: string
  event_id: string
  agent_id: string
  action: string
  parameters: Record<string, any>
  risk_score: number
  reasons: string[]
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED'
  reviewer_id?: string
  reviewer_comment?: string
  created_at: string
  expires_at: string
  reviewed_at?: string
  executed_at?: string
  execution_receipt?: Record<string, any>
}

export interface ThreatAlert {
  id: string
  title: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  agent_id: string
  related_event_ids: string[]
  reason: string
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  first_observed: string
  last_observed: string
  analyst_notes?: string
  is_seeded: boolean
}

export interface AuditEntry {
  id: number
  event_id: string
  timestamp: string
  agent_id: string
  action: string
  decision: string
  reasons: string[]
  execution_outcome: string
  prev_hash: string
  current_hash: string
  operator_action?: string
}

export interface AuditVerifyResult {
  is_valid: boolean
  total_records: number
  verified_at: string
  tampered_record_id?: number
  expected_hash?: string
  actual_hash?: string
  details: string
}

export interface SystemOverview {
  protection_enabled: boolean
  active_agents: number
  pending_approvals: number
  total_intercepted: number
  allowed_count: number
  blocked_count: number
  review_count: number
  threats_detected: number
  policy_violations: number
  last_updated: string
  timeseries: {
    time: string
    allow: number
    block: number
    review: number
  }[]
  decision_distribution: {
    ALLOW: number
    BLOCK: number
    REVIEW: number
  }
  recent_events: ActionEvent[]
  risky_events: ActionEvent[]
}

export interface ActionExecuteResponse {
  event_id: string
  timestamp: string
  agent_id: string
  agent_name: string
  action: string
  decision: 'ALLOW' | 'BLOCK' | 'REVIEW'
  risk_score: number
  reasons: string[]
  policy_checks: PolicyCheck[]
  executed: boolean
  approval_required: boolean
  approval_id?: string
  execution_receipt?: Record<string, any>
  audit_hash: string
  anomaly_score?: number
  anomaly_signals: string[]
}
