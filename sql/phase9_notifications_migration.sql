-- ==============================================================================
-- PHASE 9: BREW & BITE NOTIFICATIONS TABLE, SECURITY & RLS MIGRATION
-- ==============================================================================

-- 1. Create dedicated notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for notifications table
-- Select Policy: Customers can view only their own notifications; Admins can view all.
DROP POLICY IF EXISTS "Users and admins can view notifications" ON public.notifications;
CREATE POLICY "Users and admins can view notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id OR public.is_admin());

-- Insert Policy: Authenticated users and admins can create notifications.
DROP POLICY IF EXISTS "Users and admins can insert notifications" ON public.notifications;
CREATE POLICY "Users and admins can insert notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Update Policy: Users can update read state on their own notifications; Admins can update all.
DROP POLICY IF EXISTS "Users and admins can update notifications" ON public.notifications;
CREATE POLICY "Users and admins can update notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin());

-- Delete Policy: Users can delete their own notifications; Admins can delete all.
DROP POLICY IF EXISTS "Users and admins can delete notifications" ON public.notifications;
CREATE POLICY "Users and admins can delete notifications" 
ON public.notifications FOR DELETE 
USING (auth.uid() = user_id OR public.is_admin());
