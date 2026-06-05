import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type HermesTaskStatus = "queued" | "planning" | "running" | "completed" | "failed" | "cancelled";
export type HermesAgentRole = "planner" | "worker" | "critic" | "custom";
export type HermesAgentStatus = "idle" | "running" | "completed" | "failed" | "cancelled";
export type HermesStepType = "thought" | "tool_call" | "tool_result" | "final" | "error";

export type HermesTask = {
  id: string;
  user_id: string;
  goal: string;
  status: HermesTaskStatus;
  model: string;
  max_agents: number;
  max_iterations: number;
  result_summary: string | null;
  final_output: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type HermesAgent = {
  id: string;
  task_id: string;
  role: HermesAgentRole;
  name: string;
  model: string;
  system_prompt: string;
  objective: string | null;
  status: HermesAgentStatus;
  iteration_count: number;
  output: unknown;
  created_at: string;
  updated_at: string;
};

export type HermesStep = {
  id: string;
  agent_id: string;
  task_id: string;
  step_type: HermesStepType;
  content: Record<string, unknown>;
  tokens_used: number;
  created_at: string;
};

export type HermesSettings = {
  user_id: string;
  default_model: string;
  max_agents: number;
  max_iterations: number;
  allowed_tools: string[];
};

export type HermesRolePreset = {
  id: string;
  role: HermesAgentRole;
  name: string;
  system_prompt: string;
  default_model: string;
  enabled: boolean;
  sort_order: number;
};

// --- TASKS ---

export const createHermesTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        goal: z.string().trim().min(8).max(4000),
        model: z.string().min(1).max(200),
        maxAgents: z.number().int().min(1).max(8).optional(),
        maxIterations: z.number().int().min(1).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row, error } = await supabase
      .from("hermes_tasks")
      .insert({
        user_id: userId,
        goal: data.goal,
        model: data.model,
        max_agents: data.maxAgents ?? 3,
        max_iterations: data.maxIterations ?? 8,
        status: "queued",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as HermesTask;
  });

export const listHermesTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("hermes_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as HermesTask[];
  });

export const getHermesTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: task, error } = await supabase
      .from("hermes_tasks")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("Task not found");
    const { data: agents } = await supabase
      .from("hermes_agents")
      .select("*")
      .eq("task_id", data.id)
      .order("created_at", { ascending: true });
    const { data: steps } = await supabase
      .from("hermes_steps")
      .select("*")
      .eq("task_id", data.id)
      .order("created_at", { ascending: true })
      .limit(500);
    return {
      task: task as HermesTask,
      agents: (agents ?? []) as HermesAgent[],
      steps: (steps ?? []) as HermesStep[],
    };
  });

export const cancelHermesTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase
      .from("hermes_tasks")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase
      .from("hermes_agents")
      .update({ status: "cancelled" })
      .eq("task_id", data.id)
      .in("status", ["idle", "running"]);
    return { ok: true };
  });

export const deleteHermesTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase.from("hermes_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- AGENTS ---

export const listAllHermesAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("hermes_agents")
      .select("*, hermes_tasks!inner(goal,status)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<HermesAgent & { hermes_tasks: { goal: string; status: HermesTaskStatus } }>;
  });

// --- SETTINGS ---

export const getHermesSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data, error } = await supabase
      .from("hermes_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as HermesSettings | null;
  });

export const upsertHermesSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        default_model: z.string().min(1).max(200),
        max_agents: z.number().int().min(1).max(8),
        max_iterations: z.number().int().min(1).max(20),
        allowed_tools: z.array(z.string().min(1).max(64)).max(16),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("hermes_settings")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- ROLE PRESETS (admin) ---

export const listHermesRolePresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("hermes_role_presets")
      .select("*")
      .order("role", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as HermesRolePreset[];
  });

export const upsertHermesRolePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        role: z.enum(["planner", "worker", "critic", "custom"]),
        name: z.string().min(1).max(120),
        system_prompt: z.string().min(1).max(8000),
        default_model: z.string().min(1).max(200),
        enabled: z.boolean(),
        sort_order: z.number().int().min(0).max(9999),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");
    const payload = { ...data, created_by: userId };
    const { error } = await supabase.from("hermes_role_presets").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHermesRolePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin role required");
    const { error } = await supabase.from("hermes_role_presets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
