CREATE TYPE public.venture_feedback_type AS ENUM ('general','risk','opportunity','next_step');

CREATE TABLE public.venture_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.venture_feedback(id) ON DELETE CASCADE,
  type public.venture_feedback_type NOT NULL DEFAULT 'general',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX venture_feedback_project_idx ON public.venture_feedback(project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venture_feedback TO authenticated;
GRANT ALL ON public.venture_feedback TO service_role;

ALTER TABLE public.venture_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read venture feedback"
  ON public.venture_feedback FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own venture feedback"
  ON public.venture_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own venture feedback"
  ON public.venture_feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own venture feedback"
  ON public.venture_feedback FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER venture_feedback_touch_updated_at
  BEFORE UPDATE ON public.venture_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();