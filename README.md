
-=============================================================================
-- - UNICONNECT ESP - BACKEND INFRASTRUCTURE (V2.1 - SANS IA)
-- =============================================================================

-- 1. NETTOYAGE COMPLET
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.cast_poll_vote(UUID, UUID);
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.schedules CASCADE;
DROP TABLE IF EXISTS public.meet_links CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.poll_votes CASCADE;
DROP TABLE IF EXISTS public.poll_options CASCADE;
DROP TABLE IF EXISTS public.polls CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. TABLES FONDAMENTALES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('STUDENT', 'DELEGATE', 'ADMIN')) DEFAULT 'STUDENT',
    classname TEXT DEFAULT 'Général',
    avatar TEXT,
    school_name TEXT DEFAULT 'ESP Dakar',
    theme_color TEXT DEFAULT '#0ea5e9',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    email TEXT,
    student_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. MODULES ACADÉMIQUES
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    priority TEXT DEFAULT 'normal',
    links JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration TEXT NOT NULL,
    room TEXT NOT NULL,
    notes TEXT,
    classname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    version TEXT NOT NULL,
    url TEXT NOT NULL,
    classname TEXT NOT NULL,
    category TEXT DEFAULT 'Planning',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. SYSTÈME DE VOTE AVANCÉ
CREATE TABLE public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    votes INTEGER DEFAULT 0
);

CREATE TABLE public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
    UNIQUE(poll_id, user_id)
);

-- 5. FONCTION CRITIQUE : CHANGEMENT DE VOTE DYNAMIQUE
CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_poll_id UUID, p_option_id UUID)
RETURNS void AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_old_option_id UUID;
BEGIN
    -- Vérifier si l'utilisateur a déjà voté pour ce sondage
    SELECT option_id INTO v_old_option_id 
    FROM public.poll_votes 
    WHERE poll_id = p_poll_id AND user_id = v_user_id;

    IF v_old_option_id IS NOT NULL THEN
        -- Si l'utilisateur clique sur la même option, on ignore
        IF v_old_option_id = p_option_id THEN
            RETURN;
        END IF;

        -- 1. DÉCRÉMENTATION de l'ancienne option (Changement de vote)
        UPDATE public.poll_options 
        SET votes = GREATEST(0, votes - 1) 
        WHERE id = v_old_option_id;

        -- 2. Mise à jour du record de vote
        UPDATE public.poll_votes 
        SET option_id = p_option_id 
        WHERE poll_id = p_poll_id AND user_id = v_user_id;
    ELSE
        -- 3. INCRÉMENTATION (Premier vote)
        INSERT INTO public.poll_votes (poll_id, user_id, option_id) 
        VALUES (p_poll_id, v_user_id, p_option_id);
    END IF;

    -- 4. Mise à jour de la nouvelle option
    UPDATE public.poll_options 
    SET votes = votes + 1 
    WHERE id = p_option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. AUTRES FONCTIONS & SÉCURITÉ
CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, content_id)
);

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    target_user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vote self access" ON public.poll_votes FOR ALL USING (auth.uid() = user_id);

-- TRIGGER NEW USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, classname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email, 'STUDENT', 'Général');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
