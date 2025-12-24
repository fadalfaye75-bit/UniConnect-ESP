
# UniConnect ESP - Configuration SQL Complète

Copiez et exécutez ce script dans l'éditeur SQL de votre projet Supabase.

```sql
-- 1. Nettoyage des anciennes politiques pour éviter les erreurs de doublons
DROP POLICY IF EXISTS "Consultation publique du planning" ON public.schedule_slots;
DROP POLICY IF EXISTS "Modification par Admin/Délégué" ON public.schedule_slots;
DROP POLICY IF EXISTS "Tout le monde peut lire le planning" ON public.schedule_slots;
DROP POLICY IF EXISTS "Admins et Délégués peuvent modifier" ON public.schedule_slots;

-- 2. Création de la table des créneaux (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS public.schedule_slots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users ON DELETE CASCADE,
    classname text NOT NULL,
    day integer NOT NULL, -- 0 (Lundi) à 5 (Samedi)
    start_time text NOT NULL, -- Format 'HH:MM'
    end_time text NOT NULL,   -- Format 'HH:MM'
    subject text NOT NULL,
    teacher text,
    room text,
    color text DEFAULT '#0ea5e9',
    created_at timestamptz DEFAULT now(),

    -- CONTRAINTE RYTHME ESP : Verrouillage strict des créneaux académiques
    -- Aucun cours n'est autorisé entre 12h01 et 14h29
    CONSTRAINT esp_rhythm_check CHECK (
        (start_time >= '08:00' AND end_time <= '12:00') OR
        (start_time >= '14:30' AND end_time <= '18:30')
    )
);

-- 3. Activation de la sécurité RLS
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

-- 4. Création des nouvelles politiques propres
CREATE POLICY "Consultation publique du planning" 
ON public.schedule_slots FOR SELECT USING (true);

CREATE POLICY "Modification par Admin/Délégué" 
ON public.schedule_slots FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('ADMIN', 'DELEGATE')
    )
);

-- 5. Fonction RPC pour les statistiques de partage (optionnel)
CREATE OR REPLACE FUNCTION increment_share_count(target_table text, target_id uuid)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE %I SET share_count = COALESCE(share_count, 0) + 1 WHERE id = %L', target_table, target_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
