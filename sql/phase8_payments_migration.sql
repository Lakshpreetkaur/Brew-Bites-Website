-- ==============================================================================
-- PHASE 8: BREW & BITE PAYMENTS TABLE, SECURITY & RLS MIGRATION
-- ==============================================================================

-- 1. Create dedicated payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash_on_delivery', 'online')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  transaction_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast relational queries
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for payments table
-- Select Policy: Customers can only view payments for their own orders; Admins can view all payments.
DROP POLICY IF EXISTS "Users and admins can view payments" ON public.payments;
CREATE POLICY "Users and admins can view payments" 
ON public.payments FOR SELECT 
USING (auth.uid() = user_id OR public.is_admin());

-- Insert Policy: Authenticated users can insert payment records for their own orders.
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
CREATE POLICY "Users can insert own payments" 
ON public.payments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Update Policy: Only store administrators can modify payment records (e.g. marking COD as paid).
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
CREATE POLICY "Admins can update payments" 
ON public.payments FOR UPDATE 
USING (public.is_admin());
