import { createFileRoute } from "@tanstack/react-router";
import { OSShell } from "@/components/os/OSShell";
import { ComingSoon } from "@/components/os/ComingSoon";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/system")({
  head: () => ({ meta: [{ title: "System Status — Seven Day Ventures" }] }),
  component: SystemPage,
});

function SystemPage() {
  return (
    <OSShell
      eyebrow="Infrastructure"
      title="System Status"
      description="Live health for Langflow, LiteLLM, Ollama, Hermes Gateway, and the model router (Grok-4.3 ↔ Ollama)."
    >
      <ComingSoon
        icon={Activity}
        title="Status board pending endpoints"
        body="Hook up the health endpoints for each subsystem and the board lights up with latency, uptime, and routing decisions in real time."
      />
    </OSShell>
  );
}
