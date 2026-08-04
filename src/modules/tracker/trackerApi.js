import { supabase } from '../../lib/supabase'
import { DEFAULT_METRICS } from './metrics'

// ---------- athletes ----------

export async function fetchAthletes(facilityId) {
  const { data, error } = await supabase
    .from('athletes')
    .select('id, name, sport, sex, grad_year, height_feet, height_inches')
    .eq('facility_id', facilityId)
    .order('name')
  if (error) throw error
  return data
}

export async function addAthlete(facilityId, { name, sport, sex, gradYear, heightFeet, heightInches }) {
  const { data, error } = await supabase
    .from('athletes')
    .insert({
      facility_id: facilityId,
      name: name.trim(),
      sport: sport?.trim() || null,
      sex: sex || null,
      grad_year: gradYear || null,
      height_feet: heightFeet ?? null,
      height_inches: heightInches ?? null,
    })
    .select('id, name, sport, sex, grad_year, height_feet, height_inches')
    .single()
  if (error) throw error
  return data
}

export async function updateAthlete(id, patch) {
  const { error } = await supabase.from('athletes').update(patch).eq('id', id)
  if (error) throw error
}

// Deleting the athlete row cascades (via composite FK ON DELETE CASCADE)
// to their test_entries, floor_logs, attendance, and any team_members
// rows automatically — no separate cleanup needed here.
export async function deleteAthlete(id) {
  const { error } = await supabase.from('athletes').delete().eq('id', id)
  if (error) throw error
}

// Reset: wipes the roster (and, via cascade, every test_entries/floor_logs
// row tied to it) but leaves metrics and programs alone — same scope as
// the old app's resetTrack, which never touched track.metrics.
export async function resetRoster(facilityId) {
  const { error } = await supabase.from('athletes').delete().eq('facility_id', facilityId)
  if (error) throw error
}

// ---------- metrics ----------

export async function fetchMetrics(facilityId) {
  const { data, error } = await supabase
    .from('metrics')
    .select('id, key, label, unit, rank, higher_is_better, active, created_at')
    .eq('facility_id', facilityId)
    .order('created_at')
  if (error) throw error
  return data
}

// Lazily seeds DEFAULT_METRICS the first time a facility's Tracker loads
// with no metrics yet — the equivalent of the old app's
// `if(!track.metrics) track.metrics = DEFAULT_METRICS` first-load seed,
// just as a real insert instead of an in-memory default.
//
// Uses upsert+ignoreDuplicates (ON CONFLICT DO NOTHING) rather than
// "read, then insert if empty" — the read-then-write version has a race:
// React StrictMode alone double-invokes effects in dev, so two concurrent
// calls can both see zero rows and both try to insert, and the second
// hits the unique(facility_id, key) constraint. Letting the database's
// own constraint be the source of truth for "already seeded" avoids that
// race entirely instead of trying to out-think it client-side.
export async function ensureDefaultMetrics(facilityId) {
  const { error } = await supabase.from('metrics').upsert(
    DEFAULT_METRICS.map((m) => ({
      facility_id: facilityId,
      key: m.key,
      label: m.label,
      unit: m.unit,
      rank: m.rank,
      higher_is_better: m.higher,
    })),
    { onConflict: 'facility_id,key', ignoreDuplicates: true }
  )
  if (error) throw error
  return fetchMetrics(facilityId)
}

function slugKey(label) {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)
  return (base || 'metric') + '_' + Math.random().toString(36).slice(2, 6)
}

export async function addMetric(facilityId, { label, unit, higher }) {
  const { data, error } = await supabase
    .from('metrics')
    .insert({
      facility_id: facilityId,
      key: slugKey(label),
      label: label.trim(),
      unit: unit?.trim() || null,
      rank: true,
      higher_is_better: higher,
    })
    .select('id, key, label, unit, rank, higher_is_better, active, created_at')
    .single()
  if (error) throw error
  return data
}

// "Stop tracking" — soft-hide only. Existing test_entries for this
// metric_key are untouched (no FK/cascade involved in this update at all).
export async function deactivateMetric(id) {
  const { error } = await supabase.from('metrics').update({ active: false }).eq('id', id)
  if (error) throw error
}

// ---------- test entries ----------

// Fetches every entry for the facility in one shot; Test Database (one
// date at a time) and Leaderboards (all dates) both derive their view
// from this same in-memory set, refetched after any mutation.
export async function fetchEntries(facilityId) {
  const { data, error } = await supabase
    .from('test_entries')
    .select('id, athlete_id, date, metric_key, value')
    .eq('facility_id', facilityId)
  if (error) throw error
  return data
}

export async function upsertEntry(facilityId, { athleteId, metricKey, date, value }) {
  if (value == null) {
    const { error } = await supabase
      .from('test_entries')
      .delete()
      .eq('athlete_id', athleteId)
      .eq('metric_key', metricKey)
      .eq('date', date)
    if (error) throw error
    return null
  }
  const { data, error } = await supabase
    .from('test_entries')
    .upsert(
      { facility_id: facilityId, athlete_id: athleteId, metric_key: metricKey, date, value },
      { onConflict: 'athlete_id,metric_key,date' }
    )
    .select('id, athlete_id, date, metric_key, value')
    .single()
  if (error) throw error
  return data
}
