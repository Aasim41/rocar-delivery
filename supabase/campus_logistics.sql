-- ============================================
-- ROCAR CAMPUS LOGISTICS - SUPABASE SETUP
-- ============================================
-- Run these queries in your Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
-- ============================================

-- 1. Create saved_locations table
-- Stores frequently used locations for each user
CREATE TABLE IF NOT EXISTS public.saved_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create deliveries table
-- Core table for all send/fetch deliveries
CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    dropoff_lat DOUBLE PRECISION NOT NULL,
    dropoff_lng DOUBLE PRECISION NOT NULL,
    package_details TEXT,
    delivery_type TEXT NOT NULL DEFAULT 'send',  -- 'send' or 'fetch'
    status TEXT NOT NULL DEFAULT 'pending',
    -- Valid statuses: pending, heading_to_sender, awaiting_load, 
    --                 in_transit, awaiting_retrieval, standby, 
    --                 returning_to_base, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Enable Realtime on deliveries
-- This lets the React app get instant updates via Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for saved_locations
-- Users can only see and manage their own saved locations
CREATE POLICY "Users can view their own locations"
  ON public.saved_locations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own locations"
  ON public.saved_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own locations"
  ON public.saved_locations FOR DELETE
  USING (auth.uid() = user_id);

-- 6. RLS Policies for deliveries
-- Anyone logged in can view deliveries they are part of
CREATE POLICY "Users can view their deliveries"
  ON public.deliveries FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create deliveries where they are the sender
CREATE POLICY "Users can create deliveries"
  ON public.deliveries FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Senders and receivers can update deliveries they are part of
CREATE POLICY "Users can update their deliveries"
  ON public.deliveries FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 7. Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_deliveries_sender ON public.deliveries(sender_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_receiver ON public.deliveries(receiver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON public.saved_locations(user_id);
