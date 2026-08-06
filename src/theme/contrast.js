// Color math for Phase 5.5's branding feature: WCAG contrast guard
// (Step 5) and deriving the "dim" shade from a single owner-picked
// accent (Step 3 only exposes one color picker; accent_dim is computed,
// not a second field, using roughly the same hue/lightness relationship
// as STS's own #13be17 -> #0f8f12).

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function rgbToHex({ r, g, b }) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h / 6, s, l }
}

function hslToRgb({ h, s, l }) {
  if (s === 0) { const v = l * 255; return { r: v, g: v, b: v } }
  const hue2rgb = (p, q, t) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  }
}

// Same ~10-point lightness drop as STS's own accent -> accent-dim pair.
export function deriveDim(hex) {
  const hsl = rgbToHsl(hexToRgb(hex))
  return rgbToHex(hslToRgb({ ...hsl, l: Math.max(0, hsl.l - 0.1) }))
}

function channelLuminance(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(rgb) {
  return 0.2126 * channelLuminance(rgb.r) + 0.7152 * channelLuminance(rgb.g) + 0.0722 * channelLuminance(rgb.b)
}

export function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexToRgb(hexA))
  const lB = relativeLuminance(hexToRgb(hexB))
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

export const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

// Checked against --bg, the darkest surface an accent-colored label
// (.eyebrow, the brandbar name-span, focus outlines) ever sits on —
// the worst case, not the average case.
const APP_BG = '#050605'
const REJECT_BELOW = 2
const WARN_BELOW = 3.5

export function checkAccentContrast(hex) {
  if (!HEX_PATTERN.test(hex)) {
    return { ok: false, level: 'reject', ratio: 0, message: 'Not a valid hex color.' }
  }
  const ratio = contrastRatio(hex, APP_BG)
  if (ratio < REJECT_BELOW) {
    return {
      ok: false,
      level: 'reject',
      ratio,
      message: `Too close to the app's background (${ratio.toFixed(1)}:1) — this would be unreadable. Pick something brighter.`,
    }
  }
  if (ratio < WARN_BELOW) {
    return {
      ok: true,
      level: 'warn',
      ratio,
      message: `Low contrast against the dark background (${ratio.toFixed(1)}:1) — readable, but borderline.`,
    }
  }
  return { ok: true, level: 'pass', ratio, message: '' }
}
