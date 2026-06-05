
-- ENUMS
CREATE TYPE public.hermes_task_status AS ENUM ('queued','planning','running','completed','failed','cancelled');
CREATE TYPE public.hermes_agent_role AS ENUM ('planner','worker','critic','custom');
CREATE TYPE public.hermes_agent_status AS ENUM ('idle','running','completed','failed','cancelled');
CREATE TYPE public.hermes_step_type AS ENUM ('thought','tool_call','tool_result','final','error');

-- TASKS
CREATE TABLE public.hermes_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text NOT NULL,
  status public.hermes_task_status NOT NULL DEFAULT 'queued',
  model text NOT NULL,
  max_agents integer NOT NULL DEFAULT 3,
  max_iterations integer NOT NULL DEFAULT 8,
  result_summary text,
  final_output jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_tasks TO authenticated;
GRANT ALL ON public.hermes_tasks TO service_role;
ALTER TABLE public.hermes_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own hermes tasks" ON public.hermes_tasks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own hermes tasks" ON public.hermes_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own hermes tasks" ON public.hermes_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own hermes tasks" ON public.hermes_tasks FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_hermes_tasks_touch BEFORE UPDATE ON public.hermes_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_hermes_tasks_user_created ON public.hermes_tasks (user_id, created_at DESC);

-- AGENTS
CREATE TABLE public.hermes_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.hermes_agent_role NOT NULL,
  name text NOT NULL,
  model text NOT NULL,
  system_prompt text NOT NULL DEFAULT '',
  objective text,
  status public.hermes_agent_status NOT NULL DEFAULT 'idle',
  iteration_count integer NOT NULL DEFAULT 0,
  output jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_agents TO authenticated;
GRANT ALL ON public.hermes_agents TO service_role;
ALTER TABLE public.hermes_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own hermes agents" ON public.hermes_agents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own hermes agents" ON public.hermes_agents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own hermes agents" ON public.hermes_agents FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own hermes agents" ON public.hermes_agents FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_hermes_agents_touch BEFORE UPDATE ON public.hermes_agents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_hermes_agents_task ON public.hermes_agents (task_id);

-- STEPS
CREATE TABLE public.hermes_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.hermes_agents(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step_type public.hermes_step_type NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_steps TO authenticated;
GRANT ALL ON public.hermes_steps TO service_role;
ALTER TABLE public.hermes_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own hermes steps" ON public.hermes_steps FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own hermes steps" ON public.hermes_steps FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own hermes steps" ON public.hermes_steps FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_hermes_steps_agent_created ON public.hermes_steps (agent_id, created_at);
CREATE INDEX idx_hermes_steps_task_created ON public.hermes_steps (task_id, created_at);

-- SETTINGS
CREATE TABLE public.hermes_settings (
  user_id uuid PRIMARY KEY,
  default_model text NOT NULL DEFAULT 'openrouter/openai/gpt-4o-mini',
  max_agents integer NOT NULL DEFAULT 3,
  max_iterations integer NOT NULL DEFAULT 8,
  allowed_tools text[] NOT NULL DEFAULT ARRAY['web_search','summarize','finish']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_settings TO authenticated;
GRANT ALL ON public.hermes_settings TO service_role;
ALTER TABLE public.hermes_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hermes settings" ON public.hermes_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_hermes_settings_touch BEFORE UPDATE ON public.hermes_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ROLE PRESETS (admin-managed)
CREATE TABLE public.hermes_role_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.hermes_agent_role NOT NULL,
  name text NOT NULL,
  system_prompt text NOT NULL,
  default_model text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_role_presets TO authenticated;
GRANT ALL ON public.hermes_role_presets TO service_role;
ALTER TABLE public.hermes_role_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read enabled role presets" ON public.hermes_role_presets FOR SELECT TO authenticated USING (enabled = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage role presets" ON public.hermes_role_presets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_hermes_role_presets_touch BEFORE UPDATE ON public.hermes_role_presets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default role presets
INSERT INTO public.hermes_role_presets (role, name, system_prompt, default_model, sort_order) VALUES
  ('planner', 'Default Planner', 'You are Hermes Planner. Decompose the user goal into a minimal ordered list of concrete sub-tasks. Respond ONLY with JSON: {"subtasks":[{"title":"...","objective":"..."}]}. Keep to 2-5 subtasks.', 'openrouter/openai/gpt-4o-mini', 10),
  ('worker',  'Default Worker',  'You are a Hermes Worker agent. You have tools: web_search(query), summarize(text), finish(answer). Think step by step. When you have enough information call finish with a thorough answer. Respond ONLY in JSON: {"thought":"...","tool":"web_search|summarize|finish","args":{...}}.', 'openrouter/openai/gpt-4o-mini', 20),
  ('critic',  'Default Critic',  'You are Hermes Critic. Read all sub-task outputs and produce a single consolidated final report addressing the original goal. Be concise, factual, and structured with markdown headings.', 'openrouter/openai/gpt-4o-mini', 30);
