import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateSchema = z.object({
  first_name: z.string().trim().max(100).nullable().optional(),
  title: z.string().trim().max(150).nullable().optional(),
  company: z.string().trim().max(150).nullable().optional(),
  website: z
    .string()
    .trim()
    .max(255)
    .url({ message: "Website must be a valid URL" })
    .nullable()
    .optional()
    .or(z.literal("")),
  avatar_url: z.string().trim().max(500).nullable().optional(),
});

export const getMySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name, title, company, website, avatar_url, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      first_name: data?.first_name ?? "",
      title: data?.title ?? "",
      company: data?.company ?? "",
      website: data?.website ?? "",
      avatar_url: data?.avatar_url ?? "",
      updated_at: data?.updated_at ?? null,
    };
  });

export const updateMySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clean = (v: string | null | undefined) =>
      v && v.length ? v : null;
    const payload = {
      user_id: userId,
      first_name: clean(data.first_name),
      title: clean(data.title),
      company: clean(data.company),
      website: clean(data.website),
      avatar_url: clean(data.avatar_url),
    };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
