import React, { useEffect, useState } from 'react'
import {
  Bot,
  Plus,
  Shield,
  Clock,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Edit2,
  Activity,
  Layers,
  X,
} from 'lucide-react'
import { api } from '../services/api'
import { Agent } from '../types'

export const AgentRegistryPage: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newAgent, setNewAgent] = useState({
    id: '',
    name: '',
    description: '',
    environment: 'DEMO',
    status: 'ACTIVE' as const,
    allowed_actions: ['read_customer'],
    rate_limit_rpm: 15,
    risk_multiplier: 1.0,
  })

  const fetchAgents = async () => {
    setLoading(true)
    try {
      const data = await api.getAgents()
      setAgents(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  const handleToggleStatus = async (agent: Agent) => {
    const nextStatus = agent.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      await api.updateAgent(agent.id, { status: nextStatus })
      fetchAgents()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingAgent) return
    try {
      await api.updateAgent(editingAgent.id, {
        name: editingAgent.name,
        description: editingAgent.description,
        rate_limit_rpm: editingAgent.rate_limit_rpm,
        risk_multiplier: editingAgent.risk_multiplier,
        allowed_actions: editingAgent.allowed_actions,
      })
      setEditingAgent(null)
      fetchAgents()
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createAgent(newAgent)
      setIsCreateOpen(false)
      setNewAgent({
        id: '',
        name: '',
        description: '',
        environment: 'DEMO',
        status: 'ACTIVE',
        allowed_actions: ['read_customer'],
        rate_limit_rpm: 15,
        risk_multiplier: 1.0,
      })
      fetchAgents()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-guard-text">Agent Registry</h1>
          <p className="text-xs text-guard-muted">
            Manage authenticated agent identities, assigned permission envelopes, and runtime rate caps.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded bg-guard-signal text-black font-semibold text-xs hover:bg-[#a6e65a] transition-all font-mono shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Register Agent</span>
        </button>
      </div>

      {/* Agents Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((ag) => (
          <div
            key={ag.id}
            className="p-6 rounded-lg bg-guard-panel border border-guard-border flex flex-col justify-between space-y-4 hover:border-guard-muted/40 transition-colors shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-guard-surface border border-guard-border flex items-center justify-center text-guard-signal">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-guard-text">{ag.name}</h3>
                    <div className="text-[10px] font-mono text-guard-muted">{ag.id}</div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    ag.status === 'ACTIVE'
                      ? 'border-guard-success/40 text-guard-success bg-guard-success/10'
                      : 'border-guard-critical/40 text-guard-critical bg-guard-critical/10'
                  }`}
                >
                  {ag.status}
                </span>
              </div>

              <p className="text-xs text-guard-muted leading-relaxed line-clamp-2 mb-4">
                {ag.description || 'No description provided.'}
              </p>

              {/* Specs */}
              <div className="space-y-2 pt-3 border-t border-guard-border font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-guard-muted text-[11px]">Rate Limit:</span>
                  <span className="text-guard-text font-semibold">{ag.rate_limit_rpm} rpm</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-guard-muted text-[11px]">Risk Multiplier:</span>
                  <span className="text-guard-text font-semibold">{ag.risk_multiplier}x</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-guard-muted text-[11px]">Environment:</span>
                  <span className="text-guard-info text-[10px] uppercase font-semibold">
                    {ag.environment}
                  </span>
                </div>
              </div>

              {/* Allowed Actions */}
              <div className="mt-4 pt-3 border-t border-guard-border">
                <div className="text-[10px] font-mono uppercase text-guard-muted mb-2">
                  Permitted Privilege Envelope:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ag.allowed_actions.map((act) => (
                    <span
                      key={act}
                      className="px-2 py-0.5 rounded bg-guard-surface border border-guard-border text-[10px] font-mono text-guard-signal"
                    >
                      {act}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-4 border-t border-guard-border flex items-center justify-between gap-2">
              <button
                onClick={() => setEditingAgent(ag)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-guard-surface hover:bg-guard-surface/80 border border-guard-border text-xs font-mono text-guard-text transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Configure</span>
              </button>

              <button
                onClick={() => handleToggleStatus(ag)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                  ag.status === 'ACTIVE'
                    ? 'border-guard-critical/40 text-guard-critical hover:bg-guard-critical/10'
                    : 'border-guard-success/40 text-guard-success hover:bg-guard-success/10'
                }`}
              >
                {ag.status === 'ACTIVE' ? (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Disable Agent</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Enable Agent</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Agent Modal */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-guard-surface border border-guard-border rounded-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-guard-border pb-3">
              <h3 className="text-sm font-semibold text-guard-text">
                Configure Agent: {editingAgent.name}
              </h3>
              <button
                onClick={() => setEditingAgent(null)}
                className="p-1 text-guard-muted hover:text-guard-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={editingAgent.name}
                  onChange={(e) =>
                    setEditingAgent({ ...editingAgent, name: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Rate Limit (Requests per Minute)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingAgent.rate_limit_rpm}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      rate_limit_rpm: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Risk Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  value={editingAgent.risk_multiplier}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      risk_multiplier: parseFloat(e.target.value) || 1.0,
                    })
                  }
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Allowed Actions (Comma Separated)
                </label>
                <input
                  type="text"
                  value={editingAgent.allowed_actions.join(', ')}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      allowed_actions: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-guard-border flex justify-end gap-2 font-mono">
              <button
                onClick={() => setEditingAgent(null)}
                className="px-4 py-1.5 rounded bg-guard-panel border border-guard-border text-xs text-guard-muted hover:text-guard-text"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded bg-guard-signal text-black font-semibold text-xs hover:bg-[#a6e65a]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Agent Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateAgent}
            className="w-full max-w-lg bg-guard-surface border border-guard-border rounded-lg shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-guard-border pb-3">
              <h3 className="text-sm font-semibold text-guard-text">Register New Agent</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-guard-muted hover:text-guard-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Agent ID (Unique Slug)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. inventory-sync-agent"
                  value={newAgent.id}
                  onChange={(e) => setNewAgent({ ...newAgent, id: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inventory Sync Agent"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Primary responsibilities and operational scope..."
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal font-sans"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Permitted Actions (Comma Separated)
                </label>
                <input
                  type="text"
                  placeholder="read_customer, send_email"
                  value={newAgent.allowed_actions.join(', ')}
                  onChange={(e) =>
                    setNewAgent({
                      ...newAgent,
                      allowed_actions: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-guard-border flex justify-end gap-2 font-mono">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-1.5 rounded bg-guard-panel border border-guard-border text-xs text-guard-muted hover:text-guard-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-guard-signal text-black font-semibold text-xs hover:bg-[#a6e65a]"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
