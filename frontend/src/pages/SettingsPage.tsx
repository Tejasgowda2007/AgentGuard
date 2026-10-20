import React, { useEffect, useState } from 'react'
import {
  Settings,
  Shield,
  ShieldAlert,
  Server,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  Cpu,
  Layers,
  Terminal,
  Activity,
  X,
} from 'lucide-react'
import { api } from '../services/api'

interface SettingsPageProps {
  protectionEnabled: boolean
  onProtectionChange?: () => void
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  protectionEnabled,
  onProtectionChange,
}) => {
  const [healthData, setHealthData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isConfirmingKillSwitch, setIsConfirmingKillSwitch] = useState(false)
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)
  const [operatorId, setOperatorId] = useState('secops-lead-admin')
  const [reason, setReason] = useState('Scheduled security maintenance test')
  const [actionInProgress, setActionInProgress] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const fetchHealth = async () => {
    setLoading(true)
    try {
      const data = await api.getHealth()
      setHealthData(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [protectionEnabled])

  const handleToggleKillSwitch = async () => {
    setActionInProgress(true)
    try {
      if (protectionEnabled) {
        await api.disableProtection(operatorId, reason)
        setNotification('EMERGENCY KILL SWITCH ENGAGED: Gateway locked down server-side.')
      } else {
        await api.enableProtection(operatorId, reason)
        setNotification('RUNTIME PROTECTION RESTORED: Policy enforcement re-activated.')
      }
      setIsConfirmingKillSwitch(false)
      if (onProtectionChange) onProtectionChange()
      fetchHealth()
      setTimeout(() => setNotification(null), 4000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionInProgress(false)
    }
  }

  const handleResetDemo = async () => {
    setActionInProgress(true)
    try {
      await api.resetDemo()
      setIsConfirmingReset(false)
      setNotification('Demonstration environment successfully reset to factory defaults.')
      if (onProtectionChange) onProtectionChange()
      fetchHealth()
      setTimeout(() => setNotification(null), 4000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionInProgress(false)
    }
  }

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-guard-text">Platform Settings & Control</h1>
        <p className="text-xs text-guard-muted">
          Manage runtime kill switches, system diagnostics, and demonstration state.
        </p>
      </div>

      {notification && (
        <div className="p-3 rounded bg-guard-signal/10 border border-guard-signal/30 text-xs font-mono text-guard-signal flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Emergency Kill Switch Panel */}
      <div className="p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-guard-border pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded flex items-center justify-center border ${
                protectionEnabled
                  ? 'bg-guard-surface border-guard-signal/30 text-guard-signal'
                  : 'bg-guard-critical/20 border-guard-critical text-guard-critical animate-pulse'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-guard-text">
                Server-Enforced Emergency Kill Switch
              </h2>
              <p className="text-xs text-guard-muted">
                Immediate platform-wide lockdown halting all proposed AI agent actions.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsConfirmingKillSwitch(true)}
            className={`px-4 py-2 rounded font-mono text-xs font-bold transition-all border ${
              protectionEnabled
                ? 'bg-guard-critical/10 text-guard-critical border-guard-critical/40 hover:bg-guard-critical/20'
                : 'bg-guard-signal text-black border-guard-signal hover:bg-[#a6e65a]'
            }`}
          >
            {protectionEnabled ? 'ENGAGE KILL SWITCH (LOCKDOWN)' : 'RESTORE RUNTIME PROTECTION'}
          </button>
        </div>

        <div className="text-xs text-guard-muted leading-relaxed font-sans space-y-2">
          <p>
            When engaged, the backend immediately halts all agent tool execution at Stage 4 of the decision pipeline, returning an authoritative lockdown denial response to any calling agent. All state changes are recorded in the SHA-256 audit ledger with the operator’s authenticated identity.
          </p>
          <div className="p-3 rounded bg-guard-surface border border-guard-border text-[11px] font-mono text-guard-muted">
            <span className="text-guard-signal font-semibold">Security Scope Note:</span> The AgentGuard kill switch strictly enforces control over all actions routed through this gateway. Real enterprise deployments mandate that agents have no direct bypass access to underlying business APIs.
          </div>
        </div>
      </div>

      {/* System Diagnostics & Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4">
          <div className="flex items-center gap-2 border-b border-guard-border pb-3">
            <Server className="w-4 h-4 text-guard-signal" />
            <h2 className="text-sm font-semibold text-guard-text">Gateway Telemetry Health</h2>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-guard-surface border border-guard-border">
              <span className="text-guard-muted">Service Status:</span>
              <span className="text-guard-success font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-guard-success"></span>
                {healthData?.status || 'HEALTHY'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-guard-surface border border-guard-border">
              <span className="text-guard-muted">Database Engine:</span>
              <span className="text-guard-text">SQLite 3 (Persistent WAL)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-guard-surface border border-guard-border">
              <span className="text-guard-muted">Environment Mode:</span>
              <span className="text-guard-info font-semibold">{healthData?.environment || 'DEMO / LOCAL'}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-guard-surface border border-guard-border">
              <span className="text-guard-muted">Gateway Version:</span>
              <span className="text-guard-text">{healthData?.version || '1.0.0'}</span>
            </div>
          </div>
        </div>

        {/* Demo Environment Management */}
        <div className="p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-guard-border pb-3">
              <RotateCcw className="w-4 h-4 text-guard-signal" />
              <h2 className="text-sm font-semibold text-guard-text">Demo Environment Reset</h2>
            </div>
            <p className="text-xs text-guard-muted mt-3 leading-relaxed">
              Safely resets local demonstration data, restoring factory agent permissions, default YAML policies, sample customer balances, and baseline threat incidents.
            </p>
          </div>

          <button
            onClick={() => setIsConfirmingReset(true)}
            className="w-full py-2.5 rounded bg-guard-surface hover:bg-guard-panel border border-guard-border hover:border-guard-muted text-xs font-mono text-guard-text transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo to Baseline State</span>
          </button>
        </div>
      </div>

      {/* Kill Switch Confirmation Modal */}
      {isConfirmingKillSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-guard-surface border border-guard-border rounded-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-guard-border pb-3">
              <h3 className="text-sm font-semibold text-guard-text flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-guard-critical" />
                <span>Confirm Emergency Kill Switch Action</span>
              </h3>
              <button
                onClick={() => setIsConfirmingKillSwitch(false)}
                className="p-1 text-guard-muted hover:text-guard-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-guard-muted font-sans leading-relaxed">
              {protectionEnabled
                ? 'Engaging the kill switch will immediately reject all automated agent operations across Northstar Systems.'
                : 'Re-enabling protection will re-activate deterministic policy checks and agent execution.'}
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Operator Identity
                </label>
                <input
                  type="text"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>

              <div>
                <label className="text-[10px] text-guard-muted uppercase block mb-1">
                  Audit Reason Justification
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-guard-text focus:outline-none focus:border-guard-signal"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-guard-border flex justify-end gap-2 font-mono">
              <button
                onClick={() => setIsConfirmingKillSwitch(false)}
                disabled={actionInProgress}
                className="px-4 py-1.5 rounded bg-guard-panel border border-guard-border text-xs text-guard-muted hover:text-guard-text"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleKillSwitch}
                disabled={actionInProgress}
                className={`px-4 py-1.5 rounded font-semibold text-xs transition-colors ${
                  protectionEnabled
                    ? 'bg-guard-critical text-white hover:bg-red-600'
                    : 'bg-guard-signal text-black hover:bg-[#a6e65a]'
                }`}
              >
                {actionInProgress ? 'Executing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Demo Confirmation Modal */}
      {isConfirmingReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-guard-surface border border-guard-border rounded-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-guard-border pb-3">
              <h3 className="text-sm font-semibold text-guard-text">Reset Demo Environment?</h3>
              <button
                onClick={() => setIsConfirmingReset(false)}
                className="p-1 text-guard-muted hover:text-guard-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-guard-muted font-sans leading-relaxed">
              This will re-initialize the SQLite database, resetting agents to default manifests, re-loading YAML policies, and resetting mock customer accounts and threat incidents.
            </p>

            <div className="pt-3 border-t border-guard-border flex justify-end gap-2 font-mono">
              <button
                onClick={() => setIsConfirmingReset(false)}
                disabled={actionInProgress}
                className="px-4 py-1.5 rounded bg-guard-panel border border-guard-border text-xs text-guard-muted hover:text-guard-text"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDemo}
                disabled={actionInProgress}
                className="px-4 py-1.5 rounded bg-guard-signal text-black font-semibold text-xs hover:bg-[#a6e65a]"
              >
                {actionInProgress ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
