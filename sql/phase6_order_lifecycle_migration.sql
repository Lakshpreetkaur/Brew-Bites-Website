-- ==============================================================================
-- PHASE 6: BREW & BITE ORDER LIFECYCLE & CANCELLATION RLS POLICIES
-- ==============================================================================

-- 1. Orders Update Policy
-- Allows customers to cancel their own orders before kitchen preparation begins
-- and allows authorized administrators to transition any order through its lifecycle.
DROP POLICY IF EXISTS "Orders update policy" ON public.orders;
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;

CREATE POLICY "Orders update policy" ON public.orders 
FOR UPDATE 
USING (
  public.is_admin() OR (auth.uid() = user_id AND status IN ('placed', 'pending', 'confirmed'))
)
WITH CHECK (
  public.is_admin() OR (auth.uid() = user_id AND status = 'cancelled')
);
