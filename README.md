# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée pour l'École Supérieure Polytechnique de Dakar.

## 🛠️ Configuration Supabase (SQL Editor)

Exécutez ce script complet pour initialiser la base de données. Il crée toutes les tables, définit les fonctions de rôle et active la sécurité (RLS) pour les administrateurs, délégués et étudiants.

```sql
-- 1. FONCTIONS DE REQUÊTE SÉCURISÉES (Indispensable pour le RLS)
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_class() RETURNS text AS $$
  SELECT classname FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- 2. TABLES DU MODULE SONDAGES (Mis à jour avec dates de programmation)
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
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (poll_id, user_id)
);

-- 3. TABLE DE CONFIGURATION GLOBALE (Pour l'IA)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insertion de la config par défaut pour l'IA
INSERT INTO public.app_settings (key, value)
VALUES ('ai_config', '{"tone": "friendly", "verbosity": "medium", "customInstructions": "Tu es un assistant universitaire intelligent pour l''ESP de Dakar.", "isActive": true}')
ON CONFLICT (key) DO NOTHING;


-- 4. TRIGGER : MISE À JOUR AUTOMATIQUE DU COMPTEUR DE VOTES
CREATE OR REPLACE FUNCTION public.handle_poll_vote_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.poll_options SET votes = votes + 1 WHERE id = NEW.option_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.poll_options SET votes = votes - 1 WHERE id = OLD.option_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.option_id <> NEW.option_id) THEN
            UPDATE public.poll_options SET votes = votes - 1 WHERE id = OLD.option_id;
            UPDATE public.poll_options SET votes = votes + 1 WHERE id = NEW.option_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_poll_vote_sync ON public.poll_votes;
CREATE TRIGGER tr_poll_vote_sync
AFTER INSERT OR UPDATE OR DELETE ON public.poll_votes
FOR EACH ROW EXECUTE FUNCTION public.handle_poll_vote_sync();


-- 5. POLITIQUES DE SÉCURITÉ (RLS)
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Politiques pour 'polls'
DROP POLICY IF EXISTS "Lecture Sondages" ON public.polls;
CREATE POLICY "Lecture Sondages" ON public.polls FOR SELECT TO authenticated
USING (classname = 'Général' OR classname = get_my_class() OR get_my_role() IN ('admin', 'delegate'));

DROP POLICY IF EXISTS "Gestion Sondages" ON public.polls;
CREATE POLICY "Gestion Sondages" ON public.polls FOR ALL TO authenticated
USING (get_my_role() IN ('admin', 'delegate'));

-- Politiques pour 'poll_options'
DROP POLICY IF EXISTS "Lecture Options" ON public.poll_options;
CREATE POLICY "Lecture Options" ON public.poll_options FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gestion Options" ON public.poll_options;
CREATE POLICY "Gestion Options" ON public.poll_options FOR ALL TO authenticated
USING (get_my_role() IN ('admin', 'delegate'));

-- Politiques pour 'poll_votes'
DROP POLICY IF EXISTS "Action de Voter" ON public.poll_votes;
CREATE POLICY "Action de Voter" ON public.poll_votes FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM public.polls WHERE id = poll_id AND is_active = true)
);

DROP POLICY IF EXISTS "Lecture propre vote" ON public.poll_votes;
CREATE POLICY "Lecture propre vote" ON public.poll_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Politiques pour 'app_settings'
DROP POLICY IF EXISTS "Lecture Config" ON public.app_settings;
CREATE POLICY "Lecture Config" ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gestion Config Admin" ON public.app_settings;
CREATE POLICY "Gestion Config Admin" ON public.app_settings FOR ALL TO authenticated
USING (get_my_role() = 'admin');