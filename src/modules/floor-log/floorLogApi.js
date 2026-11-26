import { supabase } from '../../lib/supabase'

// Race-safe get-or-create for one athlete+date session, same pattern as
// trackerApi's ensureDefaultMetrics: upsert+ignoreDuplicates instead of
// read-then-insert, because React StrictMode double-invokes effects in
// dev and two concurrent "does a session exist yet" checks would both
// see nothing and both try to insert.
export async function ensureSession(facilityId, athleteId, date) {
  const { error: upsertErr } = await supabase
    .from('floor_sessions')
    .upsert({ facility_id: facilityId, athlete_id: athleteId, date }, { onConflict: 'athlete_id,date', ignoreDuplicates: true })
  if (upsertErr) throw upsertErr
  const { data, error } = await supabase
    .from('floor_sessions')
    .select('id, date, projected, asc_override, day_index')
    .eq('athlete_id', athleteId)
    .eq('date', date)
    .single()
  if (error) throw error
  return data
}

// Every logged session's total (asc_override if set, else the sum of
// its sets' values) for one athlete — the raw material the A:C
// progression math groups by resolved program week.
export async function fetchAthleteHistory(facilityId, athleteId) {
  const { data: sessions, error: sessErr } = await supabase
    .from('floor_sessions')
    .select('id, date, asc_override, day_index')
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
  return sessions.map((s) => ({ date: s.date, dayIndex: s.day_index, total: s.asc_override != null ? Number(s.asc_override) : (sums[s.id] || 0) }))
}

// Every logged set (date/exercise/set_index/weight) across an athlete's
// whole floor-log history — the raw material for finding "what did they
// actually lift for this exercise, most recently" (progression.js's
// priorWeekWeights), as opposed to fetchAthleteHistory's per-session
// totals used by the whole-session A:C progression.
export async function fetchAthleteExerciseHistory(facilityId, athleteId) {
  const { data: sessions, error: sessErr } = await supabase
    .from('floor_sessions')
    .select('id, date, day_index')
    .eq('facility_id', facilityId)
    .eq('athlete_id', athleteId)
  if (sessErr) throw sessErr
  if (!sessions.length) return []
  const ids = sessions.map((s) => s.id)
  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]))
  const { data: logs, error: logErr } = await supabase
    .from('floor_logs')
    .select('session_id, exercise, set_index, weight')
    .in('session_id', ids)
    .not('weight', 'is', null)
  if (logErr) throw logErr
  return logs.map((l) => ({ date: byId[l.session_id].date, dayIndex: byId[l.session_id].day_index, exercise: l.exercise, setIndex: l.set_index, weight: Number(l.weight) }))
}

export async function fetchLogs(sessionId) {
  const { data, error } = await supabase
    .from('floor_logs')
    .select('id, exercise_index, exercise, target, prescribed, purpose, set_index, weight, reps, tempo, value')
    .eq('session_id', sessionId)
    .order('exercise_index', { ascending: true })
    .order('set_index', { ascending: true })
  if (error) throw error
  return data
}

// Seeds one blank set (set_index 0) per prescribed exercise, only meant
// to run once per session — same race-safety concern as ensureSession,
// so upsert+ignoreDuplicates against the (session_id, exercise_index,
// set_index) uniqueness rather than a plain insert.
export async function seedExercises(facilityId, sessionId, athleteId, prescribed) {
  if (!prescribed.length) return []
  const rows = prescribed.map((p, i) => ({
    facility_id: facilityId,
    session_id: sessionId,
    athlete_id: athleteId,
    exercise_index: i,
    exercise: p.exercise || '',
    target: p.target ?? null,
    prescribed: p.prescribed ?? null,
    purpose: p.purpose ?? null,
    set_index: 0,
    weight: null,
    reps: p.reps ?? null,
    tempo: null,
    value: null,
  }))
  const { error } = await supabase
    .from('floor_logs')
    .upsert(rows, { onConflict: 'session_id,exercise_index,set_index', ignoreDuplicates: true })
  if (error) throw error
  return fetchLogs(sessionId)
}

// The athlete's own session: blank exercise boxes the coach fills in (no
// program exercise in them, so prescribed stays null — that's how Floor
// Log tells an own session apart from a program day). Used for days with
// no programmed session, and for the "+" in the Training day row.
export const BLANK_EXERCISE_COUNT = 5

