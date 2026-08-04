import { useState } from 'react'

// Renders one panel from referenceContent.js. The checklist's checked
// boxes are local-only state, reset each time it's reopened — it's a
// planning scratchpad, not saved data, matching the old app's behavior.
export function ReferenceModal({ panel, onClose }) {
  const [checked, setChecked] = useState({})

  if (!panel) return null

  function toggleBox(key) {
    setChecked((c) => ({ ...c, [key]: !c[key] }))
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={panel.title}>
      <button type="button" onClick={onClose}>
        Close
      </button>
      <h3>{panel.title}</h3>
      <p>{panel.purpose}</p>

      {panel.blocks?.map((b, i) => {
        if (b.h) return <h4 key={i}>{b.h}</h4>
        if (b.pat) return (
          <div key={i}>
            <b>{b.pat}</b>
            <div>{b.rungs}</div>
          </div>
        )
        if (b.cue) return (
          <div key={i}>
            <b>{b.cue}</b>
            <div>{b.cues.join(' · ')}</div>
          </div>
        )
        if (b.row) return <p key={i}>{b.row}</p>
        if (b.rungs) return <p key={i}>{b.rungs}</p>
        return null
      })}

      {panel.checklistMoves && (
        <table>
          <thead>
            <tr>
              <th>Movement</th>
              {panel.checklistColumns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {panel.checklistMoves.map((mv) => (
              <tr key={mv}>
                <td>{mv}</td>
                {panel.checklistColumns.map((c) => {
                  const boxKey = mv + '|' + c
                  return (
                    <td key={c}>
                      <span role="checkbox" aria-checked={!!checked[boxKey]} onClick={() => toggleBox(boxKey)}>
                        {checked[boxKey] ? '☑' : '☐'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {panel.defs && <p>{panel.defs}</p>}
      {panel.note && <p>{panel.note}</p>}
    </div>
  )
}
