
# UniConnect ESP - Script SQL Supabase (Version Robuste)

Exécutez ce script dans l'éditeur SQL Supabase.

```sql
-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name text NOT NULL,
  email text,
  role text DEFAULT 'STUDENT',
  classname text DEFAULT 'Général',
  school_name text DEFAULT 'ESP Dakar',
  is_active boolean DEFAULT true,
  theme_color text DEFAULT '#0ea5e9',
  avatar text
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profils visibles par tous" ON public.profiles;
CREATE POLICY "Profils visibles par tous" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Modification du propre profil" ON public.profiles;
CREATE POLICY "Modification du propre profil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  email text,
  color text DEFAULT '#0ea5e9',
  student_count integer DEFAULT 0
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture classes publique" ON public.classes;
CREATE POLICY "Lecture classes publique" ON public.classes FOR SELECT USING (true);

-- 3. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  author text,
  priority text DEFAULT 'normal',
  classname text DEFAULT 'Général',
  date timestamptz DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture announcements publique" ON public.announcements;
CREATE POLICY "Lecture announcements publique" ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion announcements admin/delegate" ON public.announcements;
CREATE POLICY "Gestion announcements admin/delegate" ON public.announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'DELEGATE'))
);

-- 4. EXAMS
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  subject text NOT NULL,
  date timestamptz NOT NULL,
  duration text,
  room text,
  notes text,
  classname text NOT NULL
);
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture exams publique" ON public.exams;
CREATE POLICY "Lecture exams publique" ON public.exams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion exams admin/delegate" ON public.exams;
CREATE POLICY "Gestion exams admin/delegate" ON public.exams FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'DELEGATE'))
);

-- 5. SCHEDULES & SLOTS
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  version text NOT NULL,
  url text NOT NULL,
  classname text NOT NULL,
  category text DEFAULT 'Planning',
  upload_date timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  classname text NOT NULL,
  day integer NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  subject text NOT NULL,
  teacher text,
  room text,
  color text DEFAULT '#0ea5e9',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture schedules publique" ON public.schedules;
CREATE POLICY "Lecture schedules publique" ON public.schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lecture slots publique" ON public.schedule_slots;
CREATE POLICY "Lecture slots publique" ON public.schedule_slots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion slots admin/delegate" ON public.schedule_slots;
CREATE POLICY "Gestion slots admin/delegate" ON public.schedule_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'DELEGATE'))
);

-- 6. POLLS & VOTES
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  question text NOT NULL,
  classname text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  end_time timestamptz
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
DROP POLICY IF EXISTS "Lecture polls publique" ON public.polls;
CREATE POLICY "Lecture polls publique" ON public.polls FOR SELECT USING (true);
DROP POLICY IF EXISTS "Lecture options publique" ON public.poll_options;
CREATE POLICY "Lecture options publique" ON public.poll_options FOR SELECT USING (true);
DROP POLICY IF EXISTS "Vote autorisé" ON public.poll_votes;
CREATE POLICY "Vote autorisé" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. MEET LINKS
CREATE TABLE IF NOT EXISTS public.meet_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  platform text NOT NULL,
  url text NOT NULL,
  time text,
  classname text NOT NULL
);
ALTER TABLE public.meet_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture links publique" ON public.meet_links;
CREATE POLICY "Lecture links publique" ON public.meet_links FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion links admin/delegate" ON public.meet_links;
CREATE POLICY "Gestion links admin/delegate" ON public.meet_links FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'DELEGATE'))
);

-- 8. FAVORITES
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  content_id uuid NOT NULL,
  content_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gestion propres favoris" ON public.favorites;
CREATE POLICY "Gestion propres favoris" ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- 9. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  target_user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  timestamp timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture propres notifications" ON public.notifications;
CREATE POLICY "Lecture propres notifications" ON public.notifications FOR SELECT USING (auth.uid() = target_user_id);

-- 10. RPC VOTE
CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_poll_id uuid, p_option_id uuid)
RETURNS void AS $$
DECLARE
  v_old_option_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.polls WHERE id = p_poll_id AND is_active = true) THEN
    RAISE EXCEPTION 'Ce sondage est clos.';
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
