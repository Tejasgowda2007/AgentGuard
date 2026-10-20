import React from 'react'
import {
  ShieldAlert,
  Server,
  Radio,
  PlayCircle,
  Building,
  User,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'

interface TopBarProps {
  backendConnected: boolean
  protectionEnabled: boolean
  onOpenSimulation: () => void
  onToggleKillSwitch?: () => void
  onResetDemo?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  backendConnected,
  protectionEnabled,
  onOpenSimulation,
  onToggleKillSwitch,
  onResetDemo,
}) => {
  return (
    <header className="h-16 bg-guard-surface border-b border-guard-border px-6 flex items-center justify-between z-10">
      {/* Left: Organization & Environment */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-guard-panel border border-guard-border text-xs font-medium text-guard-text">
          <Building className="w-3.5 h-3.5 text-guard-signal" />
          <span>Northstar Systems</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-guard-panel/70 border border-guard-border text-[11px] font-mono text-guard-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-guard-info"></span>
          <span>DEMO / LOCAL</span>
        </div>

        {/* Protection Posture Quick Banner */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
            protectionEnabled
              ? 'bg-guard-signal/10 border border-guard-signal/30 text-guard-signal'
              : 'bg-guard-critical/20 border border-guard-critical/50 text-guard-critical animate-pulse'
          }`}
        >
          {protectionEnabled ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-guard-signal"></span>
              <span>RUNTIME PROTECTION ACTIVE</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-guard-critical" />
              <span>KILL SWITCH ENGAGED (LOCKDOWN)</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Live Connection, Simulation Action, User Profile */}
      <div className="flex items-center gap-3">
        {/* Backend Connectivity Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-guard-panel/80 border border-guard-border text-xs font-mono">
          <Server
            className={`w-3.5 h-3.5 ${
              backendConnected ? 'text-guard-signal' : 'text-guard-critical'
            }`}
          />
          <span className="text-guard-muted">API:</span>
          <span
            className={
              backendConnected
                ? 'text-guard-signal font-semibold'
                : 'text-guard-critical font-semibold'
            }
          >
            {backendConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Live Event Stream Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-guard-panel/80 border border-guard-border text-xs font-mono text-guard-muted">
          <Radio className="w-3.5 h-3.5 text-guard-signal animate-signal-pulse" />
          <span>STREAM: LIVE</span>
        </div>

        {/* Quick Reset Demo button */}
        {onResetDemo && (
          <button
            onClick={onResetDemo}
            title="Reset demonstration data to baseline"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-guard-panel hover:bg-guard-panel/80 border border-guard-border hover:border-guard-muted/40 text-xs font-mono text-guard-muted hover:text-guard-text transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">Reset Demo</span>
          </button>
        )}

        {/* Simulation Action CTA */}
        <button
          onClick={onOpenSimulation}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-guard-signal text-[#090B0A] hover:bg-[#a6e65a] transition-all text-xs font-semibold shadow-sm tracking-wide"
        >
          <PlayCircle className="w-4 h-4 fill-black text-guard-signal" />
          <span>Run Simulation</span>
        </button>

        {/* User Identity */}
        <div className="flex items-center gap-2 pl-2 border-l border-guard-border">
          <div className="w-8 h-8 rounded bg-guard-panel border border-guard-border flex items-center justify-center text-guard-signal font-mono text-xs">
            <User className="w-4 h-4 text-guard-muted" />
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-medium text-guard-text">Eleanor Vance</div>
            <div className="text-[10px] font-mono text-guard-muted">SecOps Lead</div>
          </div>
        </div>
      </div>
    </header>
  )
}
