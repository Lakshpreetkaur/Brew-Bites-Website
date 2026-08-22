-- ==============================================================================
-- PHASE 10: BREW & BITE ADDRESS BOOK TABLE, SECURITY & RLS MIGRATION
-- ==============================================================================

-- 1. Create dedicated addresses table
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON public.addresses(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_addresses_created_at ON public.addresses(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for addresses table
-- Select Policy: Customers can view only their own addresses; Admins can view all.
DROP POLICY IF EXISTS "Users and admins can view addresses" ON public.addresses;
CREATE POLICY "Users and admins can view addresses" 
ON public.addresses FOR SELECT 
USING (auth.uid() = user_id OR public.is_admin());

-- Insert Policy: Authenticated users can insert their own addresses.
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
CREATE POLICY "Users can insert own addresses" 
ON public.addresses FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Update Policy: Users can update their own addresses.
DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
CREATE POLICY "Users can update own addresses" 
ON public.addresses FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin());

-- Delete Policy: Users can delete their own addresses.
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;
CREATE POLICY "Users can delete own addresses" 
ON public.addresses FOR DELETE 
USING (auth.uid() = user_id OR public.is_admin());
