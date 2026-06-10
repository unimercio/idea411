import { createFileRoute } from "@tanstack/react-router";
import { OSShell } from "@/components/os/OSShell";
import { ComingSoon } from "@/components/os/ComingSoon";
import { Workflow } from "lucide-react";

export const Route = createFileRoute("/_authenticated/workflows")({
  head: () => ({ meta: [{ title: "Workflows — Seven Day Ventures" }] }),
  component: WorkflowsPage,
});

function WorkflowsPage() {
  return (
    <OSShell
      eyebrow="Workflows"
      title="Workflow Launcher"
      description="One-click runs of Langflow pipelines. Real-time status for Langflow, LiteLLM, and Ollama once connected."
    >
      <ComingSoon
        icon={Workflow}
        title="Venture Incubator v3 launcher"
        body="Provide your Langflow + LiteLLM + Ollama endpoints and this becomes a live launcher with flow descriptions and stack health."
      />
    </OSShell>
  );
}
