
# UniConnect ESP - Configuration SQL Complète

Exécutez ce script dans l'éditeur SQL de votre interface Supabase pour activer toutes les fonctionnalités et corriger les bugs de vote/déconnexion.

## 🗳️ 1. Correction du Système de Vote (Bouton "Bloqué à 0%")

```sql
-- A. S'assurer que les compteurs ne sont jamais NULL
UPDATE public.poll_options SET votes = 0 WHERE votes IS NULL;
ALTER TABLE public.poll_options ALTER COLUMN votes SET DEFAULT 0;

-- B. Fonction de vote robuste (SECURITY DEFINER pour bypasser RLS lors de l'écriture)
CREATE OR REPLACE FUNCTION cast_poll_vote(p_poll_id uuid, p_option_id uuid)
RETURNS void AS $$
BEGIN
  -- 1. Supprimer le vote précédent de l'utilisateur pour ce sondage précis
  DELETE FROM public.poll_votes 
  WHERE poll_id = p_poll_id 
  AND user_id = auth.uid();

  -- 2. Insérer le nouveau vote
  INSERT INTO public.poll_votes (poll_id, option_id, user_id)
  VALUES (p_poll_id, p_option_id, auth.uid());

  -- 3. Mettre à jour les compteurs de TOUTES les options de ce sondage pour une cohérence totale
  UPDATE public.poll_options 
  SET votes = (
    SELECT count(*) 
    FROM public.poll_votes 
    WHERE public.poll_votes.option_id = public.poll_options.id
  )
  WHERE public.poll_options.poll_id = p_poll_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Activer la lecture des résultats (Indispensable pour l'affichage des %)
-- Sans ces lignes, le frontend ne peut pas lire le nombre de votes des options (donc 0%)
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture des options" ON public.poll_options;
CREATE POLICY "Lecture des options" ON public.poll_options FOR SELECT TO authenticated USING (true);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture des votes" ON public.poll_votes;
CREATE POLICY "Lecture des votes" ON public.poll_votes FOR SELECT TO authenticated USING (true);
```

## 🏢 2. Configuration des Classes (Emails de partage)

```sql
-- 1. S'assurer que la table classes possède la colonne email
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS email text;

-- 2. Activer RLS sur la table classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- 3. Politique : Tout utilisateur authentifié peut lire les classes
DROP POLICY IF EXISTS "Lecture publique des classes" ON public.classes;
CREATE POLICY "Lecture publique des classes" 
ON public.classes FOR SELECT 
TO authenticated 
USING (true);

-- 4. Exemple de mise à jour des emails de filières
UPDATE public.classes SET email = 'delegue.dsti@esp.sn' WHERE name ILIKE '%DSTI%';
```

## 🛠️ 3. Structure des Partages

```sql
-- S'assurer que les colonnes de partage existent
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS share_count int4 DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS share_count int4 DEFAULT 0;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS share_count int4 DEFAULT 0;

-- Fonction d'incrémentation universelle
CREATE OR REPLACE FUNCTION increment_share_count(target_table text, target_id uuid)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET share_count = COALESCE(share_count, 0) + 1 WHERE id = %L', target_table, target_id);
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
