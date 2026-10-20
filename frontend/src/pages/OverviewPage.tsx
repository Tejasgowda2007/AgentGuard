import React, { useEffect, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Bot,
  Flame,
  Radio,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { SystemOverview } from '../types'

interface OverviewPageProps {
  onOpenSimulation: () => void
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onOpenSimulation }) => {
  const [overview, setOverview] = useState<SystemOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchOverview = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    try {
      const data = await api.getOverview()
      setOverview(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch security posture overview')
    } finally {
      setLoading(false)
      if (showRefresh) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchOverview()
    const timer = setInterval(() => fetchOverview(), 5000)
    return () => clearInterval(timer)
  }, [])

  if (loading && !overview) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-guard-muted font-mono text-sm">
          <Activity className="w-5 h-5 animate-spin text-guard-signal" />
          <span>Polling AgentGuard Security Telemetry...</span>
        </div>
      </div>
    )
  }

  if (error && !overview) {
    return (
      <div className="flex-1 p-8">
        <div className="p-6 rounded bg-guard-critical/10 border border-guard-critical/30 max-w-lg mx-auto text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-guard-critical mx-auto" />
          <h3 className="text-base font-semibold text-guard-text">Telemetry Gateway Unreachable</h3>
          <p className="text-xs text-guard-muted">{error}</p>
          <button
            onClick={() => fetchOverview(true)}
            className="px-4 py-2 rounded bg-guard-panel border border-guard-border text-xs font-mono text-guard-signal hover:border-guard-signal transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  const timeseriesData = overview?.timeseries || []
  const donutData = [
    { name: 'Allowed', value: overview?.allowed_count || 0, color: '#65D98B' },
    { name: 'Blocked', value: overview?.blocked_count || 0, color: '#FF6268' },
    { name: 'Review', value: overview?.review_count || 0, color: '#F2B84B' },
  ].filter((d) => d.value > 0)

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* A. Security Posture Header */}
      <div className="p-6 rounded-lg bg-guard-panel border border-guard-border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-guard-signal animate-signal-pulse"></span>
            <span className="text-xs font-mono uppercase tracking-wider text-guard-signal font-semibold">
              Agent Runtime Protection
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-guard-text">
            Security Operations Console
          </h1>
          <p className="text-xs text-guard-muted">
            Continuous real-time interception, policy evaluation, and cryptographic audit enforcement.
          </p>
        </div>

        {/* Posture Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto font-mono">
          <div className="p-3 rounded bg-guard-surface border border-guard-border">
            <div className="text-[10px] text-guard-muted uppercase">Protection State</div>
            <div
              className={`text-sm font-bold mt-1 ${
                overview?.protection_enabled ? 'text-guard-signal' : 'text-guard-critical'
              }`}
            >
              {overview?.protection_enabled ? 'ACTIVE' : 'LOCKDOWN'}
            </div>
          </div>

          <div className="p-3 rounded bg-guard-surface border border-guard-border">
            <div className="text-[10px] text-guard-muted uppercase">Active Agents</div>
            <div className="text-sm font-bold text-guard-text mt-1">
              {overview?.active_agents} online
            </div>
          </div>

          <div className="p-3 rounded bg-guard-surface border border-guard-border">
            <div className="text-[10px] text-guard-muted uppercase">Pending Approvals</div>
            <div
              className={`text-sm font-bold mt-1 ${
                (overview?.pending_approvals || 0) > 0
                  ? 'text-guard-warning'
                  : 'text-guard-text'
              }`}
            >
              {overview?.pending_approvals} requests
            </div>
          </div>

          <div className="p-3 rounded bg-guard-surface border border-guard-border">
            <div className="text-[10px] text-guard-muted uppercase">Last Synchronized</div>
            <div className="text-xs font-mono text-guard-muted mt-1 truncate">
              {overview?.last_updated
                ? new Date(overview.last_updated).toLocaleTimeString()
                : 'Just now'}
            </div>
          </div>
        </div>
      </div>

      {/* B. KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Actions Intercepted */}
        <div className="p-4 rounded-lg bg-guard-panel border border-guard-border">
          <div className="flex items-center justify-between text-guard-muted mb-2">
            <span className="text-[11px] font-mono uppercase">Intercepted</span>
            <Activity className="w-4 h-4 text-guard-info" />
          </div>
          <div className="text-2xl font-bold font-mono text-guard-text">
            {overview?.total_intercepted}
          </div>
          <div className="text-[10px] text-guard-muted font-mono mt-1">100% gateway routed</div>
        </div>

        {/* Actions Allowed */}
        <div className="p-4 rounded-lg bg-guard-panel border border-guard-border">
          <div className="flex items-center justify-between text-guard-muted mb-2">
            <span className="text-[11px] font-mono uppercase">Allowed</span>
            <CheckCircle2 className="w-4 h-4 text-guard-success" />
          </div>
          <div className="text-2xl font-bold font-mono text-guard-success">
            {overview?.allowed_count}
          </div>
          <div className="text-[10px] text-guard-muted font-mono mt-1">Authorized execution</div>
        </div>

        {/* Actions Blocked */}
        <div className="p-4 rounded-lg bg-guard-panel border border-guard-border">
          <div className="flex items-center justify-between text-guard-muted mb-2">
            <span className="text-[11px] font-mono uppercase">Blocked</span>
            <ShieldAlert className="w-4 h-4 text-guard-critical" />
          </div>
          <div className="text-2xl font-bold font-mono text-guard-critical">
            {overview?.blocked_count}
          </div>
          <div className="text-[10px] text-guard-muted font-mono mt-1">Zero unauthorized mutations</div>
        </div>

        {/* Awaiting Review */}
        <div className="p-4 rounded-lg bg-guard-panel border border-guard-border">
          <div className="flex items-center justify-between text-guard-muted mb-2">
            <span className="text-[11px] font-mono uppercase">In Review</span>
            <Clock className="w-4 h-4 text-guard-warning" />
          </div>
          <div className="text-2xl font-bold font-mono text-guard-warning">
            {overview?.review_count}
          </div>
          <div className="text-[10px] text-guard-muted font-mono mt-1">Dual-authorization</div>
        </div>

        {/* Threats Detected */}
        <div className="p-4 rounded-lg bg-guard-panel border border-guard-border">
          <div className="flex items-center justify-between text-guard-muted mb-2">
            <span className="text-[11px] font-mono uppercase">Threats</span>
            <Flame className="w-4 h-4 text-guard-critical" />
          </div>
          <div className="text-2xl font-bold font-mono text-guard-critical">
            {overview?.threats_detected}
          </div>
          <div className="text-[10px] text-guard-muted font-mono mt-1">Correlated incidents</div>
        </div>

        {/* Policy Violations */}
        <div className="p-4 rounded-lg bg-guard-panel border border-guard-border">
          <div className="flex items-center justify-between text-guard-muted mb-2">
            <span className="text-[11px] font-mono uppercase">Violations</span>
            <AlertTriangle className="w-4 h-4 text-guard-warning" />
          </div>
          <div className="text-2xl font-bold font-mono text-guard-warning">
            {overview?.policy_violations}
          </div>
          <div className="text-[10px] text-guard-muted font-mono mt-1">Enforced boundaries</div>
        </div>
      </div>

      {/* C & D: Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* C. Time-Series Activity Trend */}
        <div className="lg:col-span-8 p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-guard-text">Enforcement Telemetry Trend</h2>
              <p className="text-xs text-guard-muted">Hourly distribution of allow, block, and review decisions.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-guard-success">
                <span className="w-2.5 h-2.5 rounded bg-guard-success"></span> Allow
              </span>
              <span className="flex items-center gap-1.5 text-guard-critical">
                <span className="w-2.5 h-2.5 rounded bg-guard-critical"></span> Block
              </span>
              <span className="flex items-center gap-1.5 text-guard-warning">
                <span className="w-2.5 h-2.5 rounded bg-guard-warning"></span> Review
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="allowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#65D98B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#65D98B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6268" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FF6268" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="reviewGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F2B84B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F2B84B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#29322C" vertical={false} />
                <XAxis dataKey="time" stroke="#98A49A" fontSize={11} tickLine={false} />
                <YAxis stroke="#98A49A" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#101411',
                    borderColor: '#29322C',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Area type="monotone" dataKey="allow" stroke="#65D98B" strokeWidth={2} fillOpacity={1} fill="url(#allowGrad)" />
                <Area type="monotone" dataKey="block" stroke="#FF6268" strokeWidth={2} fillOpacity={1} fill="url(#blockGrad)" />
                <Area type="monotone" dataKey="review" stroke="#F2B84B" strokeWidth={2} fillOpacity={1} fill="url(#reviewGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* D. Decision Distribution Donut */}
        <div className="lg:col-span-4 p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-guard-text">Decision Ratio</h2>
            <p className="text-xs text-guard-muted">Proportion of authorized vs blocked actions.</p>
          </div>

          <div className="h-44 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#141916" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#101411',
                    borderColor: '#29322C',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-mono font-bold text-guard-text">
                {overview?.total_intercepted}
              </span>
              <span className="text-[10px] font-mono text-guard-muted uppercase">Events</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-guard-border text-center font-mono">
            <div>
              <div className="text-[10px] text-guard-muted">ALLOW</div>
              <div className="text-sm font-bold text-guard-success">{overview?.allowed_count}</div>
            </div>
            <div>
              <div className="text-[10px] text-guard-muted">BLOCK</div>
              <div className="text-sm font-bold text-guard-critical">{overview?.blocked_count}</div>
            </div>
            <div>
              <div className="text-[10px] text-guard-muted">REVIEW</div>
              <div className="text-sm font-bold text-guard-warning">{overview?.review_count}</div>
            </div>
          </div>
        </div>
      </div>

      {/* E & F: Live Event Feed & Risky Activity Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* E. Live Event Feed */}
        <div className="lg:col-span-8 p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-guard-signal animate-signal-pulse" />
              <h2 className="text-sm font-semibold text-guard-text">Live Action Interception Feed</h2>
            </div>
            <Link
              to="/activity"
              className="text-xs font-mono text-guard-signal hover:underline flex items-center gap-1"
            >
              <span>Explore All</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-guard-border text-guard-muted uppercase text-[10px]">
                <tr>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Risk</th>
                  <th className="pb-2">Decision</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-guard-border/40">
                {(overview?.recent_events || []).slice(0, 7).map((ev) => (
                  <tr key={ev.event_id} className="hover:bg-guard-surface/60 transition-colors">
                    <td className="py-2.5 text-guard-muted text-[11px]">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 text-guard-text font-sans font-medium text-xs">
                      {ev.agent_name || ev.agent_id}
                    </td>
                    <td className="py-2.5 text-guard-signal text-[11px]">{ev.action}</td>
                    <td className="py-2.5">
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
                    <td className="py-2.5">
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
                    <td className="py-2.5 text-guard-muted text-[11px] truncate max-w-xs font-sans">
                      {ev.reasons?.[0] || 'Standard policy check'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* F. Risky Activity & Pending Review Panel */}
        <div className="lg:col-span-4 p-6 rounded-lg bg-guard-panel border border-guard-border space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-guard-text">High-Risk Interceptions</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-guard-critical/20 text-guard-critical border border-guard-critical/40">
                Score ≥ 50
              </span>
            </div>
            <p className="text-xs text-guard-muted mb-4">
              Critical events requiring reviewer attention.
            </p>

            <div className="space-y-2.5">
              {(overview?.risky_events || []).slice(0, 4).map((r) => (
                <div
                  key={r.event_id}
                  className="p-3 rounded bg-guard-surface border border-guard-border hover:border-guard-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-guard-text font-mono">
                      {r.action}
                    </span>
                    <span className="text-xs font-mono font-bold text-guard-critical">
                      Risk {r.risk_score}
                    </span>
                  </div>
                  <div className="text-[11px] text-guard-muted truncate mb-1">
                    Agent: <span className="text-guard-text">{r.agent_id}</span>
                  </div>
                  <div className="text-[11px] text-guard-critical/90 line-clamp-1">
                    {r.reasons?.[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onOpenSimulation}
            className="w-full mt-4 py-2.5 rounded bg-guard-panel hover:bg-guard-panel/80 border border-guard-signal/40 hover:border-guard-signal text-xs font-semibold text-guard-signal transition-all flex items-center justify-center gap-2"
          >
            <span>Run Security Simulation</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
