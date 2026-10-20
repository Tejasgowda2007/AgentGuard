import React, { useEffect, useState } from 'react'
import {
  Flame,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Layers,
  ExternalLink,
  Edit2,
  FileText,
  X,
} from 'lucide-react'
import { api } from '../services/api'
import { ThreatAlert } from '../types'

export const ThreatInvestigationPage: React.FC = () => {
  const [alerts, setAlerts] = useState<ThreatAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<ThreatAlert | null>(null)
  const [analystNotes, setAnalystNotes] = useState('')
  const [newStatus, setNewStatus] = useState<string>('ACKNOWLEDGED')
  const [notification, setNotification] = useState<string | null>(null)

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const data = await api.getAlerts(statusFilter || undefined, severityFilter || undefined)
      setAlerts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [statusFilter, severityFilter])

  const handleOpenTriage = (alert: ThreatAlert) => {
    setSelectedAlert(alert)
    setNewStatus(alert.status)
    setAnalystNotes(alert.analyst_notes || '')
  }

  const handleSaveTriage = async () => {
    if (!selectedAlert) return
    try {
      await api.updateAlert(selectedAlert.id, {
        status: newStatus,
        analyst_notes: analystNotes,
      })
      setSelectedAlert(null)
      fetchAlerts()
      setNotification(`Alert ${selectedAlert.id} triaged to status '${newStatus}'. Change recorded in audit trail.`)
      setTimeout(() => setNotification(null), 4000)
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-guard-text">Threat Investigation</h1>
          <p className="text-xs text-guard-muted">
            Correlate security incidents, inspect attack vectors, and record forensic analyst triage decisions.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
      </div>

      {notification && (
        <div className="p-3 rounded bg-guard-signal/10 border border-guard-signal/30 text-xs font-mono text-guard-signal flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Incidents List */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="p-12 text-center rounded-lg bg-guard-panel border border-guard-border text-guard-muted space-y-2">
            <CheckCircle2 className="w-8 h-8 text-guard-success mx-auto opacity-70" />
            <h3 className="text-sm font-semibold text-guard-text">No Matching Threat Incidents</h3>
            <p className="text-xs text-guard-muted">All active threats resolved or filtered out.</p>
          </div>
        ) : (
          alerts.map((alt) => (
            <div
              key={alt.id}
              className="p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4 hover:border-guard-muted/40 transition-colors shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-guard-border pb-3">
                <div className="flex items-center gap-3">
                  <Flame
                    className={`w-4 h-4 ${
                      alt.severity === 'CRITICAL'
                        ? 'text-guard-critical'
                        : alt.severity === 'HIGH'
                        ? 'text-guard-warning'
                        : 'text-guard-info'
                    }`}
                  />
                  <h3 className="text-sm font-semibold text-guard-text font-sans">
                    {alt.title}
                  </h3>
                  {alt.is_seeded ? (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-guard-surface border border-guard-border text-guard-muted">
                      SEEDED DEMO
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-guard-critical/20 text-guard-critical border border-guard-critical/40 font-bold">
                      RUNTIME INCIDENT
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      alt.severity === 'CRITICAL'
                        ? 'border-guard-critical/40 text-guard-critical bg-guard-critical/10'
                        : alt.severity === 'HIGH'
                        ? 'border-guard-warning/40 text-guard-warning bg-guard-warning/10'
                        : 'border-guard-info/40 text-guard-info bg-guard-info/10'
                    }`}
                  >
                    {alt.severity}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      alt.status === 'OPEN'
                        ? 'border-guard-critical/40 text-guard-critical bg-guard-critical/10'
                        : alt.status === 'ACKNOWLEDGED'
                        ? 'border-guard-warning/40 text-guard-warning bg-guard-warning/10'
                        : 'border-guard-success/40 text-guard-success bg-guard-success/10'
                    }`}
                  >
                    {alt.status}
                  </span>
                </div>
              </div>

              {/* Reason & Correlation Details */}
              <div className="space-y-3 font-mono text-xs">
                <div className="text-xs text-guard-text font-sans leading-relaxed">
                  {alt.reason}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded bg-guard-surface border border-guard-border text-[11px]">
                  <div>
                    <span className="text-guard-muted">Related Agent:</span>{' '}
                    <span className="text-guard-signal font-semibold">{alt.agent_id}</span>
                  </div>
                  <div>
                    <span className="text-guard-muted">First Observed:</span>{' '}
                    <span className="text-guard-text">
                      {new Date(alt.first_observed).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-guard-muted">Last Observed:</span>{' '}
                    <span className="text-guard-text">
                      {new Date(alt.last_observed).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Correlated Event IDs */}
                <div className="flex items-center gap-2">
                  <span className="text-guard-muted text-[10px] uppercase">
                    Correlated Action Events:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {alt.related_event_ids.map((eid) => (
                      <span
                        key={eid}
                        className="px-2 py-0.5 rounded bg-guard-panel border border-guard-border text-[10px] text-guard-text"
                      >
                        {eid}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Analyst Notes */}
                {alt.analyst_notes && (
                  <div className="p-3 rounded bg-guard-panel border border-guard-border text-[11px] text-guard-muted">
                    <span className="text-guard-signal font-semibold">Analyst Notes:</span>{' '}
                    <span className="text-guard-text font-sans">{alt.analyst_notes}</span>
                  </div>
                )}
              </div>

              {/* Triage Action Button */}
              <div className="pt-3 border-t border-guard-border flex items-center justify-end font-mono">
                <button
                  onClick={() => handleOpenTriage(alt)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-guard-surface hover:bg-guard-panel border border-guard-border text-xs text-guard-signal transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Triage & Add Notes</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Triage Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-guard-surface border border-guard-border rounded-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-guard-border pb-3">
              <h3 className="text-sm font-semibold text-guard-text">
                Triage Incident: {selectedAlert.id}
              </h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1 text-guard-muted hover:text-guard-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded bg-guard-panel border border-guard-border">
                <div className="font-semibold text-guard-text font-sans mb-1">
                  {selectedAlert.title}
                </div>
                <div className="text-[11px] text-guard-muted">Agent: {selectedAlert.agent_id}</div>
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Investigation Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                >
                  <option value="OPEN">OPEN (Under Investigation)</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED (Triaged by Analyst)</option>
                  <option value="RESOLVED">RESOLVED (Mitigated / Benign)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Analyst Notes & Forensics Findings
                </label>
                <textarea
                  value={analystNotes}
                  onChange={(e) => setAnalystNotes(e.target.value)}
                  placeholder="Record root cause analysis, agent remediation, or false-positive notes..."
                  className="w-full p-2.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal font-sans text-xs"
                  rows={3}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-guard-border flex justify-end gap-2 font-mono">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-1.5 rounded bg-guard-panel border border-guard-border text-xs text-guard-muted hover:text-guard-text"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTriage}
                className="px-4 py-1.5 rounded bg-guard-signal text-black font-semibold text-xs hover:bg-[#a6e65a]"
              >
                Save Triage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
