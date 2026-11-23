import { supabase } from '../../lib/supabase'

// ---------- teams ----------

export async function fetchTeams(facilityId) {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, team_members(athlete_id)')
    .eq('facility_id', facilityId)
    .order('name')
  if (error) throw error
  return data.map((t) => ({ id: t.id, name: t.name, members: t.team_members.map((m) => m.athlete_id) }))
}

export async function addTeam(facilityId, name) {
  const { data, error } = await supabase
    .from('teams')
    .insert({ facility_id: facilityId, name })
    .select('id, name')
    .single()
  if (error) throw error
  return { ...data, members: [] }
}

export async function renameTeam(id, name) {
  const { error } = await supabase.from('teams').update({ name }).eq('id', id)
  if (error) throw error
}

// team_members cascades on delete (composite FK), so this drops the
// grouping without touching athletes. The team's attendance marks are NOT
// deleted: a BEFORE DELETE trigger (0009) detaches them (team_id -> null)
// so they keep counting toward each athlete's Report.
export async function deleteTeam(id) {
  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) throw error
}

export async function addTeamMember(facilityId, teamId, athleteId) {
  const { error } = await supabase
    .from('team_members')
    .upsert({ facility_id: facilityId, team_id: teamId, athlete_id: athleteId }, { onConflict: 'team_id,athlete_id', ignoreDuplicates: true })
  if (error) throw error
}

// Removes the grouping link only — the athlete and every attendance
// record they have, including this team's, stay untouched.
export async function removeTeamMember(teamId, athleteId) {
  const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('athlete_id', athleteId)
  if (error) throw error
}

// ---------- attendance ----------

// One shot for the whole facility — grid cell counts, season stats, and
// week/month grouping are all derived client-side from this, same
// fetch-once-derive-in-memory pattern Tracker uses for test_entries.
export async function fetchAttendance(facilityId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('athlete_id, team_id, date, status')
    .eq('facility_id', facilityId)
  if (error) throw error
  return data
}

// A mark belongs to one athlete on one team on one date, so an athlete on
// two teams has two independent marks for the same day.
//
// Tapping the already-active status clears it (the reference's toggle
// behavior) — the attendance table's status column is NOT NULL with a
// check constraint, so "no status" is modeled as no row at all, not an
// empty-string value.
export async function setStatus(facilityId, teamId, athleteId, date, status) {
  if (!status) {
    const { error } = await supabase.from('attendance').delete().eq('team_id', teamId).eq('athlete_id', athleteId).eq('date', date)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('attendance')
    .upsert({ facility_id: facilityId, team_id: teamId, athlete_id: athleteId, date, status }, { onConflict: 'athlete_id,team_id,date' })
  if (error) throw error
}

// "All present" / "All absent" — one round trip for the whole team
// instead of one write per athlete, since this runs with the team
// physically waiting.
export async function bulkSetStatus(facilityId, teamId, athleteIds, date, status) {
  if (!athleteIds.length) return
  const rows = athleteIds.map((athleteId) => ({ facility_id: facilityId, team_id: teamId, athlete_id: athleteId, date, status }))
  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'athlete_id,team_id,date' })
  if (error) throw error
}

export async function clearCell(teamId, athleteIds, date) {
  if (!athleteIds.length) return
  const { error } = await supabase.from('attendance').delete().eq('team_id', teamId).eq('date', date).in('athlete_id', athleteIds)
  if (error) throw error
}

// Dates are global, not team-owned — deleting one clears it for every
// team/athlete in the facility, matching the reference.
export async function deleteDate(facilityId, date) {
  const { error } = await supabase.from('attendance').delete().eq('facility_id', facilityId).eq('date', date)
  if (error) throw error
}
