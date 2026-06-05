
# Hermes Agent Integration

A custom goal-driven agent orchestrator built into IdeaForge. Authenticated users submit a goal; Hermes spawns one or more autonomous sub-agents that plan, run tool steps, and report back. Every agent uses an OpenRouter model the user picks per task.

> Note: there is no public "Hermes" agent framework that matches the brief. We'll build the orchestrator ourselves and brand it "Hermes" — same UX you'd get from AutoGPT/BabyAGI-style loops, but native to this app, RLS-scoped, and powered by your existing OpenRouter integration.

## What gets built

### 1. Database (new tables, all RLS-scoped to `user_id`)

- `hermes_tasks` — top-level goal a user submits
  - `goal`, `status` (queued/planning/running/completed/failed/cancelled), `model`, `result_summary`, `final_output`, timestamps
- `hermes_agents` — sub-agents spawned for a task
  - `task_id`, `role` (planner/worker/critic/custom), `model`, `system_prompt`, `status`, `iteration_count`
- `hermes_steps` — every reasoning step + tool call an agent makes
  - `agent_id`, `step_type` (thought/tool_call/tool_result/final), `content` (jsonb), `tokens_used`, `created_at`
- `hermes_settings` (per-user) — defaults: max iterations, max agents per task, default model, allowed tools

GRANTs + RLS policies on all four.

### 2. Server functions (`src/lib/api/hermes.functions.ts`)

- `createHermesTask({ goal, model, maxAgents, maxIterations })` — inserts task, kicks off planner
- `listHermesTasks()` / `getHermesTask(id)` — for dashboard
- `cancelHermesTask(id)` — flips status, halts loop
- `getHermesAgents(taskId)` / `getHermesSteps(agentId)` — drill-down
- `runHermesTick(taskId)` — internal: advances the agent loop one step (called from a streaming server route)
- `getHermesSettings()` / `updateHermesSettings(...)`

All protected with `requireSupabaseAuth`.

### 3. Streaming execution route (`src/routes/api/hermes-run.ts`)

Server route that streams agent progress over SSE while the loop runs:
- Planner agent decomposes the goal into a list of sub-tasks
- Worker agents execute each sub-task (max N in parallel) using OpenRouter via the existing `ai-gateway.server.ts` resolver
- Built-in tools: `web_search` (Perplexity, already wired), `summarize`, `finish`
- Critic pass at the end consolidates outputs into `final_output`
- Each thought / tool call / result persisted to `hermes_steps` so the dashboard re-renders live

### 4. Hermes Dashboard (`src/routes/_authenticated/hermes.tsx` + children)

New top-level section in the app, separate from the existing project dashboard:

- `/hermes` — task list (status badges, model used, agents spawned, last activity)
- `/hermes/new` — submit a goal: textarea, OpenRouter model picker (reuses the unified catalog from `openrouter.functions.ts`), max-agents slider, max-iterations slider
- `/hermes/$taskId` — live timeline view: agents as columns, steps as cards, streaming as the task runs; cancel button; final output panel
- `/hermes/agents` — agent management: view all agents across tasks, archive completed, see token usage per model
- `/hermes/settings` — user defaults

Navigation: add a "Hermes" link to the existing authenticated sidebar/header.

### 5. Admin surface

Admins get an extra tab in `/admin/skills` to define **Hermes role presets** (planner / worker / critic system prompts + default model) so non-admins picking "start a task" get sane defaults.

## Out of scope (ask before adding)

- Long-running background execution after the user closes the tab (would need a queue worker — current Cloudflare Workers runtime can't keep that alive). MVP runs while the dashboard tab is open and streams progress.
- Custom user-defined tools / MCP integration
- Multi-user task sharing

## Technical notes

- Reuses `src/lib/api/ai-gateway.server.ts` resolver so `openrouter/...` models route through OpenRouter automatically
- Reuses existing OpenRouter catalog endpoint for model picker
- All loops bounded by `maxIterations` server-side to prevent runaway spend
- Token usage per step recorded for future cost reporting
- Translation strings added for the 6 existing languages (English written; others fall back to English until translated)

Ship in this order: migration → server functions → streaming route → dashboard pages → admin presets → nav link.
