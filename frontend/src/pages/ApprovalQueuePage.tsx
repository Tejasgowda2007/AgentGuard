import React, { useEffect, useState } from 'react'
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Shield,
  DollarSign,
  ArrowRight,
  Database,
  Terminal,
  X,
  FileCheck2,
} from 'lucide-react'
import { api } from '../services/api'
import { ApprovalRequest } from '../types'

export const ApprovalQueuePage: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORICAL'>('PENDING')
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null)
  const [reviewerComment, setReviewerComment] = useState('')
  const [reviewerId, setReviewerId] = useState('secops-analyst-eleanor')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  const fetchApprovals = async () => {
    setLoading(true)
    try {
      const data = await api.getApprovals()
      setApprovals(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApprovals()
  }, [])

  const pendingRequests = approvals.filter((a) => a.status === 'PENDING')
  const historicalRequests = approvals.filter((a) => a.status !== 'PENDING')
  const displayedRequests = activeTab === 'PENDING' ? pendingRequests : historicalRequests

  const handleOpenAction = (req: ApprovalRequest, type: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(req)
    setActionType(type)
    setReviewerComment(
      type === 'APPROVE'
        ? 'Verified transaction against authorized ticket workflow. Approved.'
        : 'Discrepancy identified in refund justification. Denied.'
    )
    setErrorMessage(null)
  }

  const handleSubmitDecision = async () => {
    if (!selectedRequest || !actionType) return
    if (!reviewerComment.trim()) {
      setErrorMessage('A justification comment is required for compliance audit.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      if (actionType === 'APPROVE') {
        await api.approveRequest(selectedRequest.id, reviewerId, reviewerComment)
        setNotification(`Request ${selectedRequest.id} approved and executed successfully.`)
      } else {
        await api.rejectRequest(selectedRequest.id, reviewerId, reviewerComment)
        setNotification(`Request ${selectedRequest.id} rejected. Execution blocked.`)
      }

      setSelectedRequest(null)
      setActionType(null)
      fetchApprovals()
      setTimeout(() => setNotification(null), 4000)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit approval decision.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-guard-text">Human Approval Queue</h1>
          <p className="text-xs text-guard-muted">
            Authorized reviewer sign-off for high-value actions, external data transfers, and elevated-risk operations.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center p-1 rounded-lg bg-guard-panel border border-guard-border font-mono text-xs">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-2 ${
              activeTab === 'PENDING'
                ? 'bg-guard-signal text-black font-semibold shadow-xs'
                : 'text-guard-muted hover:text-guard-text'
            }`}
          >
            <span>Pending Review</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'PENDING' ? 'bg-black text-guard-signal' : 'bg-guard-surface'
              }`}
            >
              {pendingRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('HISTORICAL')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-2 ${
              activeTab === 'HISTORICAL'
                ? 'bg-guard-signal text-black font-semibold shadow-xs'
                : 'text-guard-muted hover:text-guard-text'
            }`}
          >
            <span>Decision History</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'HISTORICAL' ? 'bg-black text-guard-signal' : 'bg-guard-surface'
              }`}
            >
              {historicalRequests.length}
            </span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 rounded bg-guard-signal/10 border border-guard-signal/30 text-xs font-mono text-guard-signal flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Requests List */}
      {displayedRequests.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-guard-panel border border-guard-border text-guard-muted space-y-3">
          <CheckSquare className="w-8 h-8 text-guard-signal mx-auto opacity-60" />
          <h3 className="text-sm font-semibold text-guard-text">
            {activeTab === 'PENDING'
              ? 'Approval Queue Clean'
              : 'No Historical Decisions Recorded'}
          </h3>
          <p className="text-xs text-guard-muted">
            {activeTab === 'PENDING'
              ? 'All agent actions are currently authorized or enforced. Trigger Scenario B to test review routing.'
              : 'Decisions made by reviewers will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map((req) => (
            <div
              key={req.id}
              className="p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4 hover:border-guard-muted/40 transition-colors shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-guard-border pb-3">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-guard-warning animate-signal-pulse"></span>
                  <span className="font-mono text-xs font-semibold text-guard-signal">
                    {req.id}
                  </span>
                  <span className="text-[11px] font-mono text-guard-muted">
                    EVENT: {req.event_id}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      req.status === 'PENDING'
                        ? 'border-guard-warning/40 text-guard-warning bg-guard-warning/10'
                        : req.status === 'APPROVED'
                        ? 'border-guard-success/40 text-guard-success bg-guard-success/10'
                        : 'border-guard-critical/40 text-guard-critical bg-guard-critical/10'
                    }`}
                  >
                    {req.status}
                  </span>
                  <span className="text-guard-muted text-[11px]">
                    Created: {new Date(req.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Grid Context */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3 rounded bg-guard-surface border border-guard-border">
                  <div className="text-[10px] text-guard-muted uppercase">Requesting Agent</div>
                  <div className="font-semibold text-guard-text text-sm mt-1">{req.agent_id}</div>
                  <div className="text-[11px] text-guard-signal mt-0.5">Action: {req.action}</div>
                </div>

                <div className="p-3 rounded bg-guard-surface border border-guard-border">
                  <div className="text-[10px] text-guard-muted uppercase">Risk Score Assessment</div>
                  <div
                    className={`text-lg font-bold mt-0.5 ${
                      req.risk_score >= 70
                        ? 'text-guard-critical'
                        : req.risk_score >= 40
                        ? 'text-guard-warning'
                        : 'text-guard-success'
                    }`}
                  >
                    {req.risk_score}/100
                  </div>
                  <div className="text-[10px] text-guard-muted mt-0.5">
                    Pre-execution safety revalidation required
                  </div>
                </div>

                <div className="p-3 rounded bg-guard-surface border border-guard-border">
                  <div className="text-[10px] text-guard-muted uppercase">Execution Status</div>
                  <div className="font-semibold text-guard-text text-sm mt-1">
                    {req.executed_at ? 'EXECUTED' : 'UNMUTATED'}
                  </div>
                  <div className="text-[10px] text-guard-muted mt-0.5">
                    {req.executed_at
                      ? `Timestamp: ${new Date(req.executed_at).toLocaleTimeString()}`
                      : 'Pending dual sign-off'}
                  </div>
                </div>
              </div>

              {/* Parameters & Review Reasons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase text-guard-muted">
                    Proposed Parameters:
                  </div>
                  <pre className="p-2.5 rounded bg-guard-surface border border-guard-border text-[11px] font-mono text-guard-text overflow-x-auto">
                    {JSON.stringify(req.parameters, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase text-guard-muted">
                    Triggered Guardrail Reasons:
                  </div>
                  <ul className="p-2.5 rounded bg-guard-surface border border-guard-border space-y-1 text-xs font-mono text-guard-text min-h-[70px]">
                    {req.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-guard-warning">
                        <span>•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Reviewer Details if decided */}
              {req.reviewer_id && (
                <div className="p-3 rounded bg-guard-surface border border-guard-border font-mono text-xs flex items-center justify-between text-guard-muted">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-guard-signal" />
                    <span>Reviewer: {req.reviewer_id}</span>
                  </span>
                  <span className="text-guard-text italic truncate max-w-md">
                    "{req.reviewer_comment}"
                  </span>
                </div>
              )}

              {/* Execution Receipt if approved & executed */}
              {req.execution_receipt && (
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase text-guard-success">
                    Execution Receipt (SIMULATED):
                  </div>
                  <pre className="p-2.5 rounded bg-guard-surface border border-guard-success/40 text-[11px] font-mono text-guard-success overflow-x-auto">
                    {JSON.stringify(req.execution_receipt, null, 2)}
                  </pre>
                </div>
              )}

              {/* Action Buttons for Pending Request */}
              {req.status === 'PENDING' && (
                <div className="pt-3 border-t border-guard-border flex items-center justify-end gap-3 font-mono">
                  <button
                    onClick={() => handleOpenAction(req, 'REJECT')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-guard-critical/10 hover:bg-guard-critical/20 border border-guard-critical/40 text-guard-critical text-xs font-semibold transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Action</span>
                  </button>
                  <button
                    onClick={() => handleOpenAction(req, 'APPROVE')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-guard-signal text-black hover:bg-[#a6e65a] text-xs font-semibold transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 fill-black text-guard-signal" />
                    <span>Approve & Execute</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision Dialog Modal */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-guard-surface border border-guard-border rounded-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-guard-border pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-guard-signal" />
                <h3 className="text-sm font-semibold text-guard-text">
                  {actionType === 'APPROVE' ? 'Authorize Action Execution' : 'Reject Action'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedRequest(null)
                  setActionType(null)
                }}
                className="p-1 text-guard-muted hover:text-guard-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded bg-guard-critical/20 border border-guard-critical/40 text-xs font-mono text-guard-critical flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded bg-guard-panel border border-guard-border space-y-1 text-[11px]">
                <div>
                  <span className="text-guard-muted">Request ID:</span>{' '}
                  <span className="text-guard-text">{selectedRequest.id}</span>
                </div>
                <div>
                  <span className="text-guard-muted">Agent:</span>{' '}
                  <span className="text-guard-text">{selectedRequest.agent_id}</span>
                </div>
                <div>
                  <span className="text-guard-muted">Action:</span>{' '}
                  <span className="text-guard-signal">{selectedRequest.action}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Reviewer Identity
                </label>
                <input
                  type="text"
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Audited Reviewer Justification Comment (Mandatory)
                </label>
                <textarea
                  value={reviewerComment}
                  onChange={(e) => setReviewerComment(e.target.value)}
                  placeholder="State the verification evidence or reason for decision..."
                  className="w-full p-2.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal font-sans text-xs"
                  rows={3}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-guard-border flex justify-end gap-2 font-mono">
              <button
                onClick={() => {
                  setSelectedRequest(null)
                  setActionType(null)
                }}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded bg-guard-panel border border-guard-border text-xs text-guard-muted hover:text-guard-text"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDecision}
                disabled={isSubmitting}
                className={`px-4 py-1.5 rounded font-semibold text-xs transition-colors flex items-center gap-1.5 ${
                  actionType === 'APPROVE'
                    ? 'bg-guard-signal text-black hover:bg-[#a6e65a]'
                    : 'bg-guard-critical text-white hover:bg-red-600'
                }`}
              >
                {isSubmitting ? (
                  <span>Processing...</span>
                ) : (
                  <span>Confirm {actionType === 'APPROVE' ? 'Approval' : 'Rejection'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
