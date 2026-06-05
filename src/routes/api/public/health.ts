import { createFileRoute } from "@tanstack/react-router";

// Public, unauthenticated health endpoint used by post-deploy smoke checks
// (GitHub Actions workflow) and the live deploy console.
// Intentionally returns no PII and no secret-bearing config.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const body = {
          ok: true,
          service: "idea411",
          time: new Date().toISOString(),
          uptimeSeconds: Math.round(
            typeof process !== "undefined" && typeof process.uptime === "function"
              ? process.uptime()
              : 0,
          ),
          commit:
            process.env.GIT_COMMIT ||
            process.env.VERCEL_GIT_COMMIT_SHA ||
            process.env.SOURCE_COMMIT ||
            null,
          node: typeof process !== "undefined" ? process.version : null,
        };
        return Response.json(body, {
          headers: {
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
