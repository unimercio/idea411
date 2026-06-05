import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { runHermesTask, type EngineEvent } from "@/lib/api/hermes-engine.server";

// SSE endpoint that streams the agent loop for a given task.
// Auth: Authorization: Bearer <supabase access_token>.
// Body: { taskId: string }.
export const Route = createFileRoute("/api/hermes-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return new Response("Supabase not configured", { status: 500 });

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7);

        let body: { taskId?: string };
        try {
          body = (await request.json()) as { taskId?: string };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const taskId = body.taskId;
        if (!taskId || typeof taskId !== "string") return new Response("Missing taskId", { status: 400 });

        const supabase = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claimsData.claims.sub as string;

        const { data: task } = await supabase.from("hermes_tasks").select("id,user_id").eq("id", taskId).maybeSingle();
        if (!task) return new Response("Task not found", { status: 404 });
        if (task.user_id !== userId) return new Response("Forbidden", { status: 403 });

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const emit = (e: EngineEvent) => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
              } catch {
                // stream already closed
              }
            };
            try {
              await runHermesTask({ supabase, userId, taskId, emit });
            } catch (err) {
              emit({ type: "task_failed", error: err instanceof Error ? err.message : String(err) });
            } finally {
              try { controller.close(); } catch { /* noop */ }
            }
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
