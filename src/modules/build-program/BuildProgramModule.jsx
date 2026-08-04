import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as api from './buildProgramApi'
import { DEFAULT_CONSTRAINTS, mondayISO } from './constants'
import { ConstraintsPage } from './ConstraintsPage'
import { ProgramOutputPage } from './ProgramOutputPage'

function nextFreeName(names) {
  let n = 1
  while (names.includes('Program ' + n)) n++
  return 'Program ' + n
}

// Only for the very first mount, before any program has been loaded —
// this is the one place hardcoded defaults belong.
function freshDraft(names) {
  return { id: null, name: nextFreeName(names), ...DEFAULT_CONSTRAINTS, startDate: mondayISO() }
}

export function BuildProgramModule() {
  const { membership } = useAuth()
  const facilityId = membership.facilityId

  const [page, setPage] = useState('constraints') // 'constraints' | 'output'
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(() => freshDraft([]))

  const refreshPrograms = useCallback(async () => {
    const list = await api.fetchPrograms(facilityId)
    setPrograms(list)
    return list
  }, [facilityId])

  useEffect(() => {
    let active = true
    refreshPrograms()
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [refreshPrograms])

  function patchDraft(patch) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  async function handleLoadProgram(id, targetPage) {
    setError('')
    try {
      const row = await api.fetchProgram(id)
      setDraft({
        id: row.id,
        name: row.name,
        system: row.system,
        startDate: row.start_date || mondayISO(),
        ...row.constraints,
      })
      if (targetPage) setPage(targetPage)
    } catch (err) {
      setError(err.message)
    }
  }

  // Matches the reference's newProgram(): keeps every current constraint
  // value, only resets id (so Save & build creates a new row instead of
  // updating the one just built) and the name. Duplicate-and-rename, not
  // a blank restart.
  function handleNewProgram() {
    setDraft((d) => ({ ...d, id: null, name: nextFreeName(programs.map((p) => p.name)) }))
    setPage('constraints')
  }

  async function handleSaveAndBuild() {
    setSaving(true)
    setError('')
    try {
      const name = (draft.name || '').trim() || 'Program ' + (programs.length + 1)
      const constraints = {
        sessionLength: draft.sessionLength,
        equipment: draft.equipment,
        days: draft.days,
        skill: draft.skill,
        sport: draft.sport,
      }
      const payload = { name, system: draft.system, constraints, startDate: draft.startDate }
      const row = draft.id ? await api.updateProgram(draft.id, payload) : await api.createProgram(facilityId, payload)
      setDraft((d) => ({ ...d, id: row.id, name: row.name }))
      await refreshPrograms()
      setPage('output')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="sub">Loading programs…</p>

  return (
    <div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {page === 'output' && (
        <button className="btn ghost" type="button" onClick={() => setPage('constraints')} style={{ marginBottom: 18 }}>
          Edit constraints
        </button>
      )}
      {page === 'constraints' ? (
        <ConstraintsPage
          draft={draft}
          onPatch={patchDraft}
          programs={programs}
          onLoadProgram={(id) => handleLoadProgram(id, 'constraints')}
          onSaveAndBuild={handleSaveAndBuild}
          saving={saving}
        />
      ) : (
        <ProgramOutputPage
          draft={draft}
          onPatch={patchDraft}
          programs={programs}
          onLoadProgram={(id) => handleLoadProgram(id, 'output')}
          onNewProgram={handleNewProgram}
          onSaveStartDate={async (startDate) => {
            patchDraft({ startDate })
            if (draft.id) {
              await api.updateProgram(draft.id, {
                name: draft.name, system: draft.system,
                constraints: { sessionLength: draft.sessionLength, equipment: draft.equipment, days: draft.days, skill: draft.skill, sport: draft.sport },
                startDate,
              })
            }
          }}
        />
      )}
    </div>
  )
}
