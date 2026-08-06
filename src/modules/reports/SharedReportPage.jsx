import { useEffect, useState } from 'react'
import * as api from './reportsApi'
import { buildReport } from './reportBuilder'
import { ReportCard } from './ReportCard'
import { applyBrandingVars } from '../../theme/applyBranding'

// No auth, no AuthProvider, no facility membership — this is the
// anonymous no-login view a share link opens. Every field it renders
// came back from the get_shared_report RPC, which is the only thing an
// anonymous visitor can call; there is no other data access here.
export function SharedReportPage({ token }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.fetchSharedReport(token)
      .then((data) => {
        if (!active) return
        if (!data) { setError('This report link has expired or is no longer valid.'); return }
        // No AuthProvider on this page (see App.jsx) — nothing else ever
        // applies --green/--green-dim here, so this is the one place the
        // anonymous path has to do it itself, straight off the RPC's own
        // branding field.
        applyBrandingVars(data.branding)
        setReport(buildReport(data.athlete, {
          entries: data.testEntries,
          metrics: data.metrics,
          attendanceRows: data.attendance,
          floorSessions: data.floorSessions,
          assessment: data.assessment,
        }, data.branding))
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [token])

  if (loading) return <p className="wrap sub">Loading report…</p>
  if (error) return <p className="wrap error-text" role="alert">{error}</p>
  if (!report) return null

  return (
    <div className="wrap">
      <ReportCard report={report} onPrint={() => window.print()} />
    </div>
  )
}
