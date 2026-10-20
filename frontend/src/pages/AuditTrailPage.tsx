import React, { useEffect, useState } from 'react'
import {
  FileCheck2,
  ShieldCheck,
  ShieldAlert,
  Download,
  Database,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Bug,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { api } from '../services/api'
import { AuditEntry, AuditVerifyResult } from '../types'

export const AuditTrailPage: React.FC = () => {
  const [records, setRecords] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isTamperedDemo, setIsTamperedDemo] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 25

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const data = await api.getAuditRecords(limit, offset)
      setRecords(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setIsVerifying(true)
    try {
      const result = await api.verifyAudit()
      setVerifyResult(result)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsVerifying(false)
    }
  }

  useEffect(() => {
    fetchRecords()
    handleVerify()
  }, [offset])

  const handleToggleTampering = async () => {
    const nextTamperState = !isTamperedDemo
    try {
      await api.simulateTampering(nextTamperState)
      setIsTamperedDemo(nextTamperState)
      await fetchRecords()
      await handleVerify()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-guard-text">
            Tamper-Evident Audit Trail
          </h1>
          <p className="text-xs text-guard-muted">
            Append-only cryptographic ledger linked via sequential SHA-256 hashes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tamper Simulation Toggle */}
          <button
            onClick={handleToggleTampering}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded border text-xs font-mono transition-all ${
              isTamperedDemo
                ? 'bg-guard-critical/20 text-guard-critical border-guard-critical/50'
                : 'bg-guard-panel hover:bg-guard-panel/80 text-guard-muted hover:text-guard-text border-guard-border'
            }`}
            title="Demonstration helper to test cryptographic verification"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>{isTamperedDemo ? 'Restore Pristine Audit' : 'Simulate DB Tampering'}</span>
          </button>

          <a
            href={api.exportAuditCsvUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-guard-panel hover:bg-guard-panel/80 border border-guard-border text-xs font-mono text-guard-text transition-all"
          >
            <Download className="w-3.5 h-3.5 text-guard-signal" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="flex items-center gap-2 px-4 py-1.5 rounded bg-guard-signal text-black font-semibold text-xs hover:bg-[#a6e65a] transition-all font-mono shadow-sm"
          >
            {isVerifying ? (
              <>
                <Activity className="w-3.5 h-3.5 animate-spin" />
                <span>Hashing Ledger...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 fill-black text-guard-signal" />
                <span>Verify Integrity</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {verifyResult && (
        <div
          className={`p-4 rounded-lg border flex items-start gap-4 transition-all ${
            verifyResult.is_valid
              ? 'bg-guard-success/10 border-guard-success/30'
              : 'bg-guard-critical/15 border-guard-critical/50 animate-pulse'
          }`}
        >
          {verifyResult.is_valid ? (
            <CheckCircle2 className="w-5 h-5 text-guard-success shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-guard-critical shrink-0 mt-0.5" />
          )}

          <div className="flex-1 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span
                className={`font-bold ${
                  verifyResult.is_valid ? 'text-guard-success' : 'text-guard-critical'
                }`}
              >
                {verifyResult.is_valid
                  ? 'CRYPTOGRAPHIC INTEGRITY VERIFIED (SHA-256)'
                  : 'TAMPER DETECTED: CRYPTOGRAPHIC CHAIN CORRUPTED'}
              </span>
              <span className="text-[11px] text-guard-muted">
                Verified: {new Date(verifyResult.verified_at).toLocaleTimeString()}
              </span>
            </div>

            <p className="text-guard-text mt-1 font-sans">{verifyResult.details}</p>

            {!verifyResult.is_valid && (
              <div className="mt-2 p-2.5 rounded bg-guard-surface border border-guard-critical/40 space-y-1 text-[11px]">
                <div>
                  <span className="text-guard-muted">Tampered Record Index:</span>{' '}
                  <span className="text-guard-critical font-bold">
                    #{verifyResult.tampered_record_id}
                  </span>
                </div>
                <div className="break-all">
                  <span className="text-guard-muted">Expected Hash:</span>{' '}
                  <span className="text-guard-success">{verifyResult.expected_hash}</span>
                </div>
                <div className="break-all">
                  <span className="text-guard-muted">Actual Hash:</span>{' '}
                  <span className="text-guard-critical">{verifyResult.actual_hash}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security Architectural Notice */}
      <div className="p-4 rounded-lg bg-guard-panel border border-guard-border flex items-start gap-3 text-xs text-guard-muted">
        <Lock className="w-4 h-4 text-guard-signal shrink-0 mt-0.5" />
        <div className="leading-relaxed font-sans">
          <span className="font-semibold text-guard-text">Tamper-Evident Security Model:</span> Each audit record encapsulates the canonical SHA-256 hash of its predecessor (<code className="text-guard-signal font-mono text-[11px]">prev_hash</code>), forming an immutable hash chain. Any direct record modification, reordering, or deletion invalidates the chain from that point forward and is flagged instantly during verification.
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-lg bg-guard-panel border border-guard-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-guard-border bg-guard-surface/80 text-guard-muted uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Agent ID</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-guard-border/40">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-guard-surface/60 transition-colors">
                  <td className="py-3 px-4 text-guard-muted font-bold text-[11px]">
                    {r.id}
                  </td>
                  <td className="py-3 px-4 text-guard-muted text-[11px]">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-guard-text font-semibold">
                    {r.agent_id}
                  </td>
                  <td className="py-3 px-4 text-guard-signal text-[11px]">
                    {r.action}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        r.decision.includes('ALLOW') || r.decision.includes('APPROVED')
                          ? 'border-guard-success/40 text-guard-success bg-guard-success/10'
                          : r.decision.includes('REVIEW')
                          ? 'border-guard-warning/40 text-guard-warning bg-guard-warning/10'
                          : 'border-guard-critical/40 text-guard-critical bg-guard-critical/10'
                      }`}
                    >
                      {r.decision}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-guard-muted text-[11px]">
                    {r.execution_outcome}
                  </td>
                  <td className="py-3 px-4 text-[10px] text-guard-muted font-mono max-w-xs truncate">
                    <span className="text-guard-signal">{r.current_hash.slice(0, 16)}...</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Strip */}
        <div className="p-4 border-t border-guard-border flex items-center justify-between text-xs font-mono text-guard-muted">
          <span>
            Showing {records.length} of {total} audit records
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
    </div>
  )
}
