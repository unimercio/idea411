import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SKILL_COMPONENTS, type SkillComponent } from "./skills.shared";

export const skillSchema = z.object({
  id: z.string().uuid(),
  component: z.enum(SKILL_COMPONENTS),
  name: z.string(),
  model: z.string(),
  system_preamble: z.string(),
  enabled: z.boolean(),
  is_default: z.boolean(),
  sort_order: z.number().int(),
  updated_at: z.string(),
});
export type ModelSkill = z.infer<typeof skillSchema>;

export const listSkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("model_skills")
      .select("id, component, name, model, system_preamble, enabled, is_default, sort_order, updated_at")
      .order("component", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { skills: (data ?? []) as ModelSkill[] };
  });

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  component: z.enum(SKILL_COMPONENTS),
  name: z.string().min(1).max(120),
  model: z.string().min(1).max(120),
  system_preamble: z.string().max(8000).default(""),
  enabled: z.boolean(),
  is_default: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const upsertSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(upsertInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Enforce one default per component: if this row is being marked default,
    // unset others first.
    if (data.is_default) {
      const query = supabase
        .from("model_skills")
        .update({ is_default: false })
        .eq("component", data.component);
      if (data.id) query.neq("id", data.id);
      const { error: clearErr } = await query;
      if (clearErr) throw new Error(clearErr.message);
    }

    if (data.id) {
      const { error } = await supabase
        .from("model_skills")
        .update({
          component: data.component,
          name: data.name,
          model: data.model,
          system_preamble: data.system_preamble,
          enabled: data.enabled,
          is_default: data.is_default,
          sort_order: data.sort_order,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await supabase
      .from("model_skills")
      .insert({
        component: data.component,
        name: data.name,
        model: data.model,
        system_preamble: data.system_preamble,
        enabled: data.enabled,
        is_default: data.is_default,
        sort_order: data.sort_order,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("model_skills").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), component: z.enum(SKILL_COMPONENTS) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error: clearErr } = await supabase
      .from("model_skills")
      .update({ is_default: false })
      .eq("component", data.component)
      .neq("id", data.id);
    if (clearErr) throw new Error(clearErr.message);
    const { error } = await supabase
      .from("model_skills")
      .update({ is_default: true, enabled: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Expose SkillComponent for consumers that import this file.
export type { SkillComponent };
