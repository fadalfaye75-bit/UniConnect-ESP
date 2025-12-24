
# UniConnect ESP - Configuration SQL Complète

Exécutez ce script dans votre SQL Editor Supabase. Ce script est **idempotent** (peut être exécuté plusieurs fois sans erreur).

```sql
-- 1. Table Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name text,
  email text,
  role text DEFAULT 'STUDENT',
  classname text DEFAULT 'Général',
  school_name text DEFAULT 'ESP Dakar',
  is_active boolean DEFAULT true,
  theme_color text DEFAULT '#0ea5e9',
  avatar text
);

-- 2. Table Notifications & Correction RLS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  target_user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  target_role text,
  target_class text,
  is_read boolean DEFAULT false,
  link text,
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Nettoyage et Réinstallation des Politiques Notifications
DROP POLICY IF EXISTS "Users can see relevant notifications" ON public.notifications;
CREATE POLICY "Users can see relevant notifications" ON public.notifications
FOR SELECT USING (
  auth.uid() = target_user_id OR 
  target_user_id IS NULL OR
  target_class = 'Général' OR
  target_class = (SELECT classname FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Allow authenticated to insert notifications" ON public.notifications;
CREATE POLICY "Allow authenticated to insert notifications" ON public.notifications
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can mark own notifications as read" ON public.notifications;
CREATE POLICY "Users can mark own notifications as read" ON public.notifications
FOR UPDATE USING (auth.uid() = target_user_id) WITH CHECK (auth.uid() = target_user_id);

-- 3. Table Plannings (Schedules)
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  version text NOT NULL,
  upload_date timestamptz DEFAULT now(),
  url text NOT NULL,
  classname text NOT NULL,
  category text DEFAULT 'Planning'
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Schedules viewable by class members" ON public.schedules;
CREATE POLICY "Schedules viewable by class members" ON public.schedules
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.classname = public.schedules.classname OR profiles.role = 'ADMIN' OR public.schedules.classname = 'Général')
  )
);

DROP POLICY IF EXISTS "Authorized can upload schedules" ON public.schedules;
CREATE POLICY "Authorized can upload schedules" ON public.schedules
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'ADMIN' OR profiles.role = 'DELEGATE')
  )
);

-- 4. Sondages (Polls) & Logique de Vote
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  question text NOT NULL,
  classname text NOT NULL,
  is_active boolean DEFAULT true,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES public.polls ON DELETE CASCADE,
  label text NOT NULL,
  votes integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES public.polls ON DELETE CASCADE,
  option_id uuid REFERENCES public.poll_options ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Polls visible to all" ON public.polls;
CREATE POLICY "Polls visible to all" ON public.polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins/Delegates can manage polls" ON public.polls;
CREATE POLICY "Admins/Delegates can manage polls" ON public.polls FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'DELEGATE'))
);

DROP POLICY IF EXISTS "Votes visible only to owner" ON public.poll_votes;
CREATE POLICY "Votes visible only to owner" ON public.poll_votes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Votes can be cast by anyone authenticated" ON public.poll_votes;
CREATE POLICY "Votes can be cast by anyone authenticated" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Fonction RPC pour Vote Atomique
CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_poll_id uuid, p_option_id uuid)
RETURNS void AS $$
DECLARE
  v_old_option_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.polls WHERE id = p_poll_id AND is_active = true) THEN
    RAISE EXCEPTION 'Le scrutin est clos.';
  END IF;

  SELECT option_id INTO v_old_option_id FROM public.poll_votes WHERE poll_id = p_poll_id AND user_id = auth.uid();

  IF v_old_option_id IS NOT NULL THEN
    UPDATE public.poll_options SET votes = votes - 1 WHERE id = v_old_option_id;
    UPDATE public.poll_votes SET option_id = p_option_id WHERE poll_id = p_poll_id AND user_id = auth.uid();
  ELSE
    INSERT INTO public.poll_votes (poll_id, option_id, user_id) VALUES (p_poll_id, p_option_id, auth.uid());
  END IF;
  
  UPDATE public.poll_options SET votes = votes + 1 WHERE id = p_option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
