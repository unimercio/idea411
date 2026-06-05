import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Flame, Bot, ListTodo, Plus, Settings as SettingsIcon, Users2 } from "lucide-react";

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
  const tab = (to: string, label: string, Icon: any) => {
    const active = pathname === to || (to !== "/hermes" && pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
          active
            ? "bg-gradient-ember text-ember-foreground shadow-ember"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" /> {label}
      </Link>
    );
  };
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Bot className="h-3 w-3" /> Hermes
            </span>
          </Link>
          <nav className="flex items-center gap-1.5">
            {tab("/hermes", "Tasks", ListTodo)}
            {tab("/hermes/agents", "Agents", Users2)}
            {tab("/hermes/settings", "Settings", SettingsIcon)}
            <Link
              to="/hermes/new"
              className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-4 py-1.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
            >
              <Plus className="h-3.5 w-3.5" /> New task
            </Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </main>
  );
}
