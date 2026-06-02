
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users read own roles"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins read all roles"
  on public.user_roles for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Prompt template category
create type public.prompt_category as enum ('strategic', 'compliance', 'market', 'sales');

create table public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category public.prompt_category not null,
  template text not null,
  requires text[] not null default '{}',
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prompt_templates_category_idx on public.prompt_templates (category, sort_order);

grant select on public.prompt_templates to authenticated;
grant all on public.prompt_templates to service_role;

alter table public.prompt_templates enable row level security;

create policy "Authenticated can read enabled templates"
  on public.prompt_templates for select
  to authenticated
  using (enabled = true or public.has_role(auth.uid(), 'admin'));

create policy "Admins manage templates"
  on public.prompt_templates for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prompt_templates_set_updated_at
  before update on public.prompt_templates
  for each row execute function public.touch_updated_at();

-- Seed defaults
insert into public.prompt_templates (slug, category, template, requires, sort_order) values
  ('strat-leverage','strategic','What''s the single highest-leverage change to raise the {overallScore}/100 score?', array['overallScore'], 10),
  ('strat-steelman','strategic','Steelman the case AGAINST this idea in 5 bullets.', '{}', 20),
  ('strat-budget','strategic','If I had $25k and 90 days, what would you do first?', '{}', 30),
  ('strat-kill','strategic','What would a competitor do to kill this in 12 months?', '{}', 40),
  ('strat-weakest','strategic','Why is {weakestPillar} my weakest pillar — and what fixes it fastest?', array['weakestPillar'], 50),

  ('comp-derisk','compliance','How do I de-risk "{topRisk}" before launch?', array['topRisk'], 10),
  ('comp-cheapest','compliance','What''s the cheapest path to {regulation} compliance?', array['regulation'], 20),
  ('comp-clearance','compliance','Draft a clearance plan for: {ipConcern}', array['ipConcern'], 30),
  ('comp-checklist','compliance','Build a pre-launch {regulation} checklist with owners and dates.', array['regulation'], 40),
  ('comp-defer','compliance','Which risks could I defer past MVP without regret?', '{}', 50),

  ('mkt-exposed','market','Where am I most exposed against {competitor}?', array['competitor'], 10),
  ('mkt-wedge','market','What wedge could I take against {competitor} without starting a price war?', array['competitor'], 20),
  ('mkt-indirect','market','How worried should I be about {indirectCompetitor} as an indirect substitute?', array['indirectCompetitor'], 30),
  ('mkt-tail','market','How do I ride the "{upTrend}" tailwind?', array['upTrend'], 40),
  ('mkt-down','market','What if "{downTrend}" accelerates?', array['downTrend'], 50),
  ('mkt-moat','market','How do I make "{differentiator}" defensible?', array['differentiator'], 60),
  ('mkt-barrier','market','What''s the fastest way past the "{barrier}" barrier?', array['barrier'], 70),
  ('mkt-bottoms','market','Stress-test my TAM/SAM/SOM with a bottoms-up build.', '{}', 80),

  ('sales-price','sales','Justify the {recommendedPrice} price point — or argue against it.', array['recommendedPrice'], 10),
  ('sales-outreach','sales','Write 5 cold-outreach messages for {targetCustomer}.', array['targetCustomer'], 20),
  ('sales-objections','sales','What objections will {targetCustomer} raise — and how do I handle each?', array['targetCustomer'], 30),
  ('sales-plan','sales','Turn "{topGtm}" into a 30-day execution plan.', array['topGtm'], 40),
  ('sales-interviews','sales','Who should I talk to in my first 10 customer interviews?', '{}', 50),
  ('sales-signals','sales','What signals would tell me to pivot vs. push?', '{}', 60);

-- Bootstrap: claim admin if none exists
create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select exists(select 1 from public.user_roles where role = 'admin') into _admin_exists;
  if _admin_exists then
    return false;
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
  return true;
end;
$$;

grant execute on function public.claim_first_admin() to authenticated;
