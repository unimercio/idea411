import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GH_REPO = "unimercio/idea411";

const TYPE_LABEL: Record<string, string> = {
  wish: "wish",
  bug: "bug",
  issue: "must-have",
};

const InputSchema = z.object({
  type: z.enum(["wish", "bug", "issue"]),
  title: z.string().trim().min(3).max(140),
  description: z.string().max(4000).default(""),
});

export const createFeedbackWithGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Insert feedback row first (RLS scoped to user).
    const { data: row, error } = await supabase
      .from("feedback_items")
      .insert({
        user_id: userId,
        type: data.type,
        title: data.title,
        description: data.description,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // 2) Best-effort GitHub mirror.
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { item: row, github: null as null | { number: number; url: string } };
    }

    try {
      const body = [
        data.description?.trim() || "_No description._",
        "",
        "---",
        `Submitted from IdeaForge feedback page.`,
        `Feedback ID: \`${row.id}\``,
      ].join("\n");

      const res = await fetch(`https://api.github.com/repos/${GH_REPO}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "idea411-app",
        },
        body: JSON.stringify({
          title: `[${TYPE_LABEL[data.type]}] ${data.title}`,
          body,
          labels: [TYPE_LABEL[data.type], "from-app"],
        }),
      });

      if (!res.ok) {
        console.error("[github] create issue failed", res.status, await res.text());
        return { item: row, github: null };
      }

      const issue = (await res.json()) as {
        number: number;
        html_url: string;
        state: string;
      };

      const { data: updated } = await supabase
        .from("feedback_items")
        .update({
          github_issue_number: issue.number,
          github_issue_url: issue.html_url,
          github_state: issue.state,
        })
        .eq("id", row.id)
        .select("*")
        .single();

      return {
        item: updated ?? row,
        github: { number: issue.number, url: issue.html_url },
      };
    } catch (e) {
      console.error("[github] sync error", e);
      return { item: row, github: null };
    }
  });
