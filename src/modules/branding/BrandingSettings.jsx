import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as api from './brandingApi'
import { checkAccentContrast, deriveDim, HEX_PATTERN } from '../../theme/contrast'
import { applyBrandingVars, DEFAULT_ACCENT } from '../../theme/applyBranding'

// Owner-only screen — AppShell only renders this for the owner role, but
// that's a UX convenience, not the boundary: facility_branding_write's
// RLS policy checks facility_role(facility_id) = 'owner' directly, so a
// coach or athlete session gets a DB error here even if they somehow
// reached this component.
export function BrandingSettings() {
  const { membership, branding, refreshBranding } = useAuth()
  const facilityId = membership.facilityId

  const [displayName, setDisplayName] = useState(branding?.displayName ?? '')
  const [accentColor, setAccentColor] = useState(branding?.accentColor ?? DEFAULT_ACCENT)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const fileInputRef = useRef(null)

  // Re-sync the form whenever the persisted branding changes underneath
  // it (switching facilities, or a save completing elsewhere).
  useEffect(() => {
    setDisplayName(branding?.displayName ?? '')
    setAccentColor(branding?.accentColor ?? DEFAULT_ACCENT)
  }, [branding])

  // Live preview: every keystroke repaints the actual running app (the
  // real --green/--green-dim on document.documentElement), not a mocked
  // swatch — what you see here is exactly what saving will lock in.
  // Reverts to the last-saved color on unmount if they navigate away
  // without saving, so an abandoned experiment doesn't leave the whole
  // app stuck in an unsaved color.
  useEffect(() => {
    if (HEX_PATTERN.test(accentColor)) {
      applyBrandingVars({ accentColor, accentDim: deriveDim(accentColor) })
    }
    return () => { applyBrandingVars(branding) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentColor])

  const contrast = HEX_PATTERN.test(accentColor) ? checkAccentContrast(accentColor) : null

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSavedMsg('')
    if (!HEX_PATTERN.test(accentColor)) {
      setError('Enter a valid hex color, e.g. #13be17.')
      return
    }
    if (contrast && !contrast.ok) {
      setError(contrast.message)
      return
    }
    setSaving(true)
    try {
      await api.updateBranding(facilityId, {
        displayName: displayName.trim() || branding?.displayName || 'My Facility',
        accentColor,
        accentDim: deriveDim(accentColor),
      })
      await refreshBranding()
      setSavedMsg('Saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSavedMsg('')
    setUploading(true)
    try {
      await api.uploadLogo(facilityId, file)
      await refreshBranding()
      setSavedMsg('Logo updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleReset() {
    setError('')
    setSavedMsg('')
    setSaving(true)
    try {
      await api.resetBranding(facilityId)
      await refreshBranding()
      setSavedMsg('Reset to default colors and logo.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel">
      <p className="eyebrow">Settings</p>
      <h2>Branding</h2>
      <p className="sub">
        Display name, logo, and accent color — applies everywhere in the app and on report share
        links. Everything else (layout, dark background, features) is the same for every facility.
      </p>

      <form onSubmit={handleSave}>
        <label className="field">
          <span className="lab">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your facility's name"
          />
        </label>

        <label className="field">
          <span className="lab">Accent color</span>
          <p className="sub" style={{ marginTop: -4, marginBottom: 10 }}>Shown live across the app as you pick.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="color"
              value={HEX_PATTERN.test(accentColor) && accentColor.length === 7 ? accentColor : DEFAULT_ACCENT}
              onChange={(e) => setAccentColor(e.target.value)}
              style={{ width: 52, height: 44, padding: 4, flex: '0 0 auto' }}
              aria-label="Accent color picker"
            />
            <input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value.trim())}
              placeholder="#13be17"
              style={{ maxWidth: 140 }}
            />
          </div>
        </label>

        {contrast && contrast.message && (
          <p className={contrast.level === 'reject' ? 'error-text' : 'sub'} role={contrast.level === 'reject' ? 'alert' : undefined}>
            {contrast.message}
          </p>
        )}

        <label className="field">
          <span className="lab">Logo</span>
          {branding?.logoUrl && (
            <img
              src={branding.logoUrl}
              alt="Current logo"
              style={{ display: 'block', width: 56, height: 56, objectFit: 'contain', marginBottom: 10 }}
            />
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} disabled={uploading} />
          {uploading && <p className="sub" style={{ marginTop: 8, marginBottom: 0 }}>Uploading…</p>}
        </label>

        {error && <p className="error-text" role="alert">{error}</p>}
        {savedMsg && <p className="sub" style={{ color: 'var(--green)' }}>{savedMsg}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn primary" type="submit" disabled={saving || (contrast && !contrast.ok)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn ghost" type="button" onClick={handleReset} disabled={saving}>
            Reset to default
          </button>
        </div>
      </form>
    </div>
  )
}
