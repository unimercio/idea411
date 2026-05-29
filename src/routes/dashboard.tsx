import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — IdeaForge" },
      { name: "description", content: "Manage your IdeaForge projects, drafts, and launches." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
          >
            <Plus className="h-4 w-4" /> New idea
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="font-display text-4xl font-semibold">Your forge</h1>
        <p className="mt-2 text-muted-foreground">A home for every idea you're shaping.</p>
        <div className="mt-10 grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-24 text-center">
          <p className="text-sm text-muted-foreground max-w-md">
            You haven't started a project yet. Drop your first idea to see vetting, renders, and a launch
            plan appear here.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
          >
            Start a project
          </Link>
        </div>
      </section>
    </main>
  );
}
