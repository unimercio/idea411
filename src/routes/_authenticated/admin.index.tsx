import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Flame, Settings, Sparkles, Users, Activity, LayoutDashboard } from "lucide-react";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { NotAuthorized } from "@/components/site/NotAuthorized";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — IdeaForge" },
      { name: "description", content: "Admin tools and overview." },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const checkAdminFn = useServerFn(checkAdmin);
  const adminQ = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });

  if (adminQ.isLoading) {
    return (
      <div className="grid h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!adminQ.data?.isAdmin) return <NotAuthorized area="the admin dashboard" />;

  const tiles = [
    { to: "/admin/prompt-templates", icon: Settings, label: "Prompt Templates", desc: "Manage AI prompts" },
    { to: "/admin/skills", icon: Sparkles, label: "Skills", desc: "Configure skills" },
    { to: "/admin/users", icon: Users, label: "Users", desc: "Manage users & roles" },
    { to: "/admin/audit-log", icon: Activity, label: "Audit Log", desc: "Review admin activity" },
    { to: "/dashboard", icon: LayoutDashboard, label: "My Projects", desc: "Your personal dashboard" },
  ] as const;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-ember">Admin</span>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-ember">Control Center</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold">Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Manage prompts, skills, users, and review activity.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tiles.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-3xl border border-border bg-card/80 p-6 shadow-elegant hover:border-ember/40 transition"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-background/80 text-ember">
                <t.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{t.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
