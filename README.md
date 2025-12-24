
# UniConnect ESP - Configuration SQL

Ce script doit être exécuté dans le **SQL Editor** de votre tableau de bord Supabase pour garantir que toutes les fonctionnalités (Thèmes, Planning, Mots de passe) sont opérationnelles.

## 🚀 Script de Réparation Rapide (Correctif Theme & Profil)

Exécutez ce bloc si vous avez des erreurs lors de la mise à jour du profil :

```sql
-- 1. Ajout des colonnes de personnalisation manquantes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#0ea5e9';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS classname text DEFAULT 'Général';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_name text DEFAULT 'ESP Dakar';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Nettoyage et Réinitialisation des Politiques RLS (Sécurité)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Autoriser la lecture publique des profils (nécessaire pour afficher les auteurs des messages)
DROP POLICY IF EXISTS "Lecture publique des profils" ON public.profiles;
CREATE POLICY "Lecture publique des profils" 
ON public.profiles FOR SELECT 
USING (true);

-- Autoriser l'utilisateur à modifier SON PROPRE profil (Nom, Thème, Classe)
DROP POLICY IF EXISTS "Utilisateurs modifient leur propre profil" ON public.profiles;
CREATE POLICY "Utilisateurs modifient leur propre profil" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Autoriser les Admins à tout gérer
DROP POLICY IF EXISTS "Admins modifient tout" ON public.profiles;
CREATE POLICY "Admins modifient tout" 
ON public.profiles FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
```

## 📅 Configuration des Plannings (Visibilité Étudiante)

Exécutez ceci pour que les étudiants puissent voir les emplois du temps créés :

```sql
-- Activer la sécurité sur les tables de planning
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut LIRE le planning
DROP POLICY IF EXISTS "Lecture publique des plannings" ON public.schedules;
CREATE POLICY "Lecture publique des plannings" ON public.schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lecture publique des slots" ON public.schedule_slots;
CREATE POLICY "Lecture publique des slots" ON public.schedule_slots FOR SELECT USING (true);

-- Seuls les Admins/Délégués peuvent MODIFIER le planning
DROP POLICY IF EXISTS "Gestion planning délégués/admins" ON public.schedule_slots;
CREATE POLICY "Gestion planning délégués/admins" ON public.schedule_slots FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'DELEGATE')
  )
);
```

## 📝 Structure Complète de la Table Profiles

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    role text DEFAULT 'STUDENT', -- 'STUDENT', 'DELEGATE', 'ADMIN'
    classname text DEFAULT 'Général',
    school_name text DEFAULT 'ESP Dakar',
    avatar text,
    theme_color text DEFAULT '#0ea5e9',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);
```

### Note sur les mots de passe
La modification des mots de passe par l'utilisateur (via son profil) s'effectue directement par l'appel `supabase.auth.updateUser({ password: '...' })`. Ce processus est géré par la couche **GoTrue** de Supabase et ne nécessite aucune politique SQL particulière dans le schéma `public`. L'utilisateur authentifié a nativement le droit de modifier ses propres informations d'accès tant que sa session est active.
