// Hermes agent engine. Runs the planner → workers → critic loop and writes
// progress to Supabase using a per-task Supabase client (passed in by the SSE
// route after verifying ownership). Designed for streaming: emit() callback
// pushes JSON events out to the SSE stream.

import { resolveAiEndpoint, buildAiHeaders } from "./ai-gateway.server";

export type EngineEvent =
  | { type: "task_status"; status: string }
  | { type: "agent_created"; agent: { id: string; role: string; name: string; model: string; objective: string | null } }
  | { type: "agent_status"; agentId: string; status: string; iteration_count?: number }
  | { type: "step"; step: { id: string; agent_id: string; step_type: string; content: any; created_at: string } }
  | { type: "task_completed"; summary: string; final_output: any }
  | { type: "task_failed"; error: string }
  | { type: "done" };

type Supa = any;

const DEFAULT_PLANNER_PROMPT = `You are Hermes Planner. Decompose the user goal into 2-5 concrete sub-tasks.
Respond ONLY with JSON of this shape (no markdown, no prose):
{"subtasks":[{"title":"short title","objective":"what this worker must achieve"}]}`;

const DEFAULT_WORKER_PROMPT = `You are a Hermes Worker. You have these tools:
- web_search(query: string) — returns web research with citations
- finish(answer: string) — call when objective is fully met

On each turn respond ONLY with JSON (no markdown):
{"thought":"brief reasoning","tool":"web_search"|"finish","args":{"query":"..."}|{"answer":"..."}}

Be efficient. Use at most a few web_search calls then finish.`;

const DEFAULT_CRITIC_PROMPT = `You are Hermes Critic. Given the user goal and each worker's final answer,
write a single consolidated report in markdown that directly addresses the goal.
Use headings, bullet lists, and cite worker findings. Be factual and concise.`;

async function chat(model: string, messages: Array<{ role: string; content: string }>, opts?: { json?: boolean }) {
  const ep = resolveAiEndpoint(model);
  const body: any = {
    model: ep.model,
    messages,
  };
  if (opts?.json) body.response_format = { type: "json_object" };
  const res = await fetch(ep.url, {
    method: "POST",
    headers: buildAiHeaders(ep),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    tokens: json.usage?.total_tokens ?? 0,
  };
}

function tryParseJSON<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    // Try to extract JSON from a markdown fenced block
    const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try {
        return JSON.parse(m[1]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function webSearch(query: string): Promise<string> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return `web_search unavailable: PERPLEXITY_API_KEY not set. Query was: ${query}`;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "You are a concise research assistant. Return key facts with inline citations." },
        { role: "user", content: query },
      ],
      max_tokens: 700,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return `web_search error ${res.status}: ${t.slice(0, 200)}`;
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "(no result)";
}

async function loadRolePreset(supabase: Supa, role: string) {
  const { data } = await supabase
    .from("hermes_role_presets")
    .select("*")
    .eq("role", role)
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as { system_prompt: string; default_model: string; name: string } | null;
}

async function recordStep(
  supabase: Supa,
  userId: string,
  taskId: string,
  agentId: string,
  step_type: string,
  content: any,
  tokens = 0,
  emit?: (e: EngineEvent) => void,
) {
  const { data, error } = await supabase
    .from("hermes_steps")
    .insert({ task_id: taskId, agent_id: agentId, user_id: userId, step_type, content, tokens_used: tokens })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  emit?.({
    type: "step",
    step: {
      id: data.id,
      agent_id: data.agent_id,
      step_type: data.step_type,
      content: data.content,
      created_at: data.created_at,
    },
  });
  return data;
}

async function isCancelled(supabase: Supa, taskId: string): Promise<boolean> {
  const { data } = await supabase.from("hermes_tasks").select("status").eq("id", taskId).maybeSingle();
  return data?.status === "cancelled";
}

