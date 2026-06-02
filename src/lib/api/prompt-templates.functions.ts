import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CATEGORIES = ["strategic", "compliance", "market", "sales"] as const;
export type PromptCategory = (typeof CATEGORIES)[number];

// Known variables surfaced in the admin UI as hints. Templates may use any of
// these as {placeholder} tokens and declare them in `requires` so they are only
// shown when the underlying analysis actually has that field.
export const KNOWN_VARIABLES = [
  "overallScore",
  "weakestPillar",
  "topRisk",
  "regulation",
  "ipConcern",
  "competitor",
  "indirectCompetitor",
  "upTrend",
  "downTrend",
  "differentiator",
  "barrier",
  "targetCustomer",
  "recommendedPrice",
  "topGtm",
] as const;
export type TemplateVarKey = (typeof KNOWN_VARIABLES)[number];

export const promptTemplateSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(64),
  category: z.enum(CATEGORIES),
  template: z.string().min(3).max(500),
  requires: z.array(z.string()).default([]),
  enabled: z.boolean(),
  sort_order: z.number().int(),
  updated_at: z.string(),
});
export type PromptTemplate = z.infer<typeof promptTemplateSchema>;

export const listPromptTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("id, slug, category, template, requires, enabled, sort_order, updated_at")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("listPromptTemplates", error);
      throw new Error(error.message);
    }
    return { templates: (data ?? []) as PromptTemplate[] };
  });

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
  category: z.enum(CATEGORIES),
  template: z.string().min(3).max(500),
  requires: z.array(z.string().min(1).max(64)).max(10),
  enabled: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
});

export const upsertPromptTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(upsertInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admin check via has_role
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    // Validate that every {var} in the template is declared in `requires`
    // (or is a no-arg literal). This protects users from broken placeholders.
    const used = Array.from(data.template.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
    const undeclared = used.filter((v) => !data.requires.includes(v));
    if (undeclared.length > 0) {
      throw new Error(
        `Template uses {${undeclared.join("}, {")}} but did not declare them in "requires".`,
      );
    }

    if (data.id) {
      const { error } = await supabase
        .from("prompt_templates")
        .update({
          slug: data.slug,
          category: data.category,
          template: data.template,
          requires: data.requires,
          enabled: data.enabled,
          sort_order: data.sort_order,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await supabase
      .from("prompt_templates")
      .insert({
        slug: data.slug,
        category: data.category,
        template: data.template,
        requires: data.requires,
        enabled: data.enabled,
        sort_order: data.sort_order,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deletePromptTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin role required");
    const { error } = await supabase.from("prompt_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: Boolean(data) };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("claim_first_admin");
    if (error) throw new Error(error.message);
    return { claimed: Boolean(data) };
  });
