import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { NavigationRail } from './components/NavigationRail'
import { TopBar } from './components/TopBar'
import { SimulationRunnerModal } from './components/SimulationRunnerModal'
import { OverviewPage } from './pages/OverviewPage'
import { LiveActivityPage } from './pages/LiveActivityPage'
import { AgentRegistryPage } from './pages/AgentRegistryPage'
import { PolicyCenterPage } from './pages/PolicyCenterPage'
import { ApprovalQueuePage } from './pages/ApprovalQueuePage'
import { ThreatInvestigationPage } from './pages/ThreatInvestigationPage'
import { AuditTrailPage } from './pages/AuditTrailPage'
import { SettingsPage } from './pages/SettingsPage'
import { api } from './services/api'

export const App: React.FC = () => {
  const [backendConnected, setBackendConnected] = useState(false)
  const [protectionEnabled, setProtectionEnabled] = useState(true)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)
  const [openThreatsCount, setOpenThreatsCount] = useState(0)
  const [isSimulationOpen, setIsSimulationOpen] = useState(false)

  // Polling / Health & Status Check
  const refreshStatus = async () => {
    try {
      const health = await api.getHealth()
      setBackendConnected(true)
      setProtectionEnabled(health.protection_enabled)

      const overview = await api.getOverview()
      setPendingApprovalsCount(overview.pending_approvals)
      setOpenThreatsCount(overview.threats_detected)
    } catch {
      setBackendConnected(false)
    }
  }

  useEffect(() => {
    refreshStatus()
    const timer = setInterval(refreshStatus, 4000)
    return () => clearInterval(timer)
  }, [])

  // Listen to Server-Sent Events stream for live telemetry
  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/v1/events/stream')
      es.onmessage = (e) => {
        if (e.data && !e.data.startsWith(':')) {
          refreshStatus()
        }
      }
      es.onerror = () => {
        // SSE error, will fall back cleanly to polling
      }
    } catch {
      // ignore
    }
    return () => {
      if (es) es.close()
    }
  }, [])

  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-guard-bg text-guard-text font-sans bg-security-grid">
        {/* Navigation Rail */}
        <NavigationRail
          pendingApprovalsCount={pendingApprovalsCount}
          openThreatsCount={openThreatsCount}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            backendConnected={backendConnected}
            protectionEnabled={protectionEnabled}
            onOpenSimulation={() => setIsSimulationOpen(true)}
            onResetDemo={async () => {
              if (confirm('Reset demo environment to factory defaults?')) {
                await api.resetDemo()
                refreshStatus()
              }
            }}
          />

          <main className="flex-1 overflow-y-auto flex flex-col">
            <Routes>
              <Route
                path="/"
                element={
                  <OverviewPage onOpenSimulation={() => setIsSimulationOpen(true)} />
                }
              />
              <Route path="/activity" element={<LiveActivityPage />} />
              <Route path="/agents" element={<AgentRegistryPage />} />
              <Route path="/policies" element={<PolicyCenterPage />} />
              <Route path="/approvals" element={<ApprovalQueuePage />} />
              <Route path="/threats" element={<ThreatInvestigationPage />} />
              <Route path="/audit" element={<AuditTrailPage />} />
              <Route
                path="/settings"
                element={
                  <SettingsPage
                    protectionEnabled={protectionEnabled}
                    onProtectionChange={refreshStatus}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        {/* Global Simulation Modal */}
        <SimulationRunnerModal
          isOpen={isSimulationOpen}
          onClose={() => setIsSimulationOpen(false)}
          onActionComplete={refreshStatus}
        />
      </div>
    </Router>
  )
}

export default App
