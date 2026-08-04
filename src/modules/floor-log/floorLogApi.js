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
    .select('id, date, projected, asc_override')
    .eq('athlete_id', athleteId)
    .eq('date', date)
    .single()
  if (error) throw error
  return data
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
