import { createFileRoute } from "@tanstack/react-router";
import {
  FOCUS_GROUP_GATEWAY,
  FOCUS_GROUP_MODEL,
  FOCUS_GROUP_SYSTEM,
  buildFocusGroupUserPrompt,
  focusGroupInputSchema,
} from "@/lib/api/focus-group.functions";

export const Route = createFileRoute("/api/focus-group-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey)
          return new Response("LOVABLE_API_KEY missing", { status: 500 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = focusGroupInputSchema.safeParse(body);
        if (!parsed.success)
          return new Response("Invalid input", { status: 400 });

        const upstream = await fetch(FOCUS_GROUP_GATEWAY, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: FOCUS_GROUP_MODEL,
            stream: true,
            messages: [
              { role: "system", content: FOCUS_GROUP_SYSTEM },
              { role: "user", content: buildFocusGroupUserPrompt(parsed.data) },
            ],
          }),
        });

        if (upstream.status === 429)
          return new Response("Rate limited. Try again shortly.", { status: 429 });
        if (upstream.status === 402)
          return new Response("AI credits exhausted.", { status: 402 });
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          console.error("Focus group upstream error:", upstream.status, text);
          return new Response(`AI gateway error (${upstream.status})`, {
            status: 502,
          });
        }

        // Transform SSE chunks into plain text deltas.
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = upstream.body.getReader();

        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const raw of lines) {
                  const line = raw.trim();
                  if (!line.startsWith("data:")) continue;
                  const payload = line.slice(5).trim();
                  if (!payload || payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload) as {
                      choices?: { delta?: { content?: string } }[];
                    };
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    // ignore malformed chunk
                  }
                }
              }
              controller.close();
            } catch (err) {
              console.error("Focus group stream error:", err);
              controller.error(err);
            }
          },
          cancel() {
            reader.cancel().catch(() => {});
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
