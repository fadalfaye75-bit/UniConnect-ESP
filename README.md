
# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée pour l'ESP de Dakar.

## 🗳️ SQL : Module Sondages & Configuration (À copier dans Supabase)

Exécutez ce bloc pour activer les sondages et la configuration de l'IA.

```sql
-- 1. TABLES (S'assurer que les colonnes temporelles existent)
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

-- 2. POLITIQUES RLS SIMPLIFIÉES (Évite les fonctions personnalisées si possible)
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Politique de lecture des sondages : Admin voit tout, les autres voient leur classe ou Général
-- On utilise une sous-requête simple pour éviter les problèmes de récursion RLS
DROP POLICY IF EXISTS "Lecture Sondages" ON public.polls;
CREATE POLICY "Lecture Sondages" ON public.polls FOR SELECT TO authenticated
USING (
    classname = 'Général' 
    OR classname IN (SELECT classname FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'delegate')
);

-- Gestion (Admin et Délégués)
DROP POLICY IF EXISTS "Gestion Sondages" ON public.polls;
CREATE POLICY "Gestion Sondages" ON public.polls FOR ALL TO authenticated
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'delegate'));

-- Options (Toujours visibles pour les sondages visibles)
DROP POLICY IF EXISTS "Lecture Options" ON public.poll_options;
CREATE POLICY "Lecture Options" ON public.poll_options FOR SELECT TO authenticated USING (true);

-- Votes (L'utilisateur ne peut voir que son vote, mais peut insérer)
DROP POLICY IF EXISTS "Action de Voter" ON public.poll_votes;
CREATE POLICY "Action de Voter" ON public.poll_votes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Lecture propre vote" ON public.poll_votes;
CREATE POLICY "Lecture propre vote" ON public.poll_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);
```
