import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as trackerApi from '../tracker/trackerApi'
import * as api from './reportsApi'
import { buildReport } from './reportBuilder'
import { ReportCard } from './ReportCard'

// Athlete-role scoping here is a UX convenience, not the security
// boundary — trackerApi.fetchAthletes already only returns this user's
// own row for an athlete-role session (athletes_select RLS), so there's
// nothing to filter client-side; the dropdown just naturally has one
// option instead of hiding a real list.
export function ReportsModule() {
  const { membership } = useAuth()
  const facilityId = membership.facilityId
  const isAthlete = membership.role === 'athlete'

  const [athletes, setAthletes] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    let active = true
    trackerApi.fetchAthletes(facilityId)
      .then((a) => {
        if (!active) return
        setAthletes(a)
        if (a.length === 1) setSelectedId(a[0].id)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [facilityId])

  useEffect(() => {
    if (!selectedId) { setReport(null); return }
    let active = true
    setReportLoading(true)
    setError('')
    setShareUrl('')
    const athlete = athletes.find((a) => a.id === selectedId)
    api.fetchAllReportData(facilityId, selectedId)
      .then((data) => { if (active) setReport(buildReport(athlete, data)) })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setReportLoading(false))
    return () => { active = false }
  }, [selectedId, facilityId, athletes])

  async function handleShare() {
    if (!selectedId) return
    setSharing(true)
    setError('')
    try {
      const token = await api.createShare(facilityId, selectedId)
      const url = `${window.location.origin}${window.location.pathname}#report=${token}`
      setShareUrl(url)
      try { await navigator.clipboard.writeText(url) } catch { /* clipboard access not available, link is still shown */ }
    } catch (err) {
      setError(err.message)
    } finally {
      setSharing(false)
    }
  }

  if (loading) return <p className="sub">Loading Reports…</p>

  return (
    <div>
      <p className="eyebrow">Reports</p>
      <h2>Athlete Reports</h2>
      <p className="sub">One page per athlete — testing, attendance, and training progress in one place.</p>
      {error && <p className="error-text" role="alert">{error}</p>}

      {!isAthlete && athletes.length > 1 && (
        <label className="field" style={{ maxWidth: 340 }}>
          <span className="lab">Athlete</span>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Select athlete…</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.sport ? ` — ${a.sport}` : ''}</option>
            ))}
          </select>
        </label>
      )}

      {athletes.length === 0 && <p className="sub">No athletes yet — add one in Tracker first.</p>}
      {!selectedId && athletes.length > 1 && <p className="sub">Pick an athlete to see their report.</p>}
      {selectedId && reportLoading && <p className="sub">Loading report…</p>}

      {report && !reportLoading && (
        <ReportCard
          report={report}
          onPrint={() => window.print()}
          onShare={isAthlete ? undefined : (sharing ? undefined : handleShare)}
          shareUrl={shareUrl}
        />
      )}
    </div>
  )
}
