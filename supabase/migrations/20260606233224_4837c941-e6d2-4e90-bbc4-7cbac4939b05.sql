
-- enums
DO $$ BEGIN
  CREATE TYPE public.feedback_type AS ENUM ('wish','bug','issue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.feedback_status AS ENUM ('open','planned','in_progress','done','wontfix');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bounty_status AS ENUM ('open','awarded','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- feedback_items
CREATE TABLE public.feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.feedback_type NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status public.feedback_status NOT NULL DEFAULT 'open',
  votes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_items TO authenticated;
GRANT ALL ON public.feedback_items TO service_role;
ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read feedback" ON public.feedback_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own feedback" ON public.feedback_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own feedback" ON public.feedback_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users delete own feedback" ON public.feedback_items
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_feedback_items_updated
  BEFORE UPDATE ON public.feedback_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- feedback_votes
CREATE TABLE public.feedback_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.feedback_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.feedback_votes TO authenticated;
GRANT ALL ON public.feedback_votes TO service_role;
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read votes" ON public.feedback_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own vote" ON public.feedback_votes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own vote" ON public.feedback_votes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- maintain votes count
CREATE OR REPLACE FUNCTION public.feedback_votes_count_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feedback_items SET votes = votes + 1 WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feedback_items SET votes = GREATEST(votes - 1, 0) WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_feedback_votes_ins
  AFTER INSERT ON public.feedback_votes
  FOR EACH ROW EXECUTE FUNCTION public.feedback_votes_count_trg();
CREATE TRIGGER trg_feedback_votes_del
  AFTER DELETE ON public.feedback_votes
  FOR EACH ROW EXECUTE FUNCTION public.feedback_votes_count_trg();

-- bounties
CREATE TABLE public.bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_item_id uuid REFERENCES public.feedback_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.bounty_status NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL,
  awarded_to uuid,
  awarded_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounties TO authenticated;
GRANT ALL ON public.bounties TO service_role;
ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read bounties" ON public.bounties
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert bounties" ON public.bounties
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bounties" ON public.bounties
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete bounties" ON public.bounties
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_bounties_updated
  BEFORE UPDATE ON public.bounties
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
