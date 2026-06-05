import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Users2, Plus, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hermes")({
  head: () => ({
    meta: [
      { title: "Hermes — Goal-Driven Agents" },
      { name: "description", content: "Spawn autonomous agents for any goal." },
    ],
  }),
  component: HermesLayout,
});

function HermesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
      active
        ? "bg-gradient-ember text-ember-foreground shadow-ember"
        : "text-muted-foreground hover:text-foreground"
    }`;
  const tasksActive = pathname === "/hermes";
  const settingsActive = pathname.startsWith("/hermes/settings");
  return (
    <main className="min-h-screen bg-background text-foreground pt-24">
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-end gap-4 flex-wrap">
          <nav className="flex items-center gap-1.5">
            <Link to="/hermes" className={tabClass(tasksActive)}>
              <Users2 className="h-3.5 w-3.5" /> Agents
            </Link>
            <Link to="/hermes/settings" className={tabClass(settingsActive)}>
              <SettingsIcon className="h-3.5 w-3.5" /> Settings
            </Link>
            <Link
              to="/hermes/new"
              className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-4 py-1.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
            >
              <Plus className="h-3.5 w-3.5" /> New task
            </Link>
          </nav>
        </div>
      </div>
      <Outlet />
    </main>
  );
}
