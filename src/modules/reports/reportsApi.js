import { supabase } from '../../lib/supabase'

export async function fetchTestEntries(facilityId, athleteId) {
  const { data, error } = await supabase
    .from('test_entries')
    .select('date, metric_key, value')
    .eq('facility_id', facilityId)
    .eq('athlete_id', athleteId)
  if (error) throw error
  return data
}

export async function fetchMetrics(facilityId) {
  const { data, error } = await supabase
    .from('metrics')
    .select('key, label, unit, higher_is_better')
    .eq('facility_id', facilityId)
    .eq('active', true)
  if (error) throw error
  return data
}

export async function fetchAttendanceRows(facilityId, athleteId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('date, status')
    .eq('facility_id', facilityId)
    .eq('athlete_id', athleteId)
  if (error) throw error
  return data
}

// Same session-total shape Assessment's progression math already
// computes from floor_sessions/floor_logs — asc_override wins if set,
// else the sum of that session's logged set values.
export async function fetchFloorSessionTotals(facilityId, athleteId) {
  const { data: sessions, error: sessErr } = await supabase
    .from('floor_sessions')
    .select('id, date, projected, asc_override')
    .eq('facility_id', facilityId)
    .eq('athlete_id', athleteId)
  if (sessErr) throw sessErr
  if (!sessions.length) return []
  const ids = sessions.map((s) => s.id)
  const { data: logs, error: logErr } = await supabase
    .from('floor_logs')
    .select('session_id, value')
    .in('session_id', ids)
  if (logErr) throw logErr
  const sums = {}
  logs.forEach((l) => { if (l.value != null) sums[l.session_id] = (sums[l.session_id] || 0) + Number(l.value) })
  return sessions.map((s) => ({
    date: s.date,
    projected: s.projected != null ? Number(s.projected) : null,
    total: s.asc_override != null ? Number(s.asc_override) : (sums[s.id] || 0),
  }))
}

export async function fetchAssessment(facilityId, athleteId) {
  const { data, error } = await supabase
    .from('assessments')
    .select('psc, assessed_on')
    .eq('facility_id', facilityId)
    .eq('athlete_id', athleteId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchAllReportData(facilityId, athleteId) {
  const [entries, metrics, attendanceRows, floorSessions, assessment] = await Promise.all([
    fetchTestEntries(facilityId, athleteId),
    fetchMetrics(facilityId),
    fetchAttendanceRows(facilityId, athleteId),
    fetchFloorSessionTotals(facilityId, athleteId),
    fetchAssessment(facilityId, athleteId),
  ])
  return { entries, metrics, attendanceRows, floorSessions, assessment }
}

// Owner/coach only — blocked at the DB level by report_shares' write
// policy (can_write_facility) even if this were somehow called by an
// athlete-role session, not just hidden in the UI.
export async function createShare(facilityId, athleteId) {
  const { data, error } = await supabase
    .from('report_shares')
    .insert({ facility_id: facilityId, athlete_id: athleteId })
    .select('token')
    .single()
  if (error) throw error
  return data.token
}

// No auth session required — the anon key alone is enough to call this
// RPC, which is the whole point of a share link.
export async function fetchSharedReport(token) {
  const { data, error } = await supabase.rpc('get_shared_report', { p_token: token })
  if (error) throw error
  return data
}
