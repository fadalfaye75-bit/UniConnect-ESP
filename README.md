
# UniConnect ESP - Configuration SQL Complète

Exécutez ce script pour initialiser la gestion des documents, des sondages et la sécurité par classe.

```sql
-- 1. Tables Sondages
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  question text NOT NULL,
  classname text NOT NULL,
  is_active boolean DEFAULT true,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES public.polls ON DELETE CASCADE,
  label text NOT NULL,
  votes integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES public.polls ON DELETE CASCADE,
  option_id uuid REFERENCES public.poll_options ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- 2. Activation RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- 3. Politiques de sécurité

-- POLLS
CREATE POLICY "Polls viewable by class members" ON public.polls
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.classname = public.polls.classname OR profiles.role = 'ADMIN' OR public.polls.classname = 'Général')
  )
);

CREATE POLICY "Delegates can insert polls for their class" ON public.polls
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'ADMIN' OR (profiles.role = 'DELEGATE' AND profiles.classname = classname))
  )
);

CREATE POLICY "Delegates or Admins can update their polls" ON public.polls
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'ADMIN' OR (profiles.role = 'DELEGATE' AND profiles.classname = classname))
  )
);

-- POLL OPTIONS
CREATE POLICY "Poll options viewable by anyone who can see the poll" ON public.poll_options
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.polls WHERE id = poll_id)
);

CREATE POLICY "Admins or delegates can manage options" ON public.poll_options
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    JOIN public.polls ON polls.classname = profiles.classname
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'ADMIN' OR (profiles.role = 'DELEGATE' AND polls.id = poll_id))
  )
);

-- POLL VOTES
CREATE POLICY "Users can see their own votes" ON public.poll_votes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can cast votes" ON public.poll_votes
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Fonction RPC pour Vote Atomique (Versionnage / Changement d'avis)
CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_poll_id uuid, p_option_id uuid)
RETURNS void AS $$
DECLARE
  v_old_option_id uuid;
BEGIN
  -- Vérifier si le sondage est encore ouvert
  IF NOT EXISTS (
    SELECT 1 FROM public.polls 
    WHERE id = p_poll_id 
    AND is_active = true 
    AND (end_time IS NULL OR end_time > now())
  ) THEN
    RAISE EXCEPTION 'Le scrutin est clos ou expiré.';
  END IF;

  -- Chercher un ancien vote
  SELECT option_id INTO v_old_option_id 
  FROM public.poll_votes 
  WHERE poll_id = p_poll_id AND user_id = auth.uid();

  IF v_old_option_id IS NOT NULL THEN
    -- Mettre à jour : décrémenter l'ancienne option
    UPDATE public.poll_options SET votes = votes - 1 WHERE id = v_old_option_id;
    -- Changer le vote
    UPDATE public.poll_votes SET option_id = p_option_id WHERE poll_id = p_poll_id AND user_id = auth.uid();
  ELSE
    -- Nouveau vote
    INSERT INTO public.poll_votes (poll_id, option_id, user_id) 
    VALUES (p_poll_id, p_option_id, auth.uid());
  END IF;
  
  -- Incrémenter la nouvelle option
  UPDATE public.poll_options SET votes = votes + 1 WHERE id = p_option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
