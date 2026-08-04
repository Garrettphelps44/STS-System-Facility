// Ported from reference/reference:Index.html (~lines 3286-3297, 3344-3360)
// — the fixed movement list and PSC formula. Every EXDB-matched,
// deduped movement across the 5 pool categories (not one per category —
// verified against the real POOL/EXDB data: 30 raw entries, 22 survive
// the match+dedup), each evaluated at that pool entry's default
// set/rep/tempo scheme.
import { POOL } from '../build-program/engine/pool'
import { EXDB, wkMatch, wkValue } from '../build-program/engine/workload'
import { setsRepsFrom } from '../floor-log/floorEngine'

const ASSESS_POOLS = ['mainStrength', 'main2Strength', 'accStrength', 'durability', 'arms']
export const ASSESS_REF_PER_DAY = 5

export const ASSESS_MOVES = (() => {
  const seen = new Set()
  const out = []
  ASSESS_POOLS.forEach((cat) => {
    ;(POOL[cat] || []).forEach((m) => {
      const key = wkMatch(m.n)
      if (!key || EXDB[key] == null || seen.has(key)) return
      const { sets, reps } = setsRepsFrom(m.s[0])
      const tempo = String(m.s[0]).split(' ')[1] || ''
      seen.add(key)
      out.push({ key, label: m.n, sets: sets || 3, reps: reps || 8, tempo })
    })
  })
  return out
})()

// weights: { movementKey: weightLbs }. Returns null if nothing usable
// was entered (mirrors the reference's "enter at least one working
// weight" guard).
export function computePSC(weights, heightFeet, heightInches) {
  const avs = []
  ASSESS_MOVES.forEach((m) => {
    const w = weights[m.key]
    if (w == null || isNaN(w) || w <= 0) return
    let av = 0
    for (let si = 1; si <= m.sets; si++) {
      const v = wkValue(m.key, heightFeet, heightInches, si, w, m.reps, m.tempo)
      if (v != null) av += v
    }
    if (av > 0) avs.push(av)
  })
  if (!avs.length) return null
  const mean = avs.reduce((a, b) => a + b, 0) / avs.length
  return Math.round(mean * ASSESS_REF_PER_DAY * 100) / 100
}
