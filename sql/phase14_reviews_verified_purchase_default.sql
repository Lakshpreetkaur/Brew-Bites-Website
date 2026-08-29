-- ==============================================================================
-- PHASE 14: REVIEWS VERIFIED PURCHASE DEFAULT COLUMN UPDATE
-- ==============================================================================

-- 1. Alter verified_purchase column default to false for all newly submitted reviews.
-- Note: Does NOT modify any existing review rows in public.reviews.
ALTER TABLE public.reviews 
ALTER COLUMN verified_purchase SET DEFAULT false;
