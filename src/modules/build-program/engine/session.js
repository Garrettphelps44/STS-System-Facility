// Ported as-is from reference/52weekprogram.html (lines 621-764) — the
// session-resolution engine (stageFor, blocks, resolveSession).
//
// One structural change from the reference, not a logic change: the
// original reads everything off a single shared, mutable module-level
// `C` object (`C.equipment`, `C.skill`, `C.system`, `C.sport`,
// `C.sessionLength`). That's fine for a single-page tool but wrong for
// an app with multiple facilities/programs live at once, so every
// function here takes an explicit `cx` (constraints) object —
// { system, sessionLength, equipment, skill, sport } — instead of
// reading a shared global. Every formula, branch, and constant below is
// unchanged from the reference.

import { POOL, CORE4, CONDITIONING, T1, T2, ACC_LABEL, LIGHT_POOLS, LIGHT_LABEL, SPORT_OFFSET } from './pool'
import { sysFor } from './systems'

export function eqFilter(pool, equipment) {
  return pool.filter((x) => !x.req || x.req.length === 0 || x.req.some((r) => equipment[r] > 0))
}

const skillRep = { none: 0, low: 1, med: 2, high: 3 }

export function stageFor(week, ex, mode, cx, o) {
  const base = ex.s[0]
  const m = base.match(/^(\d+)x(\d+)(.*)$/)
  if (mode === 'main') {
    const p = m ? { S0: +m[1], reps: +m[2], rest: m[3] || '' } : { S0: 3, reps: 3, rest: '' }
    return sysFor(cx.system).main(week, p, o || {})
  }
  if (m) {
    const S0 = +m[1], rest = m[3] || ''
    const reps = +m[2] + (skillRep[cx.skill] || 0)
    return { vol: `${S0}x${reps}${rest}`, prog: false }
  }
  return { vol: ex.s[0], prog: false }
}

const POOL_FALLBACK = { throws: 'power', mainStrength: 'mainBW' }
const BW_SAFETY = { n: 'Bodyweight Circuit', s: ['2x10'] }

export function pickEx(poolName, offset, equipment) {
  let pool = eqFilter(POOL[poolName], equipment)
  if (!pool.length && POOL_FALLBACK[poolName]) pool = eqFilter(POOL[POOL_FALLBACK[poolName]], equipment)
  if (!pool.length) pool = [BW_SAFETY]
  return pool[((offset % pool.length) + pool.length) % pool.length]
}

export function subAvailable(name, equipment) {
  const n = name.toLowerCase()
  if ((n.includes('kb') || n.includes('kettlebell')) && !equipment.kb) return false
  if ((n.startsWith('mb') || n.includes('med ball') || n.includes(' mb ')) && !equipment.medBalls) return false
  if (n.includes('db ') && !equipment.dumbbells) return false
  if (n.includes('band') && !equipment.bands) return false
  if (n.includes('ghd') && !equipment.ghd) return false
  if (n.includes('foam roller') && !equipment.foamRoller) return false
  if (n.includes('hang') && !equipment.pullUpBar) return false
  return true
}

export function core4For(dayIndex, meso, week, equipment) {
  return CORE4.map((c, i) => {
    const subs = c.sub.filter((s) => subAvailable(s, equipment))
    const list = subs.length ? subs : c.sub
    return { anchor: c.anchor, ex: list[(dayIndex + meso + i + week) % list.length] }
  })
}

export function coordFor(dayIndex, meso, week, equipment) {
  const pool = eqFilter(POOL.coordination, equipment)
  const list = pool.length ? pool : [{ n: 'Reaction / Footwork Drill', s: ['2x5'] }]
  return list[(dayIndex + meso + week) % list.length]
}

export function condItem(offset, cx) {
  const o = offset + (SPORT_OFFSET[cx.sport] || 0)
  const pool = CONDITIONING.filter((c) => c.req.length === 0 || c.req.some((r) => cx.equipment[r] > 0))
  const list = pool.length ? pool : CONDITIONING.filter((c) => c.req.length === 0)
  const safe = list.length ? list : [{ n: 'Bodyweight Conditioning Circuit', req: [] }]
  return safe[((o % safe.length) + safe.length) % safe.length]
}

export function finisherIdeas(equipment) {
  const out = []
  if (equipment.sleds > 0 || equipment.drags > 0) out.push('Sled relay')
  if (equipment.medBalls > 0) out.push('Med-ball throw-down')
  if (equipment.field > 0 || equipment.turf > 0) out.push('Shuttle / tempo race')
  out.push('Team competition')
  out.push('Capacity finisher')
  return out.slice(0, 4)
}

export const codeLetter = (i) => String.fromCharCode(65 + i)
export const typeLabel = (t) => ({ lifting: 'Lifting', conditioning: 'Conditioning', both: 'Both · lift first' }[t] || t)
export function liftCount(total) { return Math.max(1, Math.floor((total - 15) / 15)) }
export function condCount(total) { return Math.max(1, Math.floor((total - 15) / 15)) }
export function bothAlloc(total) {
  const avail = total - 15
  let lift = Math.min(2, Math.floor(avail / 15))
  let cond = Math.floor((avail - lift * 15) / 15)
  if (cond < 1 && lift > 0) { lift = lift - 1; cond = Math.floor((avail - lift * 15) / 15) }
  if (cond < 1) cond = 1
  return { lift, cond }
}

