
# 🎓 UniConnect ESP - Ultimate Edition

Plateforme de gestion universitaire centralisée pour l'ESP Dakar.

## 🛠️ Script SQL de Migration (Important)

Exécutez ce code dans le **SQL Editor** de Supabase pour configurer la base de données.

```sql
-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES PRINCIPALES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT DEFAULT 'STUDENT',
    classname TEXT DEFAULT 'Général',
    school_name TEXT DEFAULT 'ESP Dakar',
    avatar TEXT,
    theme_color TEXT DEFAULT '#0ea5e9',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    classname TEXT DEFAULT 'Général',
    author TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    links JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS public.polls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    is_active BOOLEAN DEFAULT true,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls ON DELETE CASCADE,
    label TEXT NOT NULL,
    votes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles ON DELETE CASCADE,
    UNIQUE(poll_id, user_id)
);

-- 3. POLITIQUES DE SÉCURITÉ (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls are viewable by class or admin" ON public.polls FOR SELECT 
USING (classname = 'Général' OR classname = (SELECT classname FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN');

CREATE POLICY "Manage polls (Admin/Delegate)" ON public.polls FOR ALL
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('ADMIN', 'DELEGATE'));

-- 4. LOGIQUE DE VOTE (Trigger pour incrémenter les voix)
CREATE OR REPLACE FUNCTION public.handle_poll_vote()
RETURNS trigger AS $$
BEGIN
  UPDATE public.poll_options SET votes = votes + 1 WHERE id = NEW.option_id;
  -- Si c'est un changement de vote, on décrémente l'ancien (géré par l'application via suppression/insertion si nécessaire)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGER DE CRÉATION DE PROFIL AUTOMATIQUE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, classname, is_active, theme_color)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Étudiant'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'STUDENT'),
    COALESCE(new.raw_user_meta_data->>'className', 'Général'),
    true,
    '#0ea5e9'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```
