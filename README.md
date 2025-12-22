# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée pour l'ESP de Dakar.

## 🛠️ Configuration du Nouveau Projet Supabase

Suivez ces étapes dans l'ordre pour configurer votre base de données :

### 1. Création du compte Admin (Auth)
1. Allez dans **Authentication** > **Users**.
2. Cliquez sur **Add User** > **Create new user**.
3. Email : `faye@esp.sn`
4. Password : `passer25`
5. Copiez l'**User ID** (UUID) généré.

### 2. Exécution du SQL Global (Structure et Sécurité)
Copiez et exécutez ce script dans le **SQL Editor**. Il configure les tables, les fonctions de sécurité et applique les règles RLS sans récursion.

```sql
-- =============================================================================
-- 1. TABLES DE BASE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('STUDENT', 'DELEGATE', 'ADMIN')) DEFAULT 'STUDENT',
    classname TEXT DEFAULT 'Général',
    avatar TEXT,
    school_name TEXT DEFAULT 'ESP Dakar',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    email TEXT,
    student_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    priority TEXT CHECK (priority IN ('normal', 'important', 'urgent')) DEFAULT 'normal',
    date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration TEXT NOT NULL,
    room TEXT NOT NULL,
    notes TEXT,
    classname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL,
    url TEXT NOT NULL,
    classname TEXT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meet_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    time TEXT NOT NULL,
    classname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    is_active BOOLEAN DEFAULT true,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('info', 'success', 'warning', 'alert')) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_role TEXT,
    target_class TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tone TEXT DEFAULT 'friendly',
    verbosity TEXT DEFAULT 'medium',
    custom_instructions TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- 2. FONCTIONS DE SÉCURITÉ (POUR ÉVITER LA RÉCURSION INFINIE)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_class()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT classname FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. ACTIVATION RLS (Row Level Security)
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. POLITIQUES DE SÉCURITÉ (RLS)
-- =============================================================================

CREATE POLICY "Profiles_Read_All" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles_Update_Own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles_Admin_All" ON public.profiles FOR ALL TO authenticated USING (public.get_my_role() = 'ADMIN');

CREATE POLICY "Classes_Read_All" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Classes_Admin_All" ON public.classes FOR ALL TO authenticated USING (public.get_my_role() = 'ADMIN');

CREATE POLICY "Announcements_Read" ON public.announcements FOR SELECT TO authenticated 
USING (classname = 'Général' OR classname = public.get_my_class() OR public.get_my_role() = 'ADMIN');

CREATE POLICY "Announcements_Admin" ON public.announcements FOR ALL TO authenticated 
USING (public.get_my_role() = 'ADMIN');

CREATE POLICY "Announcements_Delegate" ON public.announcements FOR INSERT TO authenticated 
WITH CHECK (public.get_my_role() = 'DELEGATE' AND classname = public.get_my_class());

CREATE POLICY "Exams_Read" ON public.exams FOR SELECT TO authenticated 
USING (classname = 'Général' OR classname = public.get_my_class() OR public.get_my_role() = 'ADMIN');

CREATE POLICY "Exams_Write" ON public.exams FOR ALL TO authenticated 
USING (public.get_my_role() IN ('ADMIN', 'DELEGATE'));

CREATE POLICY "Schedules_Read" ON public.schedules FOR SELECT TO authenticated 
USING (classname = 'Général' OR classname = public.get_my_class() OR public.get_my_role() = 'ADMIN');

CREATE POLICY "Schedules_Write" ON public.schedules FOR ALL TO authenticated 
USING (public.get_my_role() IN ('ADMIN', 'DELEGATE'));

CREATE POLICY "Meet_Read" ON public.meet_links FOR SELECT TO authenticated 
USING (classname = 'Général' OR classname = public.get_my_class() OR public.get_my_role() = 'ADMIN');

CREATE POLICY "Meet_Write" ON public.meet_links FOR ALL TO authenticated 
USING (public.get_my_role() IN ('ADMIN', 'DELEGATE'));

CREATE POLICY "Polls_Read" ON public.polls FOR SELECT TO authenticated 
USING (classname = 'Général' OR classname = public.get_my_class() OR public.get_my_role() = 'ADMIN');

CREATE POLICY "Polls_Write" ON public.polls FOR ALL TO authenticated 
USING (public.get_my_role() IN ('ADMIN', 'DELEGATE'));

CREATE POLICY "Options_Read" ON public.poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Votes_Own" ON public.poll_votes FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Notifications_Read" ON public.notifications FOR SELECT TO authenticated 
USING (target_user_id = auth.uid() OR target_role = public.get_my_role() OR target_class = public.get_my_class());

CREATE POLICY "Notifications_Update_Read" ON public.notifications FOR UPDATE TO authenticated 
USING (target_user_id = auth.uid());

CREATE POLICY "Notifications_Admin" ON public.notifications FOR ALL TO authenticated 
USING (public.get_my_role() = 'ADMIN');

CREATE POLICY "AI_Read" ON public.ai_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "AI_Admin" ON public.ai_settings FOR ALL TO authenticated 
USING (public.get_my_role() = 'ADMIN');

CREATE POLICY "Logs_Read_Admin" ON public.activity_logs FOR SELECT TO authenticated 
USING (public.get_my_role() = 'ADMIN');

-- =============================================================================
-- 5. INSERTION FINALE : PROFIL ADMIN
-- Remplacez 'VOTRE_UUID' par l'ID copié à l'étape 1
-- =============================================================================
INSERT INTO public.profiles (id, name, email, role, classname, school_name, avatar)
VALUES (
  'VOTRE_UUID', 
  'Serigne Fallou Faye', 
  'faye@esp.sn', 
  'ADMIN', 
  'Direction', 
  'ESP Dakar', 
  'https://api.dicebear.com/7.x/avataaars/svg?seed=faye'
);
```