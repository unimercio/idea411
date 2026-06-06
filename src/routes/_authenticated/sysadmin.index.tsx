import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Settings, Sparkles, Users, Activity, LayoutDashboard, Crown, Shield } from "lucide-react";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { NotAuthorized } from "@/components/site/NotAuthorized";
import { HeaderBrand } from "@/components/site/HeaderBrand";

export const Route = createFileRoute("/_authenticated/sysadmin/")({
  head: () => ({
    meta: [
      { title: "Sysadmin Dashboard — IdeaForge" },
      { name: "description", content: "Sysadmin tools and overview." },
    ],
  }),
  component: SysadminDashboardPage,
});

function SysadminDashboardPage() {
  const checkAdminFn = useServerFn(checkAdmin);
  const adminQ = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });

  if (adminQ.isLoading) {
    return (
      <div className="grid h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!adminQ.data?.isSysadmin) return <NotAuthorized area="the sysadmin dashboard" />;

  const tiles = [
    { to: "/admin/users", icon: Crown, label: "Manage Admins", desc: "Grant or revoke admin & sysadmin" },
    { to: "/admin/users", icon: Users, label: "All Users", desc: "Full user management" },
    { to: "/admin/audit-log", icon: Activity, label: "Audit Log", desc: "Full activity history" },
    { to: "/admin/prompt-templates", icon: Settings, label: "Prompt Templates", desc: "Manage AI prompts" },
    { to: "/admin/skills", icon: Sparkles, label: "Skills", desc: "Configure skills" },
    { to: "/admin", icon: Shield, label: "Admin Dashboard", desc: "Standard admin view" },
    { to: "/dashboard", icon: LayoutDashboard, label: "My Projects", desc: "Your personal dashboard" },
  ] as const;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <HeaderBrand to="/sysadmin" />
          <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-ember">
            <Crown className="h-3.5 w-3.5" /> Sysadmin
          </span>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-ember">Super User</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold">Sysadmin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Full control over admins, users, and system configuration.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tiles.map((t, i) => (
            <Link
              key={`${t.to}-${i}`}
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
