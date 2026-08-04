// Ported as-is from reference/reference:Index.html (activeLanes line 1553,
// suggestedMax lines 1560-1577) — the old Build Program's "Groups" step.
// Not part of 52weekprogram.html's target flow; kept per instruction as a
// collapsed/optional panel, not one of the primary 00-06 steps. Needs the
// granular per-item equipment *counts*, not the boolean map the 00-06
// flow uses — this is exactly why the granular list stays available
// underneath step 02.

export function activeLanes(equipmentCounts) {
  let n = 0
  ;['racks', 'cables', 'dumbbells'].forEach((k) => {
    if (equipmentCounts[k] > 0) n++
  })
  return Math.max(n, 1)
}

export function suggestedMax(equipmentCounts) {
  const e = equipmentCounts, per = 4
  const total = Object.values(e).reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  let mainStations = e.racks
  if (mainStations === 0) mainStations = e.barbells + e.trapBars
  const base = mainStations * per
  if (base > 0) {
    let nudge = e.cables * 2 + e.dumbbells * 0.5
    nudge = Math.min(nudge, base * 0.5)
    return Math.round(base + nudge)
  }
  const alt = e.cables * per + e.dumbbells * 1 + e.kb * 1
  if (alt > 0) return Math.round(alt)
  return e.field || e.turf ? 20 : 12
}

// Splits a max-athlete count evenly across active lanes, matching the old
// renderStep2's group generation.
export function suggestedGroups(equipmentCounts, maxAthletes) {
  const lanes = activeLanes(equipmentCounts)
  const per = Math.ceil((maxAthletes || 0) / lanes)
  return Array.from({ length: lanes }, (_, i) => ({ tag: 'Group ' + String.fromCharCode(65 + i), count: per }))
}
