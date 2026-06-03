import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SkillComponent } from "./skills.shared";

export type ResolvedSkill = {
  id: string;
  name: string;
  model: string;
  preamble: string;
} | null;

/**
 * Loads the default enabled skill for a component. Used by AI server
 * functions to steer model selection and system-prompt context.
 * Uses the admin client so unauthenticated server fns (landing intake,
 * etc.) can still resolve a skill.
 */
export async function resolveSkill(component: SkillComponent): Promise<ResolvedSkill> {
  const { data, error } = await supabaseAdmin
    .from("model_skills")
    .select("id, name, model, system_preamble")
    .eq("component", component)
    .eq("enabled", true)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    console.warn(`resolveSkill(${component}) failed:`, error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    model: data.model,
    preamble: data.system_preamble ?? "",
  };
}

/** Prepend a skill's preamble to a base system prompt. */
export function withSkillPreamble(baseSystemPrompt: string, skill: ResolvedSkill): string {
  if (!skill || !skill.preamble.trim()) return baseSystemPrompt;
  return `${skill.preamble.trim()}\n\n---\n\n${baseSystemPrompt}`;
}
