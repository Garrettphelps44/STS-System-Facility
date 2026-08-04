import { supabase } from '../../lib/supabase'

export async function fetchAssessment(facilityId, athleteId) {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, psc, weights, ref_per_day, assessed_on')
    .eq('facility_id', facilityId)
    .eq('athlete_id', athleteId)
    .maybeSingle()
  if (error) throw error
  return data
}

// One row per athlete, overwritten each time — matches the reference's
// a.assessment blob (no history).
export async function saveAssessment(facilityId, athleteId, { psc, weights, refPerDay, assessedOn }) {
  const { data, error } = await supabase
    .from('assessments')
    .upsert(
      { facility_id: facilityId, athlete_id: athleteId, psc, weights, ref_per_day: refPerDay, assessed_on: assessedOn },
      { onConflict: 'athlete_id' }
    )
    .select('id, psc, weights, ref_per_day, assessed_on')
    .single()
  if (error) throw error
  return data
}
