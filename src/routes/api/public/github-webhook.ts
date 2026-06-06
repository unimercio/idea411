import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// GitHub → app sync. Mirrors issues onto feedback_items:
// - Matches by github_issue_number or the "Feedback ID: <uuid>" body marker.
// - If no match, creates a new feedback row, deriving type from labels.
// - Closed -> status 'done'; reopened -> 'open'.
type FeedbackType = "wish" | "bug" | "issue";

const LABEL_TO_TYPE: Record<string, FeedbackType> = {
  wish: "wish",
  bug: "bug",
  "must-have": "issue",
  musthave: "issue",
  issue: "issue",
};

// Stable system user id for issues that originate in GitHub (not tied to an app user).
// Using all-zero UUID keeps RLS safe (no auth.uid() match) while staying queryable.
const GITHUB_SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

function typeFromLabels(labels: Array<{ name?: string }> | undefined): FeedbackType {
  if (!labels) return "issue";
  for (const l of labels) {
    const k = (l.name ?? "").trim().toLowerCase();
    if (k in LABEL_TO_TYPE) return LABEL_TO_TYPE[k];
  }
  return "issue";
}

export const Route = createFileRoute("/api/public/github-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        const sigHeader = request.headers.get("x-hub-signature-256") ?? "";
        const event = request.headers.get("x-github-event") ?? "";
        const raw = await request.text();

        if (secret) {
          const expected =
            "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
          const a = Buffer.from(sigHeader);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("invalid signature", { status: 401 });
          }
        }

        if (event === "ping") return new Response("pong");
        if (event !== "issues") return new Response("ignored");

        let payload: {
          action?: string;
          issue?: {
            number?: number;
            html_url?: string;
            state?: string;
            title?: string;
            body?: string | null;
            labels?: Array<{ name?: string }>;
          };
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const issue = payload.issue;
        if (!issue || !issue.number) return new Response("no issue");

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Find target row: prefer github_issue_number; fall back to Feedback ID marker.
        let targetId: string | null = null;
        const { data: byNumber } = await supabaseAdmin
          .from("feedback_items")
          .select("id")
          .eq("github_issue_number", issue.number)
          .maybeSingle();
        if (byNumber?.id) targetId = byNumber.id;

        if (!targetId && issue.body) {
          const m = issue.body.match(/Feedback ID:\s*`([0-9a-f-]{36})`/i);
          if (m) {
            const { data: byMarker } = await supabaseAdmin
              .from("feedback_items")
              .select("id")
              .eq("id", m[1])
              .maybeSingle();
            if (byMarker?.id) targetId = byMarker.id;
          }
        }

        const derivedType = typeFromLabels(issue.labels);
        const derivedStatus: "open" | "done" =
          issue.state === "closed" ? "done" : "open";

        // No matching row — create one from the GitHub issue.
        if (!targetId) {
          if (payload.action === "deleted") return new Response("ignored");
          const { error: insErr } = await supabaseAdmin
            .from("feedback_items")
            .insert({
              user_id: GITHUB_SYSTEM_USER,
              type: derivedType,
              title: (issue.title ?? "Untitled").slice(0, 140),
              description: (issue.body ?? "").slice(0, 4000),
              status: derivedStatus,
              github_issue_number: issue.number,
              github_issue_url: issue.html_url ?? null,
              github_state: issue.state ?? null,
            });
          if (insErr) {
            console.error("[gh-webhook] insert failed", insErr);
            return new Response("insert failed", { status: 500 });
          }
          return new Response("created");
        }

        // Existing row — patch metadata, type (from labels), and status.
        const patch: {
          github_issue_number: number;
          github_issue_url: string | null;
          github_state: string | null;
          type: FeedbackType;
          status?: "open" | "done";
        } = {
          github_issue_number: issue.number,
          github_issue_url: issue.html_url ?? null,
          github_state: issue.state ?? null,
          type: derivedType,
        };
        if (issue.state === "closed") patch.status = "done";
        if (issue.state === "open" && payload.action === "reopened")
          patch.status = "open";

        const { error } = await supabaseAdmin
          .from("feedback_items")
          .update(patch)
          .eq("id", targetId);
        if (error) {
          console.error("[gh-webhook] update failed", error);
          return new Response("update failed", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
