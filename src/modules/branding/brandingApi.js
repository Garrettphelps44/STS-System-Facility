import { supabase } from '../../lib/supabase'
import { DEFAULT_ACCENT, DEFAULT_ACCENT_DIM } from '../../theme/applyBranding'

export async function fetchBranding(facilityId) {
  const { data, error } = await supabase
    .from('facility_branding')
    .select('display_name, logo_url, accent_color, accent_dim')
    .eq('facility_id', facilityId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    displayName: data.display_name,
    logoUrl: data.logo_url,
    accentColor: data.accent_color,
    accentDim: data.accent_dim,
  }
}

// Owner-only at the database level (facility_branding_write RLS policy
// checks facility_role() = 'owner' directly, not can_write_facility,
// which would also let a coach through) — this call fails for anyone
// else regardless of what the UI shows.
export async function updateBranding(facilityId, { displayName, accentColor, accentDim }) {
  const { error } = await supabase
    .from('facility_branding')
    .update({ display_name: displayName, accent_color: accentColor, accent_dim: accentDim })
    .eq('facility_id', facilityId)
  if (error) throw error
}

// Path convention <facility_id>/<filename> is what the storage RLS
// policies check against (see 0008_facility_branding.sql) — every
// upload lands in the caller's own facility's folder or gets rejected.
export async function uploadLogo(facilityId, file) {
  const ext = file.name.split('.').pop()
  const path = `${facilityId}/logo-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('facility-logos')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('facility-logos').getPublicUrl(path)
  const { error: updateError } = await supabase
    .from('facility_branding')
    .update({ logo_url: data.publicUrl })
    .eq('facility_id', facilityId)
  if (updateError) throw updateError
  return data.publicUrl
}

// Resets colors + logo, not display_name — there's no company-wide
// default for a facility's own name to fall back to (unlike color/logo,
// which do have a real STS default), so a name edit is a separate,
// deliberate choice this button doesn't silently undo.
export async function resetBranding(facilityId) {
  const { error } = await supabase
    .from('facility_branding')
    .update({ logo_url: null, accent_color: DEFAULT_ACCENT, accent_dim: DEFAULT_ACCENT_DIM })
    .eq('facility_id', facilityId)
  if (error) throw error
}
