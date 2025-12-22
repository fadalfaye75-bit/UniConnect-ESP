
# 🎓 UniConnect ESP - Système de Gestion

## 🚀 Script SQL pour les Interactions et Partages

Exécutez ce script dans votre SQL Editor Supabase pour activer le suivi des partages et les compteurs. Ce script est conçu pour être ré-exécutable sans erreurs.

```sql
-- 1. AJOUT DES COMPTEURS DE PARTAGE SUR LES TABLES EXISTANTES
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

-- 2. TABLE DES FAVORIS
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL, -- 'announcement' ou 'schedule'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, content_id, content_type)
);

-- 3. CRÉATION DE LA TABLE DES INTERACTIONS (LOGS DE PARTAGE)
CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL, -- 'announcement', 'exam', 'poll', 'schedule'
    action_type TEXT NOT NULL DEFAULT 'share', -- 'share', 'view'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. FONCTION RPC POUR L'INCRÉMENTATION ATOMIQUE
CREATE OR REPLACE FUNCTION public.increment_share_count(target_table TEXT, target_id UUID)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE public.%I SET share_count = share_count + 1 WHERE id = $1', target_table)
    USING target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. SÉCURITÉ RLS (Nettoyage et ré-application propre)
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- Suppression des politiques existantes pour éviter l'erreur 42710
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can log their shares" ON public.interactions;

-- Création des nouvelles politiques
CREATE POLICY "Users can manage their own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can log their shares" ON public.interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. INDEXATION
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_content ON public.interactions(content_id, content_type);
```
