import { createFileRoute } from "@tanstack/react-router";
import { OSShell } from "@/components/os/OSShell";
import { ComingSoon } from "@/components/os/ComingSoon";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — Seven Day Ventures" }] }),
  component: PortfolioPage,
});

function PortfolioPage() {
  return (
    <OSShell
      eyebrow="Portfolio"
      title="Active Ventures"
      description="Kanban and table views of every venture in the incubator, scored and stage-tracked."
    >
      <ComingSoon
        icon={Briefcase}
        title="Portfolio board coming next"
        body="Status, score, stage, KPIs, and click-through to full venture details. Drag between stages of the Seven Day pipeline."
      />
    </OSShell>
  );
}
