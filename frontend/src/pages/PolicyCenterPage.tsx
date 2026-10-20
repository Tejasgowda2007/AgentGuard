import React, { useEffect, useState } from 'react'
import {
  Sliders,
  Shield,
  ShieldAlert,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Edit2,
  HelpCircle,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react'
import { api } from '../services/api'
import { PolicyRule } from '../types'

export const PolicyCenterPage: React.FC = () => {
  const [policies, setPolicies] = useState<PolicyRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPolicy, setEditingPolicy] = useState<PolicyRule | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  const fetchPolicies = async () => {
    setLoading(true)
    try {
      const data = await api.getPolicies()
      setPolicies(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPolicies()
  }, [])

  const handleToggleRule = async (rule: PolicyRule) => {
    try {
      await api.updatePolicy(rule.id, { is_enabled: !rule.is_enabled })
      fetchPolicies()
      setNotification(`Rule '${rule.name}' ${!rule.is_enabled ? 'enabled' : 'disabled'}.`)
      setTimeout(() => setNotification(null), 3000)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleResetDefaults = async () => {
    if (!confirm('Are you sure you want to reset all policies to factory YAML defaults?')) {
      return
    }
    try {
      await api.resetPolicies()
      fetchPolicies()
      setNotification('All policies safely restored to factory default configuration.')
      setTimeout(() => setNotification(null), 3000)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleSavePolicyEdit = async () => {
    if (!editingPolicy) return
    try {
      await api.updatePolicy(editingPolicy.id, {
        name: editingPolicy.name,
        description: editingPolicy.description,
        decision: editingPolicy.decision,
        severity: editingPolicy.severity,
        condition_json: editingPolicy.condition_json,
      })
      setEditingPolicy(null)
      fetchPolicies()
      setNotification(`Policy '${editingPolicy.name}' updated successfully.`)
      setTimeout(() => setNotification(null), 3000)
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-guard-text">Policy Center</h1>
          <p className="text-xs text-guard-muted">
            Configure deterministic guardrails, threshold review boundaries, and content filters.
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-2 px-3.5 py-2 rounded bg-guard-panel hover:bg-guard-panel/80 border border-guard-border text-xs font-mono text-guard-muted hover:text-guard-text transition-all shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5 text-guard-signal" />
          <span>Reset to Factory Defaults</span>
        </button>
      </div>

      {notification && (
        <div className="p-3 rounded bg-guard-signal/10 border border-guard-signal/30 text-xs font-mono text-guard-signal flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Precedence Banner */}
      <div className="p-5 rounded-lg bg-guard-panel border border-guard-border space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-guard-signal" />
          <h2 className="text-sm font-semibold text-guard-text">
            Deterministic Decision Precedence Hierarchy
          </h2>
        </div>
        <p className="text-xs text-guard-muted leading-relaxed font-sans">
          The AgentGuard gateway executes policy checks in a strict, non-bypassable sequence:
          Unregistered identity or disabled agent <span className="text-guard-critical font-mono font-bold">→ BLOCK</span>;
          hard-deny rules or database deletion <span className="text-guard-critical font-mono font-bold">→ BLOCK</span>;
          adversarial prompt-injection patterns <span className="text-guard-critical font-mono font-bold">→ BLOCK</span>;
          rate-limit breaches <span className="text-guard-critical font-mono font-bold">→ BLOCK</span>;
          monetary amounts exceeding approval thresholds <span className="text-guard-warning font-mono font-bold">→ REVIEW</span>;
          authorized, clean, low-risk actions <span className="text-guard-success font-mono font-bold">→ ALLOW</span>.
        </p>
      </div>

      {/* Policies List Table */}
      <div className="rounded-lg bg-guard-panel border border-guard-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-guard-border bg-guard-surface/80 text-guard-muted uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Policy Rule</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Action Scope</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-guard-border/40">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-guard-surface/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-guard-text font-sans text-xs">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-guard-muted font-sans mt-0.5 line-clamp-1">
                      {p.description}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-guard-muted text-[11px]">{p.rule_type}</td>
                  <td className="py-3 px-4 text-guard-signal text-[11px] font-semibold">
                    {p.action_pattern}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        p.decision === 'ALLOW'
                          ? 'border-guard-success/40 text-guard-success bg-guard-success/10'
                          : p.decision === 'REVIEW'
                          ? 'border-guard-warning/40 text-guard-warning bg-guard-warning/10'
                          : 'border-guard-critical/40 text-guard-critical bg-guard-critical/10'
                      }`}
                    >
                      {p.decision}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold ${
                        p.severity === 'CRITICAL'
                          ? 'text-guard-critical'
                          : p.severity === 'HIGH'
                          ? 'text-guard-warning'
                          : 'text-guard-info'
                      }`}
                    >
                      {p.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                        p.is_enabled
                          ? 'border-guard-success/30 text-guard-success'
                          : 'border-guard-muted/30 text-guard-muted'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          p.is_enabled ? 'bg-guard-success' : 'bg-guard-muted'
                        }`}
                      ></span>
                      {p.is_enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingPolicy(p)}
                        className="p-1 text-guard-muted hover:text-guard-text rounded hover:bg-guard-surface transition-colors"
                        title="Configure Rule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleRule(p)}
                        className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${
                          p.is_enabled
                            ? 'border-guard-border text-guard-muted hover:text-guard-critical hover:border-guard-critical/40'
                            : 'border-guard-signal/30 text-guard-signal hover:bg-guard-signal/10'
                        }`}
                      >
                        {p.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rule Modal */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-guard-surface border border-guard-border rounded-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-guard-border pb-3">
              <h3 className="text-sm font-semibold text-guard-text">
                Edit Policy Rule: {editingPolicy.id}
              </h3>
              <button
                onClick={() => setEditingPolicy(null)}
                className="p-1 text-guard-muted hover:text-guard-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Policy Name
                </label>
                <input
                  type="text"
                  value={editingPolicy.name}
                  onChange={(e) =>
                    setEditingPolicy({ ...editingPolicy, name: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Description
                </label>
                <textarea
                  value={editingPolicy.description}
                  onChange={(e) =>
                    setEditingPolicy({ ...editingPolicy, description: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal font-sans"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-guard-muted uppercase block mb-1">
                    Decision Outcome
                  </label>
                  <select
                    value={editingPolicy.decision}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        decision: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="BLOCK">BLOCK</option>
                    <option value="REVIEW">REVIEW</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-guard-muted uppercase block mb-1">
                    Severity
                  </label>
                  <select
                    value={editingPolicy.severity}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        severity: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Condition Specification (JSON)
                </label>
                <textarea
                  value={editingPolicy.condition_json}
                  onChange={(e) =>
                    setEditingPolicy({ ...editingPolicy, condition_json: e.target.value })
                  }
                  className="w-full p-2.5 rounded bg-guard-bg border border-guard-border text-[11px] font-mono text-guard-text focus:outline-none focus:border-guard-signal"
                  rows={3}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-guard-border flex justify-end gap-2 font-mono">
              <button
                onClick={() => setEditingPolicy(null)}
                className="px-4 py-1.5 rounded bg-guard-panel border border-guard-border text-xs text-guard-muted hover:text-guard-text"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePolicyEdit}
                className="px-4 py-1.5 rounded bg-guard-signal text-black font-semibold text-xs hover:bg-[#a6e65a]"
              >
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