function blockTemplate(i) {
  if (i === 0) return T1
  if (i === 1) return T2
  const s = (i - 2) * 4
  return {
    light: true, label: 'Accessory Volume',
    pools: [LIGHT_POOLS[s % 3], LIGHT_POOLS[(s + 1) % 3], LIGHT_POOLS[(s + 2) % 3], LIGHT_POOLS[(s + 3) % 3]],
  }
}

function lightBlock(i, dayIndex, meso, week, cx) {
  const s = (i - 2) * 4, mod = (x) => ((x % 3) + 3) % 3, rows = []
  const pools = [LIGHT_POOLS[mod(s)], LIGHT_POOLS[mod(s + 1)], LIGHT_POOLS[mod(s + 2)], LIGHT_POOLS[mod(s + 3)]]
  pools.forEach((p, k) => {
    const ex = pickEx(p, dayIndex + meso + i * 4 + k, cx.equipment)
    const st = stageFor(week, ex, 'hold', cx)
    rows.push({ purpose: LIGHT_LABEL[p] || 'Accessory', ex: ex.n, vol: st.vol, prog: st.prog })
  })
  return { kind: 'lift', time: 15, label: 'Block ' + (i + 1) + ' · Accessory Volume', rows }
}

function liftingBlock(i, dayIndex, meso, week, cx) {
  const sys = sysFor(cx.system)
  const roleSys = !!sys.roles
  const role = roleSys ? sys.roles[dayIndex % sys.roles.length] : null

  // role systems: one main block, then accessory volume. classic systems:
  // T1, T2, then light
  const isLight = roleSys ? i > 0 : blockTemplate(i).light
  if (isLight) return lightBlock(i, dayIndex, meso, week, cx)

  const t = roleSys ? T1 : blockTemplate(i)
  let mainPool = t.main
  if (roleSys && sys.mainPoolFor) mainPool = sys.mainPoolFor(role, week) || t.main

  const rot = Math.floor((week - 1) / (sys.rotate || 20)) // how often the main lift rotates
  const mainEx = pickEx(mainPool, dayIndex + rot + i, cx.equipment)
  const mst = stageFor(week, mainEx, 'main', cx, { dayIndex, role, meso })
  const rows = [{ purpose: mst.tag ? 'Main · ' + mst.tag : 'Main', ex: mainEx.n, vol: mst.vol, prog: mst.prog }]
  t.acc.forEach((p, k) => {
    const ex = pickEx(p, dayIndex + meso + i * 3 + k + 1, cx.equipment)
    const st = stageFor(week, ex, 'hold', cx)
    rows.push({ purpose: ACC_LABEL[p] || 'Accessory', ex: ex.n, vol: st.vol, prog: st.prog })
  })
  const label = 'Block ' + (i + 1) + ' · ' + (role || t.label)
  return { kind: 'lift', time: 15, label, rows }
}

function condBlockObj(j, dayIndex, cx) {
  const a = condItem(dayIndex + j, cx), b = condItem(dayIndex + j + 3, cx)
  return {
    kind: 'cond', time: 15, label: 'Conditioning' + (j > 0 ? ' ' + (j + 1) : ''),
    rows: [{ purpose: 'Energy', ex: a.n, vol: 'work' }, { purpose: 'Energy', ex: b.n, vol: 'work' }],
  }
}

export function resolveSession(week, dayIndex, type, cx) {
  const meso = Math.floor((week - 1) / 20)
  const total = cx.sessionLength
  const blocks = []
  blocks.push({
    kind: 'warmup', time: 5, label: 'Warm-Up · Core-4',
    rows: core4For(dayIndex, meso, week, cx.equipment).map((c) => ({ purpose: c.anchor, ex: c.ex, vol: '1–2 rounds' })),
  })
  const co = coordFor(dayIndex, meso, week, cx.equipment)
  blocks.push({ kind: 'coord', time: 5, label: 'Coordination', rows: [{ purpose: 'Tennis Ball', ex: co.n, vol: co.s ? co.s[0] : '2x5' }] })
  let lift = 0, cond = 0
  if (type === 'lifting') lift = liftCount(total)
  else if (type === 'conditioning') cond = condCount(total)
  else { const a = bothAlloc(total); lift = a.lift; cond = a.cond }
  for (let i = 0; i < lift; i++) blocks.push(liftingBlock(i, dayIndex, meso, week, cx))
  for (let j = 0; j < cond; j++) blocks.push(condBlockObj(j, dayIndex, cx))
  const used = 10 + lift * 15 + cond * 15
  const fin = Math.max(5, total - used)
  blocks.push({ kind: 'finisher', time: fin, label: 'Finisher / Competition', ideas: finisherIdeas(cx.equipment) })
  return { week, meso, type, total, code: codeLetter(dayIndex), blocks }
}
