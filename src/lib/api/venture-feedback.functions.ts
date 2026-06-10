import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ventureFeedbackTypes = ["general", "risk", "opportunity", "next_step"] as const;
export type VentureFeedbackType = (typeof ventureFeedbackTypes)[number];

const listSchema = z.object({ projectId: z.string().uuid() });

export interface VentureFeedbackItem {
  id: string;
  project_id: string;
  user_id: string;
  parent_id: string | null;
  type: VentureFeedbackType;
  body: string;
  created_at: string;
  updated_at: string;
  author_email: string | null;
}

export const listVentureFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }): Promise<VentureFeedbackItem[]> => {
    const { data: rows, error } = await context.supabase
      .from("venture_feedback")
      .select("id, project_id, user_id, parent_id, type, body, created_at, updated_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    // Profile names (no email column on profiles in this project)
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id, first_name")
        .in("user_id", userIds);
      if (profs) {
        for (const p of profs) names.set(p.user_id, p.first_name ?? "");
      }
    }
    return (rows ?? []).map((r) => ({
      ...r,
      type: r.type as VentureFeedbackType,
      author_email: names.get(r.user_id) || null,
    }));
  });

const createSchema = z.object({
  projectId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  type: z.enum(ventureFeedbackTypes).default("general"),
  parentId: z.string().uuid().nullable().optional(),
});

export const createVentureFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("venture_feedback")
      .insert({
        project_id: data.projectId,
        user_id: context.userId,
        parent_id: data.parentId ?? null,
        type: data.type,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteVentureFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("venture_feedback").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const countSchema = z.object({ projectIds: z.array(z.string().uuid()).max(200) });

export const countVentureFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => countSchema.parse(d))
  .handler(async ({ data, context }): Promise<Record<string, number>> => {
    if (!data.projectIds.length) return {};
    const { data: rows, error } = await context.supabase
      .from("venture_feedback")
      .select("project_id")
      .in("project_id", data.projectIds);
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const r of rows ?? []) counts[r.project_id] = (counts[r.project_id] ?? 0) + 1;
    return counts;
  });

export const listMyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, title, idea, status, created_at, updated_at, data")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
