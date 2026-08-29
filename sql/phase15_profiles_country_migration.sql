-- ==============================================================================
-- PHASE 15: PROFILES COUNTRY COLUMN MIGRATION
-- ==============================================================================

-- 1. Add optional country column to public.profiles table (Nullable, no impact on existing rows)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS country TEXT;
