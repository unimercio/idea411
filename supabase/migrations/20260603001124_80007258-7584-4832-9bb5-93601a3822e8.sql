-- Enum of components that can be steered by a skill
CREATE TYPE public.skill_component AS ENUM (
  'vetting_strategic',
  'vetting_compliance',
  'vetting_market',
  'vetting_sales',
  'chat',
  'market_research',
  'intake_refine'
);

CREATE TABLE public.model_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component public.skill_component NOT NULL,
  name text NOT NULL,
  model text NOT NULL,
  system_preamble text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one default per component
CREATE UNIQUE INDEX model_skills_one_default_per_component
  ON public.model_skills (component)
  WHERE is_default = true;

CREATE INDEX model_skills_component_idx ON public.model_skills (component, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_skills TO authenticated;
GRANT ALL ON public.model_skills TO service_role;

ALTER TABLE public.model_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read enabled skills"
  ON public.model_skills
  FOR SELECT
  TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage skills"
  ON public.model_skills
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER model_skills_touch_updated_at
  BEFORE UPDATE ON public.model_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