export async function seedBlankExercises(facilityId, sessionId, athleteId, count = BLANK_EXERCISE_COUNT) {
  const blank = Array.from({ length: count }, () => ({ exercise: '', target: null, prescribed: null, purpose: null, reps: null }))
  return seedExercises(facilityId, sessionId, athleteId, blank)
}

// "+": replace whatever this session has with 5 blank boxes, and clear
// its program day and PSC/ASC so the auto-fill re-runs for an own session.
export async function startOwnSession(facilityId, sessionId, athleteId) {
  const { error: logErr } = await supabase.from('floor_logs').delete().eq('session_id', sessionId)
  if (logErr) throw logErr
  const { error } = await supabase
    .from('floor_sessions')
    .update({ day_index: null, projected: null, asc_override: null })
    .eq('id', sessionId)
  if (error) throw error
  return seedBlankExercises(facilityId, sessionId, athleteId)
}

export async function addExerciseSlot(facilityId, sessionId, athleteId, exerciseIndex) {
  const { data, error } = await supabase
    .from('floor_logs')
    .insert({
      facility_id: facilityId,
      session_id: sessionId,
      athlete_id: athleteId,
      exercise_index: exerciseIndex,
      exercise: '',
      target: null,
      prescribed: null,
      purpose: null,
      set_index: 0,
      weight: null,
      reps: null,
      tempo: null,
      value: null,
    })
    .select('id, exercise_index, exercise, target, prescribed, purpose, set_index, weight, reps, tempo, value')
    .single()
  if (error) throw error
  return data
}

// Every set row under a slot repeats exercise/target/prescribed/purpose
// (denormalized, same style as the rest of this schema), so picking a
// movement updates every row sharing that exercise_index at once.
export async function setSlotExercise(sessionId, exerciseIndex, exercise) {
  const { error } = await supabase
    .from('floor_logs')
    .update({ exercise })
    .eq('session_id', sessionId)
    .eq('exercise_index', exerciseIndex)
  if (error) throw error
}

export async function removeExerciseSlot(sessionId, exerciseIndex) {
  const { error } = await supabase
    .from('floor_logs')
    .delete()
    .eq('session_id', sessionId)
    .eq('exercise_index', exerciseIndex)
  if (error) throw error
}

export async function updateSet(id, patch) {
  const { error } = await supabase.from('floor_logs').update(patch).eq('id', id)
  if (error) throw error
}

export async function addSet(facilityId, sessionId, athleteId, slot, setIndex, patch) {
  const { data, error } = await supabase
    .from('floor_logs')
    .insert({
      facility_id: facilityId,
      session_id: sessionId,
      athlete_id: athleteId,
      exercise_index: slot.exercise_index,
      exercise: slot.exercise,
      target: slot.target,
      prescribed: slot.prescribed,
      purpose: slot.purpose,
      set_index: setIndex,
      weight: patch.weight ?? null,
      reps: patch.reps ?? null,
      tempo: patch.tempo ?? null,
      value: null,
    })
    .select('id, exercise_index, exercise, target, prescribed, purpose, set_index, weight, reps, tempo, value')
    .single()
  if (error) throw error
  return data
}

// Puts this session on a different program day: clears its exercises and
// its PSC/ASC so the next load re-seeds that day's exercises and re-runs
// the auto-fill for it (that day's share of the week's PSC).
export async function switchSessionDay(sessionId, dayIndex) {
  const { error: logErr } = await supabase.from('floor_logs').delete().eq('session_id', sessionId)
  if (logErr) throw logErr
  const { error } = await supabase
    .from('floor_sessions')
    .update({ day_index: dayIndex, projected: null, asc_override: null })
    .eq('id', sessionId)
  if (error) throw error
}

export async function updateSession(sessionId, patch) {
  const { error } = await supabase.from('floor_sessions').update(patch).eq('id', sessionId)
  if (error) throw error
}

// "Cancel" — clears everything logged for this athlete+date (cascades to
// floor_logs) and lets the next load re-seed clean from the program.
export async function deleteSession(sessionId) {
  const { error } = await supabase.from('floor_sessions').delete().eq('id', sessionId)
  if (error) throw error
}
