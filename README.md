
# 🎓 UniConnect ESP - Base de Données Finale (Déploiement)

Copiez et exécutez ce script complet dans l'éditeur SQL de votre projet Supabase. Ce script configure les tables, les index, les fonctions et la sécurité.

```sql
-- ==========================================
-- 1. NETTOYAGE (Optionnel, permet de réinitialiser proprement)
-- ==========================================
-- DROP TABLE IF EXISTS public.profiles, public.announcements, public.exams, public.schedules, public.meet_links, public.polls, public.poll_options, public.poll_votes, public.notifications, public.app_settings, public.activity_logs, public.classes, public.favorites, public.interactions CASCADE;

-- ==========================================
-- 2. EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 3. TABLES
-- ==========================================

-- Profils utilisateurs
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'STUDENT',
    classname TEXT,
    avatar TEXT,
    school_name TEXT DEFAULT 'ESP Dakar',
    is_active BOOLEAN DEFAULT true,
    theme_color TEXT DEFAULT '#0ea5e9',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Classes
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    email TEXT,
    student_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Annonces
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    classname TEXT DEFAULT 'Général',
    author TEXT NOT NULL,
    links JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    share_count INTEGER DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now()
);

-- Examens
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    duration TEXT,
    room TEXT,
    notes TEXT,
    classname TEXT DEFAULT 'Général',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents / Emplois du temps
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    version TEXT NOT NULL,
    url TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    category TEXT DEFAULT 'Planning',
    upload_date TIMESTAMPTZ DEFAULT now()
);

-- Liens Meet / Directs
CREATE TABLE IF NOT EXISTS public.meet_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    time TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Sondages
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    votes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    link TEXT,
    timestamp TIMESTAMPTZ DEFAULT now(),
    is_read BOOLEAN DEFAULT false,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_role TEXT,
    target_class TEXT
);

-- Favoris
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL, -- 'announcement', 'schedule', etc.
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, content_id)
);

-- Interactions
CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'share', 'view'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Journal d'audit
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Réglages App / IA
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 4. AUTOMATISATION DES PROFILS (TRIGGER)
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, classname, school_name)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'Nouvel Étudiant'), 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'STUDENT'),
    COALESCE(new.raw_user_meta_data->>'className', 'Général'),
    COALESCE(new.raw_user_meta_data->>'school_name', 'ESP Dakar')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 5. FONCTIONS RPC
-- ==========================================

CREATE OR REPLACE FUNCTION public.increment_option_vote(opt_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.poll_options SET votes = votes + 1 WHERE id = opt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_share_count(target_table TEXT, target_id UUID)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE public.%I SET share_count = share_count + 1 WHERE id = $1', target_table)
    USING target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. POLITIQUES RLS (SÉCURISÉES)
-- ==========================================

-- Activer RLS sur toutes les tables
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Supprimer les politiques existantes pour éviter les erreurs 42710
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Créer les nouvelles politiques
CREATE POLICY "Public profiles are visible by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Everyone can read announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Everyone can read exams" ON public.exams FOR SELECT USING (true);
CREATE POLICY "Everyone can read schedules" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Everyone can read meet links" ON public.meet_links FOR SELECT USING (true);
CREATE POLICY "Everyone can read polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Everyone can read options" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Everyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Everyone can read classes" ON public.classes FOR SELECT USING (true);

-- Administration & Délégués
CREATE POLICY "Admins and Delegates can manage content" ON public.announcements 
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'DELEGATE'))
);

CREATE POLICY "Admins and Delegates can manage exams" ON public.exams 
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'DELEGATE'))
);

-- Votes & Favoris
CREATE POLICY "Users can manage own votes" ON public.poll_votes FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own favorites" ON public.favorites FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own interactions" ON public.interactions FOR ALL USING (user_id = auth.uid());

-- Notifications restreintes
CREATE POLICY "Users read own notifications" ON public.notifications 
FOR SELECT USING (
    target_user_id = auth.uid() OR 
    target_class = (SELECT classname FROM public.profiles WHERE id = auth.uid()) OR
    target_class = 'Général'
);

-- ==========================================
-- 7. DONNÉES INITIALES
-- ==========================================
INSERT INTO public.app_settings (key, value) 
VALUES ('ai_assistant', '{"isActive": true, "tone": "friendly", "verbosity": "medium", "customInstructions": "Tu es l''assistant officiel UniConnect pour les étudiants de l''ESP Dakar."}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.classes (name, student_count) VALUES 
('Général', 0),
('Licence 1 - INFO', 45),
('Licence 2 - INFO', 42),
('Licence 3 - INFO', 38),
('DST 1 - INFO', 50),
('DST 2 - INFO', 48)
ON CONFLICT (name) DO NOTHING;
```
