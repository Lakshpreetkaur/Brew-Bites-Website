-- ==============================================================================
-- PHASE 12: BREW & BITE REVIEWS TABLE, SECURITY & RLS MIGRATION
-- ==============================================================================

-- 1. Create dedicated reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  verified_purchase BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_product_review UNIQUE(user_id, product_id)
);

-- 2. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for reviews table
-- Public can read all reviews
DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;
CREATE POLICY "Public can view reviews" 
ON public.reviews FOR SELECT 
USING (true);

-- Authenticated users can insert their own review
DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;
CREATE POLICY "Users can insert own reviews" 
ON public.reviews FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own review; Admins can update any review
DROP POLICY IF EXISTS "Users and admins can update reviews" ON public.reviews;
CREATE POLICY "Users and admins can update reviews" 
ON public.reviews FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin());

-- Users can delete their own review; Admins can delete any review
DROP POLICY IF EXISTS "Users and admins can delete reviews" ON public.reviews;
CREATE POLICY "Users and admins can delete reviews" 
ON public.reviews FOR DELETE 
USING (auth.uid() = user_id OR public.is_admin());
