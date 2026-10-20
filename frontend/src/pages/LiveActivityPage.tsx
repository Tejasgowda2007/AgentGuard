import React, { useEffect, useState } from 'react'
import {
  Activity,
  Search,
  Filter,
  Download,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Eye,
  X,
  Database,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { api } from '../services/api'
import { ActionEvent } from '../types'

export const LiveActivityPage: React.FC = () => {
  const [events, setEvents] = useState<ActionEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [selectedDecision, setSelectedDecision] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<ActionEvent | null>(null)
  const [offset, setOffset] = useState(0)
  const limit = 20

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await api.getEvents({
        agent_id: selectedAgent || undefined,
        decision: selectedDecision || undefined,
        action: selectedAction || undefined,
        search: search || undefined,
        limit,
        offset,
      })
      setEvents(res.items)
      setTotal(res.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [selectedAgent, selectedDecision, selectedAction, offset])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    fetchEvents()
  }

  const openDrawer = async (eventId: string) => {
    try {
      const full = await api.getEventDetails(eventId)
      setSelectedEvent(full)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-guard-text">Live Activity Explorer</h1>
          <p className="text-xs text-guard-muted">
            Search, filter, and inspect runtime agent actions intercepted by the security gateway.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={api.exportAuditCsvUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-guard-panel hover:bg-guard-panel/80 border border-guard-border hover:border-guard-muted/40 text-xs font-mono text-guard-text transition-all"
          >
            <Download className="w-3.5 h-3.5 text-guard-signal" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-lg bg-guard-panel border border-guard-border space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-guard-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event ID, action, agent, reasons..."
              className="w-full pl-9 pr-3 py-1.5 rounded bg-guard-surface border border-guard-border text-xs text-guard-text placeholder:text-guard-muted/60 focus:outline-none focus:border-guard-signal font-mono"
            />
          </div>

          <select
            value={selectedAgent}
            onChange={(e) => {
              setSelectedAgent(e.target.value)
              setOffset(0)
            }}
            className="px-3 py-1.5 rounded bg-guard-surface border border-guard-border text-xs text-guard-text focus:outline-none focus:border-guard-signal font-mono"
          >
            <option value="">All Agents</option>
            <option value="customer-support-agent">customer-support-agent</option>
            <option value="finance-operations-agent">finance-operations-agent</option>
            <option value="data-maintenance-agent">data-maintenance-agent</option>
          </select>

          <select
            value={selectedDecision}
            onChange={(e) => {
              setSelectedDecision(e.target.value)
              setOffset(0)
            }}
            className="px-3 py-1.5 rounded bg-guard-surface border border-guard-border text-xs text-guard-text focus:outline-none focus:border-guard-signal font-mono"
          >
            <option value="">All Decisions</option>
            <option value="ALLOW">ALLOW</option>
            <option value="BLOCK">BLOCK</option>
            <option value="REVIEW">REVIEW</option>
          </select>

          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value)
              setOffset(0)
            }}
            className="px-3 py-1.5 rounded bg-guard-surface border border-guard-border text-xs text-guard-text focus:outline-none focus:border-guard-signal font-mono"
          >
            <option value="">All Actions</option>
            <option value="read_customer">read_customer</option>
            <option value="send_email">send_email</option>
            <option value="issue_refund">issue_refund</option>
            <option value="transfer_customer_data">transfer_customer_data</option>
            <option value="delete_database_record">delete_database_record</option>
          </select>

          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-guard-signal text-black font-semibold text-xs hover:bg-[#a6e65a] transition-all font-mono"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Events Table */}
      <div className="rounded-lg bg-guard-panel border border-guard-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-guard-border bg-guard-surface/80 text-guard-muted uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Agent</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Execution Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-guard-border/40">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-guard-muted">
                    No action events match the current filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr
                    key={ev.event_id}
                    onClick={() => openDrawer(ev.event_id)}
                    className="hover:bg-guard-surface/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-guard-signal font-semibold">
                      {ev.event_id}
                    </td>
                    <td className="py-3 px-4 text-guard-muted text-[11px]">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-guard-text font-sans font-medium">
                      {ev.agent_name || ev.agent_id}
                    </td>
                    <td className="py-3 px-4 text-guard-text text-[11px] font-semibold">
                      {ev.action}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          ev.decision === 'ALLOW'
                            ? 'border-guard-success/40 text-guard-success bg-guard-success/10'
                            : ev.decision === 'REVIEW'
                            ? 'border-guard-warning/40 text-guard-warning bg-guard-warning/10'
                            : 'border-guard-critical/40 text-guard-critical bg-guard-critical/10'
                        }`}
                      >
                        {ev.decision}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold ${
                          ev.risk_score >= 70
                            ? 'text-guard-critical'
                            : ev.risk_score >= 40
                            ? 'text-guard-warning'
                            : 'text-guard-success'
                        }`}
                      >
                        {ev.risk_score}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {ev.executed ? (
                        <span className="text-guard-success">EXECUTED</span>
                      ) : ev.decision === 'REVIEW' ? (
                        <span className="text-guard-warning">PENDING APPROVAL</span>
                      ) : (
                        <span className="text-guard-muted">BLOCKED</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openDrawer(ev.event_id)
                        }}
                        className="p-1 text-guard-muted hover:text-guard-signal rounded group-hover:bg-guard-panel transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Strip */}
        <div className="p-4 border-t border-guard-border flex items-center justify-between text-xs font-mono text-guard-muted">
          <span>
            Showing {events.length} of {total} events
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-2.5 py-1 rounded bg-guard-surface border border-guard-border disabled:opacity-30 hover:border-guard-muted text-guard-text transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-2.5 py-1 rounded bg-guard-surface border border-guard-border disabled:opacity-30 hover:border-guard-muted text-guard-text transition-colors flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-Over Event Details Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-guard-surface border-l border-guard-border shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="h-14 px-6 border-b border-guard-border flex items-center justify-between bg-guard-panel">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Terminal className="w-4 h-4 text-guard-signal" />
                <span className="font-semibold text-guard-text">{selectedEvent.event_id}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 text-guard-muted hover:text-guard-text rounded hover:bg-guard-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-6 space-y-5 overflow-y-auto font-mono text-xs">
              {/* Summary Badges */}
              <div className="p-4 rounded bg-guard-panel border border-guard-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-guard-muted uppercase">DECISION</div>
                  <div className="mt-1">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold border ${
                        selectedEvent.decision === 'ALLOW'
                          ? 'border-guard-success/40 text-guard-success bg-guard-success/10'
                          : selectedEvent.decision === 'REVIEW'
                          ? 'border-guard-warning/40 text-guard-warning bg-guard-warning/10'
                          : 'border-guard-critical/40 text-guard-critical bg-guard-critical/10'
                      }`}
                    >
                      {selectedEvent.decision}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-guard-muted uppercase">RISK SCORE</div>
                  <div
                    className={`text-lg font-bold mt-0.5 ${
                      selectedEvent.risk_score >= 70
                        ? 'text-guard-critical'
                        : selectedEvent.risk_score >= 40
                        ? 'text-guard-warning'
                        : 'text-guard-success'
                    }`}
                  >
                    {selectedEvent.risk_score}/100
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-guard-muted uppercase">BUSINESS MUTATION</div>
                  <div className="text-xs text-guard-text font-semibold mt-1">
                    {selectedEvent.executed ? 'MUTATED (SIMULATED)' : 'NONE / BLOCKED'}
                  </div>
                </div>
              </div>

              {/* Action & Agent Specs */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase text-guard-muted">Agent & Action Metadata</div>
                <div className="p-3 rounded bg-guard-panel border border-guard-border space-y-1 text-[11px]">
                  <div>
                    <span className="text-guard-muted">Agent ID:</span>{' '}
                    <span className="text-guard-text">{selectedEvent.agent_id}</span>
                  </div>
                  <div>
                    <span className="text-guard-muted">Action:</span>{' '}
                    <span className="text-guard-signal">{selectedEvent.action}</span>
                  </div>
                  <div>
                    <span className="text-guard-muted">Timestamp:</span>{' '}
                    <span className="text-guard-text">{selectedEvent.timestamp}</span>
                  </div>
                </div>
              </div>

              {/* Policy Checks Breakdown */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase text-guard-muted">14-Stage Gateway Checks</div>
                <div className="space-y-1.5">
                  {(selectedEvent.policy_checks || []).map((chk, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded bg-guard-panel border border-guard-border flex items-start gap-2.5"
                    >
                      {chk.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-guard-success shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-guard-critical shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-guard-text text-[11px]">
                            {chk.check_name}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded border ${
                              chk.passed
                                ? 'border-guard-success/30 text-guard-success'
                                : 'border-guard-critical/30 text-guard-critical'
                            }`}
                          >
                            {chk.severity}
                          </span>
                        </div>
                        <p className="text-[10px] text-guard-muted mt-0.5">{chk.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parameters Payload */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase text-guard-muted">Action Parameters</div>
                <pre className="p-3 rounded bg-guard-bg border border-guard-border text-[11px] text-guard-text overflow-x-auto">
                  {JSON.stringify(selectedEvent.parameters || {}, null, 2)}
                </pre>
              </div>

              {/* Execution Receipt if executed */}
              {selectedEvent.execution_receipt && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase text-guard-success">Simulated Business Receipt</div>
                  <pre className="p-3 rounded bg-guard-bg border border-guard-success/40 text-[11px] text-guard-success overflow-x-auto">
                    {JSON.stringify(selectedEvent.execution_receipt, null, 2)}
                  </pre>
                </div>
              )}

              {/* Audit Hash Chain Link */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase text-guard-muted flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-guard-signal" />
                  <span>SHA-256 Audit Ledger Node</span>
                </div>
                <div className="p-3 rounded bg-guard-panel border border-guard-border break-all text-[10px] text-guard-muted">
                  <div>
                    <span className="text-guard-signal">Current Hash:</span> {selectedEvent.audit_hash}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
