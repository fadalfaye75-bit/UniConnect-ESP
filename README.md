
# 🎓 UniConnect ESP - Système de Gestion

## 🚀 Script SQL pour Initialisation des Politiques RLS

Exécutez ce script dans votre SQL Editor Supabase pour corriger les erreurs de permissions ("violates row-level security policy") et les erreurs de schéma ("Could not find the 'link' column").

```sql
-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CRÉATION DE LA TABLE NOTIFICATIONS (Correction PGRST204)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'info', 'success', 'warning', 'alert'
    link TEXT, -- La colonne manquante
    timestamp TIMESTAMPTZ DEFAULT now(),
    is_read BOOLEAN DEFAULT false,
    target_user_id UUID REFERENCES auth.users(id),
    target_role TEXT,
    target_class TEXT
);

-- 3. AJOUT DES COMPTEURS ET COLONNES DE PROPRIÉTÉ
-- S'assure que chaque table a une colonne user_id pour le RLS
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.meet_links ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Ajout des compteurs de partage
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

-- 4. TABLE DES FAVORIS
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL, -- 'announcement' ou 'schedule'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, content_id, content_type)
);

-- 5. CRÉATION DE LA TABLE DES INTERACTIONS
CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL, 
    action_type TEXT NOT NULL DEFAULT 'share',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. FONCTION RPC POUR L'INCRÉMENTATION
CREATE OR REPLACE FUNCTION public.increment_share_count(target_table TEXT, target_id UUID)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE public.%I SET share_count = share_count + 1 WHERE id = $1', target_table)
    USING target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CONFIGURATION RLS GLOBALE
-- Active la RLS sur toutes les tables sensibles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 8. POLITIQUES DE LECTURE (SÉCURISÉES)
-- Tout le monde peut lire le contenu public/classe
DROP POLICY IF EXISTS "Public select" ON public.announcements;
CREATE POLICY "Public select" ON public.announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public select" ON public.exams;
CREATE POLICY "Public select" ON public.exams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public select" ON public.meet_links;
CREATE POLICY "Public select" ON public.meet_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public select" ON public.polls;
CREATE POLICY "Public select" ON public.polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public select" ON public.poll_options;
CREATE POLICY "Public select" ON public.poll_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public select" ON public.schedules;
CREATE POLICY "Public select" ON public.schedules FOR SELECT USING (true);

-- 9. POLITIQUES D'INSERTION (ADMIN & DÉLÉGUÉS)
-- Vérifie le rôle dans la table profiles pour autoriser l'insertion
DROP POLICY IF EXISTS "Insert for authorized roles" ON public.announcements;
CREATE POLICY "Insert for authorized roles" ON public.announcements 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'DELEGATE')
  )
);

DROP POLICY IF EXISTS "Insert for authorized roles" ON public.exams;
CREATE POLICY "Insert for authorized roles" ON public.exams 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'DELEGATE')
  )
);

DROP POLICY IF EXISTS "Insert for authorized roles" ON public.meet_links;
CREATE POLICY "Insert for authorized roles" ON public.meet_links 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'DELEGATE')
  )
);

DROP POLICY IF EXISTS "Insert for authorized roles" ON public.polls;
CREATE POLICY "Insert for authorized roles" ON public.polls 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'DELEGATE')
  )
);

DROP POLICY IF EXISTS "Insert for authorized roles" ON public.schedules;
CREATE POLICY "Insert for authorized roles" ON public.schedules 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'DELEGATE')
  )
);

-- Tout le monde peut techniquement créer une notification système via les triggers d'app
DROP POLICY IF EXISTS "Anyone can insert notification" ON public.notifications;
CREATE POLICY "Anyone can insert notification" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- 10. POLITIQUES DE MISE À JOUR ET SUPPRESSION (PROPRIÉTAIRE OU ADMIN)
DROP POLICY IF EXISTS "Update own or admin" ON public.announcements;
CREATE POLICY "Update own or admin" ON public.announcements 
FOR UPDATE USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

DROP POLICY IF EXISTS "Delete own or admin" ON public.announcements;
CREATE POLICY "Delete own or admin" ON public.announcements 
FOR DELETE USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- 11. POLITIQUES FAVORIS & VOTES (PERSONNEL)
DROP POLICY IF EXISTS "Manage own favorites" ON public.favorites;
CREATE POLICY "Manage own favorites" ON public.favorites 
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage own votes" ON public.poll_votes;
CREATE POLICY "Manage own votes" ON public.poll_votes 
FOR ALL USING (auth.uid() = user_id);

-- 12. NOTIFICATIONS (PERSONNEL)
DROP POLICY IF EXISTS "View own notifications" ON public.notifications;
CREATE POLICY "View own notifications" ON public.notifications 
FOR SELECT USING (
  target_user_id = auth.uid() OR 
  target_class = (SELECT classname FROM profiles WHERE id = auth.uid()) OR
  target_class = 'Général'
);

-- 13. INDEXATION POUR LA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_ann_user ON public.announcements(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_content ON public.interactions(content_id, content_type);
```