export async function runHermesTask(opts: {
  supabase: Supa;
  userId: string;
  taskId: string;
  emit: (e: EngineEvent) => void;
}) {
  const { supabase, userId, taskId, emit } = opts;

  const { data: task, error: taskErr } = await supabase
    .from("hermes_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (taskErr) throw new Error(taskErr.message);
  if (!task) throw new Error("Task not found");

  try {
    // 1. PLANNER
    await supabase.from("hermes_tasks").update({ status: "planning" }).eq("id", taskId);
    emit({ type: "task_status", status: "planning" });

    const plannerPreset = await loadRolePreset(supabase, "planner");
    const plannerModel = plannerPreset?.default_model ?? task.model;
    const plannerPrompt = plannerPreset?.system_prompt ?? DEFAULT_PLANNER_PROMPT;

    const { data: plannerAgent, error: paErr } = await supabase
      .from("hermes_agents")
      .insert({
        task_id: taskId,
        user_id: userId,
        role: "planner",
        name: plannerPreset?.name ?? "Planner",
        model: plannerModel,
        system_prompt: plannerPrompt,
        objective: "Decompose the goal",
        status: "running",
      })
      .select("*")
      .single();
    if (paErr) throw new Error(paErr.message);
    emit({
      type: "agent_created",
      agent: { id: plannerAgent.id, role: "planner", name: plannerAgent.name, model: plannerModel, objective: plannerAgent.objective },
    });

    const plan = await chat(
      plannerModel,
      [
        { role: "system", content: plannerPrompt },
        { role: "user", content: `GOAL:\n${task.goal}\n\nReturn JSON only.` },
      ],
      { json: true },
    );
    await recordStep(supabase, userId, taskId, plannerAgent.id, "thought", { text: plan.content }, plan.tokens, emit);

    const parsed = tryParseJSON<{ subtasks: Array<{ title: string; objective: string }> }>(plan.content);
    const subtasks = (parsed?.subtasks ?? []).slice(0, task.max_agents).filter((s) => s.objective);
    if (subtasks.length === 0) {
      throw new Error("Planner produced no usable sub-tasks.");
    }
    await recordStep(supabase, userId, taskId, plannerAgent.id, "final", { subtasks }, 0, emit);
    await supabase.from("hermes_agents").update({ status: "completed", output: { subtasks } }).eq("id", plannerAgent.id);
    emit({ type: "agent_status", agentId: plannerAgent.id, status: "completed" });

    // 2. WORKERS
    await supabase.from("hermes_tasks").update({ status: "running" }).eq("id", taskId);
    emit({ type: "task_status", status: "running" });

    const workerPreset = await loadRolePreset(supabase, "worker");
    const workerModel = workerPreset?.default_model ?? task.model;
    const workerPrompt = workerPreset?.system_prompt ?? DEFAULT_WORKER_PROMPT;

    const runWorker = async (
      st: { title: string; objective: string },
      index: number,
    ): Promise<{ title: string; objective: string; answer: string }> => {
      if (await isCancelled(supabase, taskId)) {
        return { title: st.title, objective: st.objective, answer: "(cancelled)" };
      }
      const { data: w } = await supabase
        .from("hermes_agents")
        .insert({
          task_id: taskId,
          user_id: userId,
          role: "worker",
          name: st.title.slice(0, 80),
          model: workerModel,
          system_prompt: workerPrompt,
          objective: st.objective,
          status: "running",
        })
        .select("*")
        .single();
      emit({
        type: "agent_created",
        agent: { id: w.id, role: "worker", name: w.name, model: workerModel, objective: w.objective },
      });

      const history: Array<{ role: string; content: string }> = [
        { role: "system", content: workerPrompt },
        { role: "user", content: `GOAL: ${task.goal}\nYOUR SUB-OBJECTIVE: ${st.objective}\nRespond with JSON only.` },
      ];

      let answer: string | null = null;
      for (let iter = 0; iter < task.max_iterations; iter++) {
        if (await isCancelled(supabase, taskId)) {
          await supabase.from("hermes_agents").update({ status: "cancelled" }).eq("id", w.id);
          emit({ type: "agent_status", agentId: w.id, status: "cancelled" });
          break;
        }
        const turn = await chat(workerModel, history, { json: true });
        await recordStep(supabase, userId, taskId, w.id, "thought", { text: turn.content, iter, worker: index }, turn.tokens, emit);
        const j = tryParseJSON<{ thought?: string; tool?: string; args?: any }>(turn.content);
        if (!j || !j.tool) {
          await recordStep(supabase, userId, taskId, w.id, "error", { reason: "Worker returned non-JSON" }, 0, emit);
          break;
        }
        if (j.tool === "finish") {
          answer = String(j.args?.answer ?? "").trim();
          await recordStep(supabase, userId, taskId, w.id, "final", { answer }, 0, emit);
          break;
        }
        if (j.tool === "web_search") {
          const q = String(j.args?.query ?? "").slice(0, 400);
          await recordStep(supabase, userId, taskId, w.id, "tool_call", { tool: "web_search", query: q }, 0, emit);
          const result = await webSearch(q);
          await recordStep(supabase, userId, taskId, w.id, "tool_result", { tool: "web_search", result }, 0, emit);
          history.push({ role: "assistant", content: turn.content });
          history.push({ role: "user", content: `web_search result:\n${result}\n\nContinue. Respond with JSON only.` });
          await supabase.from("hermes_agents").update({ iteration_count: iter + 1 }).eq("id", w.id);
          emit({ type: "agent_status", agentId: w.id, status: "running", iteration_count: iter + 1 });
          continue;
        }
        await recordStep(supabase, userId, taskId, w.id, "error", { reason: `Unknown tool: ${j.tool}` }, 0, emit);
        break;
      }

      const finalAnswer = answer ?? "(no answer produced within iteration limit)";
      await supabase
        .from("hermes_agents")
        .update({ status: answer ? "completed" : "failed", output: { answer: finalAnswer } })
        .eq("id", w.id);
      emit({ type: "agent_status", agentId: w.id, status: answer ? "completed" : "failed" });
      return { title: st.title, objective: st.objective, answer: finalAnswer };
    };

    // Run workers in parallel — each streams its own progress concurrently via emit().
    const settled = await Promise.allSettled(subtasks.map((st, i) => runWorker(st, i)));
    const workerOutputs: Array<{ title: string; objective: string; answer: string }> = settled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : {
            title: subtasks[i].title,
            objective: subtasks[i].objective,
            answer: `(worker error: ${r.reason instanceof Error ? r.reason.message : String(r.reason)})`,
          },
    );

    if (await isCancelled(supabase, taskId)) {
      emit({ type: "task_failed", error: "Cancelled by user" });
      return;
    }

    // 3. CRITIC

    const criticPreset = await loadRolePreset(supabase, "critic");
    const criticModel = criticPreset?.default_model ?? task.model;
    const criticPrompt = criticPreset?.system_prompt ?? DEFAULT_CRITIC_PROMPT;

    const { data: critic } = await supabase
      .from("hermes_agents")
      .insert({
        task_id: taskId,
        user_id: userId,
        role: "critic",
        name: criticPreset?.name ?? "Critic",
        model: criticModel,
        system_prompt: criticPrompt,
        objective: "Consolidate worker outputs",
        status: "running",
      })
      .select("*")
      .single();
    emit({
      type: "agent_created",
      agent: { id: critic.id, role: "critic", name: critic.name, model: criticModel, objective: critic.objective },
    });

    const workerSummary = workerOutputs
      .map((w, i) => `### Worker ${i + 1}: ${w.title}\nObjective: ${w.objective}\nAnswer:\n${w.answer}`)
      .join("\n\n");
    const critique = await chat(criticModel, [
      { role: "system", content: criticPrompt },
      { role: "user", content: `ORIGINAL GOAL:\n${task.goal}\n\nWORKER OUTPUTS:\n${workerSummary}` },
    ]);
    await recordStep(supabase, userId, taskId, critic.id, "final", { report: critique.content }, critique.tokens, emit);
    await supabase
      .from("hermes_agents")
      .update({ status: "completed", output: { report: critique.content } })
      .eq("id", critic.id);
    emit({ type: "agent_status", agentId: critic.id, status: "completed" });

    const summary = critique.content.slice(0, 280).replace(/\s+/g, " ").trim();
    await supabase
      .from("hermes_tasks")
      .update({
        status: "completed",
        result_summary: summary,
        final_output: { report: critique.content, workers: workerOutputs },
      })
      .eq("id", taskId);
    emit({ type: "task_completed", summary, final_output: { report: critique.content, workers: workerOutputs } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("hermes_tasks").update({ status: "failed", error: message }).eq("id", taskId);
    emit({ type: "task_failed", error: message });
  } finally {
    emit({ type: "done" });
  }
}
