import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  ShieldAlert,
  Activity,
  Bot,
  Sliders,
  CheckSquare,
  Flame,
  FileCheck2,
  Settings,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'

interface NavigationRailProps {
  pendingApprovalsCount?: number
  openThreatsCount?: number
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  pendingApprovalsCount = 0,
  openThreatsCount = 0,
}) => {
  const navItems = [
    { to: '/', label: 'Overview', icon: ShieldCheck },
    { to: '/activity', label: 'Live Activity', icon: Activity },
    { to: '/agents', label: 'Agent Registry', icon: Bot },
    { to: '/policies', label: 'Policy Center', icon: Sliders },
    {
      to: '/approvals',
      label: 'Approval Queue',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeColor: 'bg-guard-warning text-black font-bold',
    },
    {
      to: '/threats',
      label: 'Threat Investigation',
      icon: Flame,
      badge: openThreatsCount > 0 ? openThreatsCount : undefined,
      badgeColor: 'bg-guard-critical text-white font-bold',
    },
    { to: '/audit', label: 'Audit Trail', icon: FileCheck2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <aside className="w-64 bg-guard-surface border-r border-guard-border flex flex-col justify-between shrink-0 select-none z-20">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-5 border-b border-guard-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-guard-panel border border-guard-signal/30 flex items-center justify-center font-mono font-bold text-guard-signal shadow-sm">
              AG
            </div>
            <div>
              <div className="font-semibold text-sm tracking-wide text-guard-text flex items-center gap-1.5">
                AgentGuard
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-guard-panel border border-guard-border text-guard-muted">
                  SOC
                </span>
              </div>
              <div className="text-[10px] font-mono text-guard-muted tracking-tight">
                AI RUNTIME SECURITY
              </div>
            </div>
          </div>
        </div>

        {/* Section Label */}
        <div className="px-5 pt-4 pb-1 text-[10px] font-mono uppercase tracking-wider text-guard-muted/70">
          Command Rail
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2.5 rounded text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-guard-panel text-guard-signal border border-guard-signal/30 font-semibold shadow-inner'
                    : 'text-guard-muted hover:text-guard-text hover:bg-guard-panel/50 border border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 shrink-0 transition-colors" />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined ? (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-guard-border bg-guard-panel/40">
        <div className="flex items-center justify-between text-[11px] text-guard-muted font-mono mb-1.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-guard-signal animate-signal-pulse"></span>
            ACTIVE GATEWAY
          </span>
          <span className="text-guard-muted/60">v1.0.0</span>
        </div>
        <div className="text-[10px] text-guard-muted/70 leading-relaxed font-sans">
          Deterministic 14-Stage Action Interceptor
        </div>
      </div>
    </aside>
  )
}
