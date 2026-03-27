-- ============================================================================
-- TubeFlow v2 — FULL RESET + REBUILD
-- Run this in Supabase SQL Editor. It drops old tables and rebuilds everything.
-- ============================================================================

-- Drop old tables if they exist
DROP TABLE IF EXISTS public.days CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop old trigger/function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at();

-- ─── Profiles ──────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  display_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Channels ──────────────────────────────────────────────────────────────

CREATE TABLE public.channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  credentials text DEFAULT '',
  proxies text DEFAULT '',
  adsense text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_select" ON public.channels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "channels_insert" ON public.channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "channels_update" ON public.channels FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "channels_delete" ON public.channels FOR DELETE USING (auth.role() = 'authenticated');

-- ─── Days ──────────────────────────────────────────────────────────────────

CREATE TABLE public.days (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 30),
  title text DEFAULT '',
  master_prompt text DEFAULT '',
  script_text text DEFAULT '',
  status text DEFAULT '',
  video_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, day_number)
);

ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "days_select" ON public.days FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "days_insert" ON public.days FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "days_update" ON public.days FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "days_delete" ON public.days FOR DELETE USING (auth.role() = 'authenticated');

-- ─── Auto-update timestamps ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER channels_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER days_updated_at BEFORE UPDATE ON public.days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.days;

-- ─── Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX idx_channels_user_id ON public.channels(user_id);
CREATE INDEX idx_days_channel_id ON public.days(channel_id);
CREATE INDEX idx_days_channel_day ON public.days(channel_id, day_number);
