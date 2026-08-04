// Ported as-is from reference/52weekprogram.html (lines 341-619) — the
// programming systems library. Each system re-drives the 52-week output:
// how the main lift loads week to week, how phases are named/segmented,
// and how often exercises rotate. `sts` (The Anchor Method) is the
// default. Role-based systems (Conjugate, Texas, Tier) reassign what
// each training day IS via `roles`/`mainPoolFor`.

export const THIRDS = (l) => [[1, 20, l + ' 1'], [21, 40, l + ' 2'], [41, 52, l + ' 3']]
export const ph4 = (w) => Math.floor(((w - 1) % 20) / 4) // 0..4 phase inside a 20-wk block
export const meso3 = (w) => Math.min(Math.floor((w - 1) / 20), 2) // 0,1,2 macro block

export const SYSFAM = [
  ['Volume & consistency', ['sts']],
  ['Linear', ['linear', 'reverse']],
  ['Undulating', ['dup', 'wup']],
  ['Concentrated / block', ['block', 'triphasic', 'conjugate']],
  ['Percentage & wave', ['fivethreeone', 'texas', 'tier']],
  ['Effort & feedback', ['apre', 'vbt', 'hit', 'gvt']],
  ['Power & mixed', ['contrast', 'concurrent']],
]

export const SYS = {
  /* -------- Garrett's own model (DEFAULT) -------- */
  sts: {
    name: 'The Anchor Method', tag: 'ANCH', blurb: 'Your model — anchor the movement, pile the volume',
    intro: 'Same main lift holds the full 20-week block — sets climb every 4 weeks, then reps up to 5. Exercises rotate only at a new block.',
    rotate: 20, seg: () => [[1, 20, 'Block 1'], [21, 40, 'Block 2'], [41, 52, 'Block 3']],
    phase: (w) => ['Set Build I', 'Set Build II', 'Set Build III', 'Rep Build I', 'Rep Build II'][ph4(w)],
    main: (w, p) => {
      const ph = ph4(w)
      let sets, reps
      if (ph <= 2) { sets = p.S0 + ph; reps = 3 } else { sets = p.S0 + 2; reps = Math.min(3 + (ph - 2), 5) }
      return { vol: `${sets}x${reps}${p.rest}`, prog: true }
    },
    layout: {
      principle: 'Volume is the top variable. Pick the right movements and stay on them long enough to actually adapt.',
      loading: 'Sets climb every 4 weeks, then reps up to 5. Same main lift the whole 20-week block.',
      rotation: 'Main lifts rotate only at a new block (wk 21, 41). Accessories rotate freely.',
      bestFor: 'Developing athletes who need mastery and steady overload — not novelty.',
      mistake: 'Swapping the main lift every few weeks and never accumulating enough volume to grow.',
    },
  },

  /* -------- Linear family -------- */
  linear: {
    name: 'Linear (Classic Western)', tag: 'LIN', blurb: 'High volume down to high intensity',
    intro: 'Reps fall and load rises across each 20-week macrocycle — one long climb to a single peak.',
    rotate: 20, seg: () => THIRDS('Macrocycle'),
    phase: (w) => ['Hypertrophy', 'Strength-Endurance', 'Basic Strength', 'Max Strength', 'Peak'][ph4(w)],
    main: (w) => {
      const t = [['4x10', '65%'], ['4x8', '70%'], ['5x5', '78%'], ['4x3', '85%'], ['3x2', '92%']][ph4(w)]
      return { vol: `${t[0]} · ${t[1]}`, prog: true }
    },
    layout: {
      principle: 'One long climb: high volume / low intensity down to low volume / high intensity.',
      loading: 'Reps fall and load rises each 4-week phase — 4x10 → 4x8 → 5x5 → 4x3 → 3x2.',
      rotation: 'Same main lifts all cycle; only the rep/load bracket changes.',
      bestFor: 'Off-season base into a single peak. Simple to run and coach.',
      mistake: 'Peaking too early and grinding heavy singles for weeks with no fresh base under them.',
    },
  },
  reverse: {
    name: 'Reverse Linear', tag: 'REV', blurb: 'Start heavy, finish high-volume',
    intro: 'The classic model run backward — start heavy, walk toward high-volume work capacity.',
    rotate: 20, seg: () => THIRDS('Macrocycle'),
    phase: (w) => ['Max Strength', 'Strength', 'Strength-Hypertrophy', 'Hypertrophy', 'Work Capacity'][ph4(w)],
    main: (w) => {
      const t = [['3x3', '88%'], ['4x5', '82%'], ['4x6', '76%'], ['4x8', '70%'], ['4x12', '60%']][ph4(w)]
      return { vol: `${t[0]} · ${t[1]}`, prog: true }
    },
    layout: {
      principle: 'Run the classic model in reverse — open strong, end on volume.',
      loading: 'Load falls and reps rise each phase — 3x3 → 4x5 → 4x6 → 4x8 → 4x12.',
      rotation: 'Same main lifts; the bracket walks from strength toward hypertrophy / work capacity.',
      bestFor: 'Coming off a peak, building size or a conditioning base, or an endurance end-goal.',
      mistake: 'Using it when the athlete actually needs to get stronger — this cycle ends light.',
    },
  },

  /* -------- Undulating family -------- */
  dup: {
    name: 'Daily Undulating (DUP)', tag: 'DUP', blurb: 'Every session a different quality',
    intro: 'Every session trains a different quality — size, strength, speed — on the same main lift.',
    rotate: 20, seg: () => THIRDS('Mesocycle'), phase: () => 'Daily undulation',
    main: (w, p, o) => {
      const f = [['Hypertrophy', '4x8', '70%'], ['Strength', '5x4', '83%'], ['Power', '6x3', '60% fast']][(o.dayIndex || 0) % 3]
      return { vol: `${f[1]} · ${f[2]}`, prog: true, tag: f[0] }
    },
    layout: {
      principle: 'Undulate the stimulus daily so you train size, strength, and speed every week.',
      loading: 'Each session has a job — hypertrophy (4x8), strength (5x4), power (6x3 fast).',
      rotation: 'Same main lift; the rep/load target rotates by day, not by month.',
      bestFor: 'Intermediates who plateau on one quality and can train 3+ days a week.',
      mistake: 'Grinding the power day heavy — speed day stays fast and submaximal.',
    },
  },
  wup: {
    name: 'Weekly Undulating (WUP)', tag: 'WUP', blurb: 'Focus rotates week to week',
    intro: 'The training focus rotates week to week on a 3-week loop.',
    rotate: 20, seg: () => THIRDS('Mesocycle'),
    phase: (w) => ['Hypertrophy week', 'Strength week', 'Power week'][(w - 1) % 3],
    main: (w) => {
      const t = [['Hypertrophy', '4x8', '72%'], ['Strength', '5x4', '84%'], ['Power', '6x3', '62% fast']][(w - 1) % 3]
      return { vol: `${t[1]} · ${t[2]}`, prog: true, tag: t[0] }
    },
    layout: {
      principle: 'Same idea as DUP, but the quality rotates week to week instead of day to day.',
      loading: 'Wk A hypertrophy (4x8) → Wk B strength (5x4) → Wk C power (6x3), repeat.',
      rotation: 'Same main lift; the weekly focus cycles on a 3-week loop.',
      bestFor: 'Athletes who only hit each pattern 1–2x/week but still want variety.',
      mistake: 'Forgetting to add load across loops — the loop is the shape; overload is the driver.',
    },
  },

  /* -------- Concentrated / block family -------- */
  block: {
    name: 'Block Periodization (Issurin)', tag: 'BLK', blurb: 'Accumulate · transmute · realize',
    intro: 'One quality at a time — accumulate, transmute, realize — then repeat, more specific each cycle.',
    rotate: 12, seg: () => [[1, 12, 'Cycle 1'], [13, 24, 'Cycle 2'], [25, 36, 'Cycle 3'], [37, 48, 'Cycle 4'], [49, 52, 'Cycle 5']],
    phase: (w) => { const c = (w - 1) % 12; return c < 5 ? 'Accumulation' : c < 9 ? 'Transmutation' : 'Realization' },
    main: (w) => {
      const c = (w - 1) % 12
      if (c < 5) return { vol: '4x8 · 70%', prog: true, tag: 'Accumulation' }
      if (c < 9) return { vol: '5x4 · 83%', prog: true, tag: 'Transmutation' }
      return { vol: '3x2 · 90%', prog: true, tag: 'Realization' }
    },
    layout: {
      principle: 'Concentrate one quality at a time so it actually moves, then transmute it to the sport.',
      loading: 'Accumulation (4x8 volume) → Transmutation (5x4 heavier) → Realization (3x2 peak).',
      rotation: 'Exercises get more specific each cycle — general work early, competition-like late.',
      bestFor: 'Advanced athletes peaking for a date, or a clean off-season → in-season timeline.',
      mistake: 'Blocks too long — residuals fade and you lose the quality you built two blocks back.',
    },
  },
  triphasic: {
    name: 'Triphasic (Cal Dietz)', tag: 'TRI', blurb: 'Eccentric · isometric · concentric',
    intro: 'Same lift, changing action — slow eccentric, then isometric hold, then explosive concentric.',
    rotate: 6, seg: () => THIRDS('Triphasic Cycle'),
    phase: (w) => ['Eccentric', 'Isometric', 'Concentric'][Math.floor(((w - 1) % 6) / 2)] + ' phase',
    main: (w) => {
      const c = Math.floor(((w - 1) % 6) / 2)
      const t = [['Eccentric', '5x3 · 80% · 6s ecc'], ['Isometric', '5x3 · 80% · 3s iso'], ['Concentric', '5x3 · 80% · explode']][c]
      return { vol: t[1], prog: true, tag: t[0] }
    },
    layout: {
      principle: 'Every movement has three actions — train them one at a time to build the stretch-shortening cycle.',
      loading: 'Eccentric (6-sec lower) → Isometric (3-sec hold) → Concentric (explode), ~2 wks each at 80%+.',
      rotation: 'Same main lift; the tempo / muscle action is what changes across the cycle.',
      bestFor: 'Explosive, injury-resistant athletes who need force absorption — not just push.',
      mistake: "Rushing the eccentric/iso work — the slow tempo IS the training, not a warm-up rep.",
    },
  },
  conjugate: {
    name: 'Conjugate (Westside)', tag: 'CONJ', blurb: 'Max-effort + dynamic-effort, year-round',
    intro: 'Max-effort and dynamic-effort days run side by side, year-round, with rotating lifts.',
    rotate: 3, roles: ['ME · Lower', 'ME · Upper', 'DE · Lower', 'DE · Upper'],
    mainPoolFor: (r) => (r.includes('Lower') ? 'mainStrength' : 'main2Strength'),
    seg: () => THIRDS('Rotation Block'),
    phase: (w) => `DE wave · ${[50, 55, 60][(w - 1) % 3]}%`,
    main: (w, p, o) => {
      const pct = [50, 55, 60][(w - 1) % 3]
      if ((o.role || '').startsWith('ME')) return { vol: 'Work up to 1–3RM', prog: true, tag: 'Max Effort' }
      const lower = (o.role || '').includes('Lower')
      return { vol: lower ? `10x2 · ${pct}%` : `9x3 · ${pct}%`, prog: true, tag: 'Dynamic Effort' }
    },
    layout: {
      principle: 'Develop max strength, speed-strength, and mass at the same time, year-round.',
      loading: 'ME days work to a 1–3RM; DE days move 50–60% fast on a 3-week wave; accessories chase weak points.',
      rotation: 'Max-effort lift rotates every ~3 weeks to dodge accommodation; speed lift holds the wave.',
      bestFor: 'Advanced lifters who stall on straight percentages and need constant variation.',
      mistake: 'Maxing the same lift weekly — the rotation is what keeps ME days from wrecking you.',
    },
  },

  /* -------- Percentage & wave family -------- */
  fivethreeone: {
    name: '5/3/1 (Wendler)', tag: '531', blurb: 'TM waves with an AMRAP top set',
    intro: 'Percentage waves off a Training Max — 5s, 3s, 5/3/1, deload — with an AMRAP top set. TM, not true 1RM.',
    rotate: 52, seg: () => [[1, 20, 'Cycles 1–5'], [21, 40, 'Cycles 6–10'], [41, 52, 'Cycles 11–13']],
    phase: (w) => ['5s week', '3s week', '5/3/1 week', 'Deload'][(w - 1) % 4],
    main: (w) => {
      const t = [['65/75/85%', '×5/5/5+', true], ['70/80/90%', '×3/3/3+', true], ['75/85/95%', '×5/3/1+', true], ['40/50/60%', '×5/5/5', false]][(w - 1) % 4]
      return { vol: `${t[0]} ${t[1]}`, prog: t[2], tag: ['5s', '3s', '5/3/1', 'Deload'][(w - 1) % 4] }
    },
    layout: {
      principle: 'Slow, sustainable percentage waves off a Training Max — not your true max.',
      loading: '4-wk wave — 5s (65/75/85), 3s (70/80/90), 5/3/1 (75/85/95), deload — top set is AMRAP.',
      rotation: 'The four main lifts never rotate; assistance does. +5 lb upper / +10 lb lower to the TM each cycle.',
      bestFor: 'Intermediates past newbie gains who want years of progress, not months.',
      mistake: 'Using your real 1RM as the TM and skipping deloads — both stall it fast.',
    },
  },
  texas: {
    name: 'Texas Method', tag: 'TX', blurb: 'Volume · recovery · weekly PR',
    intro: 'Volume, recovery, and a weekly PR — three roles, one climbing top set.',
    rotate: 20, roles: ['Volume', 'Light', 'Intensity'], mainPoolFor: () => 'mainStrength',
    seg: () => THIRDS('Progression Block'), phase: () => 'Weekly PR cycle',
    main: (w, p, o) => {
      const r = o.role || 'Volume'
      if (r === 'Volume') return { vol: '5x5 · 80%', prog: true, tag: 'Volume Day' }
      if (r === 'Light') return { vol: '2x5 · 65%', prog: false, tag: 'Recovery Day' }
      return { vol: '1x5 · new PR', prog: true, tag: 'Intensity Day' }
    },
    layout: {
      principle: 'One big volume stimulus, one recovery, one PR — every week.',
      loading: 'Volume day 5x5, light day 2x5, intensity day 1x5 for a weekly rep PR.',
      rotation: 'Same lifts; you push a new top-set PR each intensity day.',
      bestFor: 'Late-novice / early-intermediate lifters training 3x a week.',
      mistake: 'Turning the light day heavy — it exists so the intensity day can PR.',
    },
  },
  tier: {
    name: 'Tier System (Joe Kenn)', tag: 'TIER', blurb: 'Total-body, rotating emphasis',
    intro: 'Total-body every session with a rotating Total / Lower / Upper emphasis and T1–T3 tiers.',
    rotate: 20, roles: ['Total', 'Lower', 'Upper'],
    mainPoolFor: (r, w) => (r === 'Lower' ? 'mainStrength' : r === 'Upper' ? 'main2Strength' : w % 2 ? 'mainStrength' : 'main2Strength'),
    seg: () => THIRDS('Tier Block'), phase: () => 'Total · Lower · Upper',
    main: (w, p, o) => {
      const r = o.role || 'Total'
      const t = { Total: ['4x4 · 82%', 'T1 Total'], Lower: ['5x3 · 85%', 'T1 Lower'], Upper: ['4x5 · 80%', 'T1 Upper'] }[r]
      return { vol: t[0], prog: true, tag: t[1] }
    },
    layout: {
      principle: 'Train movements, not body parts. Every session is total-body with a rotating emphasis.',
      loading: 'T1 primary (heavy, low reps) → T2 secondary (moderate) → T3 accessory (high reps).',
      rotation: 'Daily emphasis rotates Total → Lower → Upper so every quality gets hit each week.',
      bestFor: 'Team-sport athletes on limited days who need the whole body trained each session.',
      mistake: "Treating T3 like junk — it's where you build armor and cover weak links.",
    },
  },

  /* -------- Effort & feedback family -------- */
  apre: {
    name: 'Autoregulated / RPE (APRE)', tag: 'RPE', blurb: 'Load set by performance',
    intro: 'Load autoregulates off performance — build to a target RPE, then adjust off bar speed and reps left.',
    rotate: 20, seg: () => THIRDS('Mesocycle'),
    phase: (w) => `Target RPE ${[7, 7.5, 8, 8.5, 9][ph4(w)]}`,
    main: (w) => ({ vol: `4x5 → top set @ RPE ${[7, 7.5, 8, 8.5, 9][ph4(w)]}`, prog: true, tag: 'Autoregulated' }),
    layout: {
      principle: "Let the athlete's performance set the load. Autoregulate off reps and effort.",
      loading: 'Build to a top set at a target RPE; adjust the next set off bar speed and reps in reserve.',
      rotation: 'Same main lift; the RPE ceiling climbs across phases (7 → 9).',
      bestFor: 'Athletes with day-to-day readiness swings — in-season, high schoolers, big rosters.',
      mistake: 'Chasing RPE 10 every day — leave 1–2 reps in the tank or fatigue buries the signal.',
    },
  },
  vbt: {
    name: 'Velocity-Based (VBT)', tag: 'VBT', blurb: 'Bar speed sets the load',
    intro: 'Bar speed sets the load — train a velocity zone and cap the set on velocity loss. Built for your Vitruve setup.',
    rotate: 20, seg: () => THIRDS('Velocity Block'),
    phase: (w) => ['Strength', 'Strength', 'Speed-Strength', 'Speed-Strength', 'Speed'][ph4(w)] + ' zone',
    main: (w) => {
      const z = [['0.55–0.70 m/s', '15% VL'], ['0.60–0.75 m/s', '15% VL'], ['0.70–0.85 m/s', '20% VL'], ['0.80–1.0 m/s', '20% VL'], ['1.0+ m/s', '10% VL']][ph4(w)]
      return { vol: `6x3 · ${z[0]} · stop @ ${z[1]}`, prog: true, tag: 'Velocity' }
    },
    layout: {
      principle: 'Bar speed sets the load. Train the velocity zone that matches the goal.',
      loading: 'Strength zones (0.55–0.75 m/s) early, speed-strength (0.8–1.0+) later; stop the set on a velocity drop.',
      rotation: 'Same main lift; the velocity target and velocity-loss cutoff shift by phase.',
      bestFor: 'Programs with a VBT setup that want autoregulated, fatigue-capped loading.',
      mistake: 'Ignoring the velocity-loss stop and grinding slow reps — the opposite of the point.',
    },
  },
  hit: {
    name: 'HIT (High Intensity)', tag: 'HIT', blurb: 'One hard set, brief and infrequent',
    intro: 'Brief and hard — one all-out set per movement, add load when you beat the top rep.',
    rotate: 20, seg: () => THIRDS('Block'), phase: () => 'To failure',
    main: () => ({ vol: '1–2x6–10 to failure · 4010 tempo', prog: true, tag: 'To failure' }),
    layout: {
      principle: 'Brief, hard, infrequent. One all-out set drives the adaptation.',
      loading: '1–2 sets to true failure, controlled tempo; add load once you beat the top rep.',
      rotation: 'Same lifts; progress by load or reps, never by piling on sets.',
      bestFor: 'Time-crunched athletes or in-season maintenance on minimal volume.',
      mistake: "Adding 'a few more sets' — the model rests on the one set being genuinely maximal.",
    },
  },
  gvt: {
    name: 'German Volume (10x10)', tag: 'GVT', blurb: 'Ten sets of ten for size',
    intro: 'Ten sets of ten at a fixed load — overwhelming volume drives the growth.',
    rotate: 20, seg: () => [[1, 20, 'GVT 10x10'], [21, 40, 'GVT 10x8'], [41, 52, 'GVT 10x6']],
    phase: (w) => ['10x10 @60%', '10x8 @65%', '10x6 @70%'][meso3(w)],
    main: (w) => {
      const t = [['10x10', '60%'], ['10x8', '65%'], ['10x6', '70%']][meso3(w)]
      return { vol: `${t[0]} · ${t[1]}`, prog: true, tag: 'German Volume' }
    },
    layout: {
      principle: 'Ten sets of ten. Overwhelming volume at a fixed load drives hypertrophy.',
      loading: '10x10 at ~60%, same weight all sets; add load once you hit all 100 reps. Advance to 10x8, 10x6.',
      rotation: 'Same main lift per block; secondary work stays light and simple.',
      bestFor: 'A dedicated mass phase — off-season size before a strength/power block.',
      mistake: "Starting too heavy — if you can't finish 100 reps, the load was wrong.",
    },
  },

  /* -------- Power & mixed family -------- */
  contrast: {
    name: 'French Contrast (PAP)', tag: 'FC', blurb: 'Heavy + explosive clusters',
    intro: 'Heavy and explosive paired back-to-back to potentiate power.',
    rotate: 20, seg: () => THIRDS('Contrast Block'), phase: () => 'Contrast complex',
    main: () => ({ vol: 'Heavy 3x3 @85% → jump ×5 → ballistic ×5 → assisted jump ×5', prog: true, tag: 'Complex' }),
    layout: {
      principle: 'Pair heavy and explosive back-to-back to potentiate power (PAP).',
      loading: 'Cluster: heavy 3x3 @85% → plyo → ballistic → assisted jump, full rest between clusters.',
      rotation: 'Same primary lift; the complex stays fixed so you can track output.',
      bestFor: 'Peaking power in trained athletes who already own a strength base.',
      mistake: 'Running it on beginners — no strength base means nothing to potentiate.',
    },
  },
  concurrent: {
    name: 'Concurrent / Hybrid', tag: 'CONC', blurb: 'Hold everything at once — in-season',
    intro: 'Strength, power, and conditioning held together at moderate doses — built for in-season.',
    rotate: 20, seg: () => THIRDS('Concurrent Block'), phase: () => 'Concurrent',
    main: () => ({ vol: '4x5 · 75% + power + energy', prog: true, tag: 'Concurrent' }),
    layout: {
      principle: 'Train strength, power, and conditioning together at moderate doses — hold every quality.',
      loading: 'Moderate strength (4x5 @75%) + a power expression + an energy-system finisher each session.',
      rotation: 'Same main lifts; nothing peaks, everything maintains.',
      bestFor: "In-season, GPP, or general athletes who can't afford to lose any quality.",
      mistake: 'Pushing every quality hard at once — moderate is the point, or you recover from none.',
    },
  },
}

export function sysFor(systemId) {
  return SYS[systemId] || SYS.sts
}
