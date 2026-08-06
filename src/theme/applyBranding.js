// The only place --green/--green-dim get touched outside tokens.css's
// own :root defaults — Phase 5.5 Step 2: per-facility branding
// overwrites exactly these two values at runtime, on document.documentElement,
// nothing else. Everything else (dark base, panels, lines, radius,
// typography) stays whatever tokens.css says.
export const DEFAULT_ACCENT = '#13be17'
export const DEFAULT_ACCENT_DIM = '#0f8f12'

export function applyBrandingVars(branding) {
  const root = document.documentElement
  root.style.setProperty('--green', branding?.accentColor || DEFAULT_ACCENT)
  root.style.setProperty('--green-dim', branding?.accentDim || DEFAULT_ACCENT_DIM)
}
