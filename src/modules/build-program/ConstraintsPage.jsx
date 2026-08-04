import { useState } from 'react'
import { SYS, SYSFAM } from './engine/systems'
import { EQCATS, PRESETS, EQUIPMENT, equipmentFromCats, catsFromEquipment } from './engine/pool'
import { activeLanes, suggestedMax, suggestedGroups } from './engine/groups'
import { liftCount } from './engine/session'
import { DAYS, SKILLS, LENGTHS, SPORTS } from './constants'
import { REFERENCE_PANELS } from './referenceContent'
import { ReferenceModal } from './ReferenceModal'

// Steps 00-06 per the constraints flow, plus Groups and the 4 static
// reference panels kept out of the way (collapsed, click to reveal) —
// neither is one of the primary numbered steps.
export function ConstraintsPage({ draft, onPatch, programs, onLoadProgram, onSaveAndBuild, saving }) {
  const [openFam, setOpenFam] = useState(() => {
    const fam = SYSFAM.find(([, ids]) => ids.includes(draft.system))
    return fam ? fam[0] : null
  })
  const [showExact, setShowExact] = useState(false)
  const [showGroups, setShowGroups] = useState(false)
  const [showReference, setShowReference] = useState(false)
  const [openRefKey, setOpenRefKey] = useState(null)
  const [maxAthletesManual, setMaxAthletesManual] = useState(false)
  const [maxAthletesInput, setMaxAthletesInput] = useState('')

  const sys = SYS[draft.system] || SYS.sts
  const activeDays = DAYS.filter((d) => draft.days[d])
  const cats = catsFromEquipment(draft.equipment)
  const autoMax = suggestedMax(draft.equipment)
  const maxAthletes = maxAthletesManual ? +maxAthletesInput || 0 : autoMax
  const lanes = activeLanes(draft.equipment)
  const groups = suggestedGroups(draft.equipment, maxAthletes)

  function toggleCat(catId) {
    const next = cats.includes(catId) ? cats.filter((c) => c !== catId) : [...cats, catId]
    onPatch({ equipment: equipmentFromCats(next) })
  }

  function cycleDay(day) {
    const order = [undefined, 'lifting', 'both', 'conditioning']
    const next = order[(order.indexOf(draft.days[day]) + 1) % order.length]
    const days = { ...draft.days }
    if (next) days[day] = next
    else delete days[day]
    onPatch({ days })
  }

  return (
    <div>
      <section className="panel">
        <p className="eyebrow">Step 00</p>
        <h2>Programming system</h2>
        <p className="sub">Pick the method — it re-drives all 52 weeks</p>
        {SYSFAM.map(([fam, ids]) => {
          const open = openFam === fam
          const selected = ids.includes(draft.system)
          return (
            <div key={fam} style={{ marginBottom: 8 }}>
              <button className="btn ghost" type="button" aria-expanded={open} onClick={() => setOpenFam(open ? null : fam)}>
                {fam} {selected && <b>{SYS[draft.system].tag}</b>} {open ? '–' : '+'}
              </button>
              {open && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {ids.map((id) => (
                    <button className="btn" key={id} type="button" aria-pressed={draft.system === id} onClick={() => onPatch({ system: id })}>
                      {SYS[id].name}
                      <br />
                      <small>{SYS[id].blurb}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <p className="sub">
          <b>{sys.name}.</b> {sys.intro}
        </p>
      </section>

      <section className="panel">
        <p className="eyebrow">Step 01</p>
        <h2>Time of session</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {LENGTHS.map((m) => (
            <button className="btn" key={m} type="button" aria-pressed={draft.sessionLength === m} onClick={() => onPatch({ sessionLength: m })}>
              {m} min
              <br />
              <small>{m <= 30 ? '1 block' : liftCount(m) + ' blocks'}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Step 02</p>
        <h2>Equipment</h2>
        <p className="sub">Tap what you actually have</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {PRESETS.map((p, i) => (
            <button className="btn ghost" key={i} type="button" onClick={() => onPatch({ equipment: equipmentFromCats(p.cats) })}>
              {p.l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EQCATS.map((c) => (
            <button className="btn" key={c.id} type="button" aria-pressed={cats.includes(c.id)} onClick={() => toggleCat(c.id)}>
              {c.l}
              <br />
              <small>{c.s}</small>
            </button>
          ))}
        </div>
        {!cats.length && (
          <p className="sub">Nothing selected — the engine will fall back to bodyweight only. It never programs gear you don't have.</p>
        )}
        <button className="btn ghost" type="button" onClick={() => setShowExact((s) => !s)} style={{ marginTop: 12 }}>
          {showExact ? 'Hide exact equipment counts' : 'Exact equipment counts (optional)'}
        </button>
        {showExact && (
          <div style={{ marginTop: 12 }}>
            <p className="sub">For facilities that want to be exact — set real counts per item. Also feeds Groups below.</p>
            {EQUIPMENT.map(([key, label]) => (
              <label className="field" key={key}>
                <span className="lab">{label}</span>
                <input
                  type="number"
                  min="0"
                  value={draft.equipment[key] || 0}
                  onChange={(e) => onPatch({ equipment: { ...draft.equipment, [key]: +e.target.value || 0 } })}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <button className="btn ghost" type="button" onClick={() => setShowGroups((s) => !s)}>
          {showGroups ? 'Hide groups' : 'Groups (optional)'}
        </button>
        {showGroups && (
          <div style={{ marginTop: 12 }}>
            <p className="sub">How athletes split into lanes based on your equipment — uses the exact counts above.</p>
            <label className="field">
              <span className="lab">Max athletes training at once</span>
              <input
                type="number"
                min="0"
                placeholder={`auto: ${autoMax}`}
                value={maxAthletesManual ? maxAthletesInput : ''}
                onChange={(e) => {
                  setMaxAthletesManual(e.target.value !== '')
                  setMaxAthletesInput(e.target.value)
                }}
              />
            </label>
            <p className="sub">
              {maxAthletes} athletes across {lanes} lane{lanes === 1 ? '' : 's'}
            </p>
            {groups.map((g) => (
              <p className="sub" key={g.tag}>
                {g.tag}: {g.count} athletes
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Step 03</p>
        <h2>Days</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DAYS.map((day) => {
            const st = draft.days[day]
            const ml = { lifting: 'Lift', both: 'Both', conditioning: 'Cond' }[st] || 'Off'
            return (
              <button className="btn" key={day} type="button" aria-pressed={!!st} data-on={st ? 1 : 0} onClick={() => cycleDay(day)}>
                {day}
                <br />
                <small>{ml}</small>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Step 04</p>
        <h2>Skill level</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SKILLS.map(([v, l, s]) => (
            <button className="btn" key={v} type="button" aria-pressed={draft.skill === v} onClick={() => onPatch({ skill: v })}>
              {l}
              <br />
              <small>{s}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Step 05</p>
        <h2>Sport</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SPORTS.map((s) => (
            <button className="btn" key={s} type="button" aria-pressed={draft.sport === s} onClick={() => onPatch({ sport: s })}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Step 06</p>
        <h2>Program name</h2>
        <label className="field">
          <input value={draft.name} onChange={(e) => onPatch({ name: e.target.value })} placeholder="e.g. Varsity FB Off-Season" />
        </label>
        {programs.length > 0 && (
          <div>
            <p className="sub">Saved programs — tap to load & edit</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {programs.map((p) => (
                <button className="btn" key={p.id} type="button" aria-pressed={draft.id === p.id} onClick={() => onLoadProgram(p.id)}>
                  {p.name}
                  <br />
                  <small>{SYS[p.system] ? SYS[p.system].tag : p.system}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <button className="btn ghost" type="button" onClick={() => setShowReference((s) => !s)}>
          {showReference ? 'Hide reference' : 'Reference (optional)'}
        </button>
        {showReference && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {REFERENCE_PANELS.map((p) => (
              <button className="btn ghost" key={p.key} type="button" onClick={() => setOpenRefKey(p.key)}>
                {p.title}
              </button>
            ))}
          </div>
        )}
        {openRefKey && (
          <ReferenceModal panel={REFERENCE_PANELS.find((p) => p.key === openRefKey)} onClose={() => setOpenRefKey(null)} />
        )}
      </section>

      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span className="sub">
          {sys.tag} · {draft.sessionLength} min · {activeDays.length || 'no'} day{activeDays.length === 1 ? '' : 's'} ·{' '}
          {cats.length} equipment group{cats.length === 1 ? '' : 's'} · {draft.sport}
        </span>
        <button className="btn primary" type="button" disabled={!activeDays.length || saving} onClick={onSaveAndBuild}>
          Save &amp; build
        </button>
      </div>
    </div>
  )
}
