# UniConnect ESP - Sécurité & RLS (Production)

Ce script SQL configure la sécurité granulaire de la plateforme. Il doit être exécuté dans l'éditeur SQL de Supabase.

## 🛠️ 1. Correction du Schéma (Colonnes de propriété et Thèmes)
```sql
-- S'assure que la colonne user_id existe dans toutes les tables de contenu
DO $$ 
DECLARE 
  t text;
  tables text[] := ARRAY['announcements', 'exams', 'schedules', 'meet_links', 'polls'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE', t);
    END IF;
  END LOOP;
END $$;

-- Ajout des colonnes de couleur pour la personnalisation visuelle
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS color text DEFAULT '#0ea5e9';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS color text DEFAULT '#0ea5e9';
```

## 🔐 2. Fonctions de Rôle (Security Definer)
```sql
-- Vérifie si l'utilisateur est un ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN';
END;
$$;

-- Vérifie si l'utilisateur est un DELEGATE ou ADMIN
CREATE OR REPLACE FUNCTION public.is_delegate()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'DELEGATE');
END;
$$;
```

## 🛡️ 3. Politiques RLS par Bouton d'Action

### 📢 Contenus Généraux (Annonces, Examens, Documents, Directs & Sondages)
```sql
DO $$ 
DECLARE 
  t text;
  tables text[] := ARRAY['announcements', 'exams', 'schedules', 'meet_links', 'polls'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    
    -- SELECT (Lecture/Copie/Partage)
    EXECUTE format('DROP POLICY IF EXISTS "select_all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "select_all" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    
    -- INSERT (Bouton Ajouter)
    EXECUTE format('DROP POLICY IF EXISTS "delegate_insert" ON public.%I', t);
    EXECUTE format('CREATE POLICY "delegate_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (is_delegate())', t);
    
    -- UPDATE (Bouton Modifier)
    EXECUTE format('DROP POLICY IF EXISTS "owner_admin_update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "owner_admin_update" ON public.%I FOR UPDATE TO authenticated USING (is_admin() OR (is_delegate() AND auth.uid() = user_id))', t);
    
    -- DELETE (Bouton Supprimer - ADMIN ONLY)
    EXECUTE format('DROP POLICY IF EXISTS "admin_delete_only" ON public.%I', t);
    EXECUTE format('CREATE POLICY "admin_delete_only" ON public.%I FOR DELETE TO authenticated USING (is_admin())', t);
  END LOOP;
END $$;
```

### 🗳️ Votes & Options (Logique Spécifique)
```sql
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_options" ON public.poll_options;
CREATE POLICY "admin_manage_options" ON public.poll_options FOR ALL TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "anyone_read_options" ON public.poll_options;
CREATE POLICY "anyone_read_options" ON public.poll_options FOR SELECT TO authenticated USING (true);

-- Gestion des votes (Contrainte d'unicité via SQL recommandable en plus du RLS)
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_can_vote" ON public.poll_votes;
CREATE POLICY "user_can_vote" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_can_change_vote" ON public.poll_votes;
CREATE POLICY "user_can_change_vote" ON public.poll_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "anyone_read_votes" ON public.poll_votes;
CREATE POLICY "anyone_read_votes" ON public.poll_votes FOR SELECT TO authenticated USING (true);
```