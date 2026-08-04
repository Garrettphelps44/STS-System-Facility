-- =====================================================================
-- STS Facility — Tracker module additions
-- Migration 4. Requires 0001_schema.sql.
--
-- Two gaps surfaced by actually building the Tracker module against the
-- Phase 2 schema, neither of which changes any RLS policy (both are
-- plain columns on already-covered tables):
--
-- 1. athletes had no height. The old app's Roster form collects it
--    (feet + inches, not a single unit) specifically because Floor Log's
--    workload formula needs it later — it's roster data, not a Floor Log
--    concern, so it belongs here even though Floor Log itself isn't
--    built yet.
-- 2. metrics had no way to soft-hide a metric while keeping its
--    historical test_entries. The old app's "stop tracking this test"
--    explicitly preserves existing values ("existing values stay saved
--    but hidden") — without an `active` flag, the only way to stop
--    showing a metric would be deleting the row, which cascades and
--    destroys every athlete's recorded history for it. `active` avoids
--    that data loss.
-- =====================================================================

alter table public.athletes
  add column if not exists height_feet   int,
  add column if not exists height_inches int;

alter table public.metrics
  add column if not exists active boolean not null default true;
