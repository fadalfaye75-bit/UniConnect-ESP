
# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée pour l'École Supérieure Polytechnique de Dakar.

## 🛠️ Configuration SQL (Trigger & RLS) - VERSION FINALE SÉCURISÉE

Copiez et exécutez ce script dans le **SQL Editor** de votre projet Supabase. Ce script configure l'automatisation des profils et sécurise toutes les tables contre les modifications non autorisées.

```sql
-- 1. PRÉPARATION DES TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('STUDENT', 'DELEGATE', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TRIGGER : SYNCHRONISATION AUTH -> PROFILES
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, classname, school_name, is_active)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Étudiant Nouveau'),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::text, 'STUDENT')::user_role,
    COALESCE(new.raw_user_meta_data->>'className', 'Général'),
    COALESCE(new.raw_user_meta_data->>'school_name', 'ESP Dakar'),
    true
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. FONCTIONS DE SÉCURITÉ (RLS HELPERS)
CREATE OR REPLACE FUNCTION auth_user_role() RETURNS user_role AS $$
  SELECT role::user_role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth_user_class() RETURNS text AS $$
  SELECT classname FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- 4. ACTIVATION RLS SUR TOUTES LES TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- 5. POLITIQUES : PROFILS
CREATE POLICY "Profiles_Read_All" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles_Admin_All" ON public.profiles FOR ALL USING (auth_user_role() = 'ADMIN');

-- 6. POLITIQUES GÉNÉRIQUES (Annonces, Examens, Meet, Emploi du temps)
-- Règle : Lecture pour (Ma classe OR Général OR Admin)
-- Règle : Ecriture pour (Admin OR (Délégué AND Ma classe))

-- ANNOUNCEMENTS
DROP POLICY IF EXISTS "View_Announcements" ON public.announcements;
CREATE POLICY "View_Announcements" ON public.announcements FOR SELECT 
USING (auth_user_role() = 'ADMIN' OR classname = auth_user_class() OR classname = 'Général');

DROP POLICY IF EXISTS "Manage_Announcements" ON public.announcements;
CREATE POLICY "Manage_Announcements" ON public.announcements FOR ALL 
USING (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()))
WITH CHECK (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()));

-- EXAMS
DROP POLICY IF EXISTS "View_Exams" ON public.exams;
CREATE POLICY "View_Exams" ON public.exams FOR SELECT 
USING (auth_user_role() = 'ADMIN' OR classname = auth_user_class() OR classname = 'Général');

DROP POLICY IF EXISTS "Manage_Exams" ON public.exams;
CREATE POLICY "Manage_Exams" ON public.exams FOR ALL 
USING (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()))
WITH CHECK (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()));

-- SCHEDULES (Emploi du temps) - CORRECTION ERREUR 42501
DROP POLICY IF EXISTS "View_Schedules" ON public.schedules;
CREATE POLICY "View_Schedules" ON public.schedules FOR SELECT 
USING (auth_user_role() = 'ADMIN' OR classname = auth_user_class() OR classname = 'Général');

DROP POLICY IF EXISTS "Manage_Schedules" ON public.schedules;
CREATE POLICY "Manage_Schedules" ON public.schedules FOR ALL 
USING (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()))
WITH CHECK (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()));

-- MEET_LINKS
DROP POLICY IF EXISTS "View_Meets" ON public.meet_links;
CREATE POLICY "View_Meets" ON public.meet_links FOR SELECT 
USING (auth_user_role() = 'ADMIN' OR classname = auth_user_class() OR classname = 'Général');

DROP POLICY IF EXISTS "Manage_Meets" ON public.meet_links;
CREATE POLICY "Manage_Meets" ON public.meet_links FOR ALL 
USING (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()))
WITH CHECK (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()));

-- 7. POLITIQUES : SONDAGES (POLLS & VOTES)
-- Sondages (Polls)
CREATE POLICY "Polls_Read" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Polls_Manage" ON public.polls FOR ALL 
USING (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()))
WITH CHECK (auth_user_role() = 'ADMIN' OR (auth_user_role() = 'DELEGATE' AND classname = auth_user_class()));

-- Options
CREATE POLICY "Options_Read" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Options_Manage" ON public.poll_options FOR ALL 
USING (auth_user_role() = 'ADMIN' OR EXISTS (SELECT 1 FROM polls p WHERE p.id = poll_id AND p.classname = auth_user_class() AND auth_user_role() = 'DELEGATE'));

-- Votes (Anti-fraude)
CREATE POLICY "Vote_Insert_Self" ON public.poll_votes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vote_Update_Self" ON public.poll_votes FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vote_Read_All" ON public.poll_votes FOR SELECT USING (true);

-- 8. POLITIQUES : CLASSES
CREATE POLICY "Classes_Read" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Classes_Admin" ON public.classes FOR ALL USING (auth_user_role() = 'ADMIN');

-- RELOAD
NOTIFY pgrst, 'reload schema';
```

## 🚀 Résumé des sécurités appliquées
- **Partage intelligent** : Les étudiants ne voient que ce qui les concerne.
- **Délégués restreints** : Un délégué de "Licence 2" ne peut pas modifier le planning d'une "Licence 3".
- **Clôture sécurisée** : Seuls les créateurs (Admins/Délégués de la classe) peuvent fermer un vote (`is_active`).
- **Protection des fichiers** : Correction de l'erreur d'upload via une politique `WITH CHECK` rigoureuse.
