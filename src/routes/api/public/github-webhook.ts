import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// GitHub → app sync. Mirrors issue state changes onto feedback_items.status
// when the issue body carries the "Feedback ID: `<uuid>`" marker we wrote
// when first creating the issue from the app.
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
            body?: string | null;
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
          const m = issue.body.match(
            /Feedback ID:\s*`([0-9a-f-]{36})`/i,
          );
          if (m) targetId = m[1];
        }

        if (!targetId) return new Response("no match");

        const patch: {
          github_issue_number: number;
          github_issue_url: string | null;
          github_state: string | null;
          status?: "open" | "done";
        } = {
          github_issue_number: issue.number,
          github_issue_url: issue.html_url ?? null,
          github_state: issue.state ?? null,
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
