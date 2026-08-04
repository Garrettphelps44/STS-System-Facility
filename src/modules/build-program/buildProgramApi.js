import { supabase } from '../../lib/supabase'

// Lightweight list for the program switcher / saved-programs list — full
// constraints are only fetched when a specific program is opened.
export async function fetchPrograms(facilityId) {
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, system, start_date, created_at')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchProgram(id) {
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, system, constraints, start_date')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProgram(facilityId, { name, system, constraints, startDate }) {
  const { data, error } = await supabase
    .from('programs')
    .insert({ facility_id: facilityId, name, system, constraints, start_date: startDate })
    .select('id, name, system, constraints, start_date')
    .single()
  if (error) throw error
  return data
}

// Id-based, not name-based: save either creates a new row or updates the
// currently-open one, never matches/overwrites by name.
export async function updateProgram(id, { name, system, constraints, startDate }) {
  const { data, error } = await supabase
    .from('programs')
    .update({ name, system, constraints, start_date: startDate })
    .eq('id', id)
    .select('id, name, system, constraints, start_date')
    .single()
  if (error) throw error
  return data
}
