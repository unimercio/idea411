import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Loader2,
  Settings,
  Sparkles,
  Users,
  Activity,
  LayoutDashboard,
  UserPlus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Search,
  Plus,
  FileText,
  Trophy,
  MessageSquare,
  Coins,
} from "lucide-react";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { getAdminStats } from "@/lib/api/admin-stats.functions";
import { NotAuthorized } from "@/components/site/NotAuthorized";
import { HeaderBrand } from "@/components/site/HeaderBrand";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — IdeaForge" },
      { name: "description", content: "Admin tools and overview." },
    ],
  }),
  component: AdminDashboardPage,
});

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function AdminDashboardPage() {
  const checkAdminFn = useServerFn(checkAdmin);
  const adminQ = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });
  const statsFn = useServerFn(getAdminStats);
  const statsQ = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => statsFn(),
    enabled: adminQ.data?.isAdmin === true,
    refetchInterval: 60_000,
  });

  const [query, setQuery] = useState("");

  if (adminQ.isLoading) {
    return (
      <div className="grid h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!adminQ.data?.isAdmin) return <NotAuthorized area="the admin dashboard" />;

  const s = statsQ.data;
  const isSysadmin = s?.isSysadmin ?? false;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <HeaderBrand to="/admin" />
          <span className="text-xs uppercase tracking-[0.2em] text-ember">
            {isSysadmin ? "Sysadmin" : "Admin"}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10 space-y-10">
        {/* 10. Sysadmin banner */}
        {isSysadmin && (
          <div className="flex items-center gap-3 rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm">
            <ShieldCheck className="h-4 w-4 text-ember" />
            <span className="text-foreground font-medium">Sysadmin tier active</span>
            <span className="text-muted-foreground">
              · You can grant/revoke admin & sysadmin roles and see cross-user data.
            </span>
          </div>
        )}

        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ember">Control Center</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-muted-foreground">
              Live system overview, activity, and quick admin actions.
            </p>
          </div>
          {/* 9. Search bar */}
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users, templates, skills…"
              className="pl-9"
            />
            {query.trim() && <SearchResults query={query.trim()} />}
          </div>
        </div>

        {/* 8. Quick actions */}
        <QuickActions />

        {/* 1. KPI cards */}
        <Kpis stats={s} loading={statsQ.isLoading} />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 2. Recent activity feed */}
          <div className="lg:col-span-2 space-y-6">
            <Panel title="Recent activity" icon={Activity} href="/admin/audit-log" hrefLabel="Audit log">
              <ActivityFeed entries={s?.recentActivity ?? []} loading={statsQ.isLoading} />
            </Panel>

            {/* 6. Usage chart */}
            <Panel title="Usage — last 30 days" icon={TrendingUp}>
              <UsageChart data={s?.usage ?? []} />
            </Panel>

            {/* 5. Top ideas (sysadmin) */}
            {isSysadmin && (
              <Panel title="Top ideas across all users" icon={Trophy}>
                <TopIdeas items={s?.topIdeas ?? []} loading={statsQ.isLoading} />
              </Panel>
            )}
          </div>

          <div className="space-y-6">
            {/* 4. System health */}
            <Panel title="System health" icon={ShieldCheck}>
              <Health stats={s} />
            </Panel>

            {/* 3. Recent signups */}
            <Panel title="Recent signups" icon={UserPlus} href="/admin/users" hrefLabel="All users">
              <Signups items={s?.recentSignups ?? []} loading={statsQ.isLoading} />
            </Panel>

            {/* 7. Templates & skills summary */}
            <Panel title="Templates & skills" icon={FileText}>
              <TemplateSummary stats={s} />
            </Panel>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ===== Sections ===== */

function Kpis({ stats, loading }: { stats?: any; loading: boolean }) {
  const items = [
    {
      label: "Total users",
      value: stats?.users.total ?? "—",
      sub: `${stats?.users.newThisWeek ?? 0} new this week`,
    },
    {
      label: "Total projects",
      value: stats?.projects.total ?? "—",
      sub: `${stats?.projects.ready ?? 0} ready · ${stats?.projects.vetting ?? 0} vetting`,
    },
    {
      label: "Admins",
      value: stats?.users.admins ?? "—",
      sub: `${stats?.users.sysadmins ?? 0} sysadmin${(stats?.users.sysadmins ?? 0) === 1 ? "" : "s"}`,
    },
    {
      label: "Templates",
      value: stats ? `${stats.templates.enabled}/${stats.templates.total}` : "—",
      sub: stats?.templates.lastEditedAt
        ? `Edited ${timeAgo(stats.templates.lastEditedAt)}`
        : "No edits yet",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-2xl border border-border bg-card/80 p-5 shadow-elegant"
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {it.label}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {loading ? <span className="text-muted-foreground">…</span> : it.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{it.sub}</p>
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  icon: any;
  href?: string;
  hrefLabel?: string;
  children: import("react").ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card/60 p-5">
      <header className="flex items-center justify-between mb-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-ember" /> {title}
        </h2>
        {href && (
          <Link to={href} className="text-xs text-muted-foreground hover:text-foreground">
            {hrefLabel ?? "View all →"}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function ActivityFeed({ entries, loading }: { entries: any[]; loading: boolean }) {
  if (loading) return <Skeleton lines={5} />;
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">No recent activity.</p>;
  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="font-medium truncate">{e.action}</div>
            <div className="text-xs text-muted-foreground truncate">
              {e.actor_email ?? "system"}
              {e.target_email ? ` → ${e.target_email}` : ""}
            </div>
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {timeAgo(e.created_at)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Signups({ items, loading }: { items: any[]; loading: boolean }) {
  if (loading) return <Skeleton lines={3} />;
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">No signups yet.</p>;
  return (
    <ul className="space-y-2">
      {items.map((u) => (
        <li
          key={u.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="truncate">{u.email ?? <code className="text-xs">{u.id}</code>}</div>
            <div className="text-xs text-muted-foreground">
              {timeAgo(u.created_at)}
              {u.roles.length > 0 ? ` · ${u.roles.join(", ")}` : ""}
            </div>
          </div>
          <Link
            to="/admin/users"
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Health({ stats }: { stats?: any }) {
  if (!stats) return <Skeleton lines={3} />;
  const items = [
    { label: "AI gateway key", ok: stats.health.aiGatewayKeySet },
    { label: "Templates enabled", ok: stats.templates.enabled > 0 },
    { label: "Errors in last activity", ok: stats.health.errorCount24h === 0 },
  ];
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 text-sm">
          {it.ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          <span className="text-foreground">{it.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {it.ok ? "OK" : "Check"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TopIdeas({ items, loading }: { items: any[]; loading: boolean }) {
  if (loading) return <Skeleton lines={3} />;
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">No ready ideas yet.</p>;
  return (
    <ol className="space-y-2">
      {items.map((p, i) => (
        <li
          key={p.id}
          className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm"
        >
          <span className="font-display text-lg w-6 text-ember">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {p.user_email ?? "—"} · {timeAgo(p.updated_at)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-semibold">{p.score ?? "—"}</div>
            <div className="text-[10px] text-muted-foreground">/100</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TemplateSummary({ stats }: { stats?: any }) {
  if (!stats) return <Skeleton lines={3} />;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Prompt templates</span>
        <span className="font-medium">
          {stats.templates.enabled} active / {stats.templates.total} total
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Model skills</span>
        <span className="font-medium">
          {stats.skills.enabled} active / {stats.skills.total} total
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Last template edit</span>
        <span className="font-medium">
          {stats.templates.lastEditedAt ? timeAgo(stats.templates.lastEditedAt) : "—"}
        </span>
      </div>
      <div className="flex gap-2 pt-2">
        <Link
          to="/admin/prompt-templates"
          className="flex-1 rounded-full border border-border px-3 py-1.5 text-center text-xs hover:border-ember/40"
        >
          Templates
        </Link>
        <Link
          to="/admin/skills"
          className="flex-1 rounded-full border border-border px-3 py-1.5 text-center text-xs hover:border-ember/40"
        >
          Skills
        </Link>
      </div>
    </div>
  );
}

function UsageChart({ data }: { data: { date: string; signups: number; projects: number }[] }) {
  if (data.length === 0) return <Skeleton lines={4} />;
  const w = 640;
  const h = 140;
  const pad = 8;
  const max = Math.max(
    1,
    ...data.flatMap((d) => [d.signups, d.projects]),
  );
  const barW = (w - pad * 2) / data.length;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36">
        {data.map((d, i) => {
          const x = pad + i * barW;
          const ps = (d.projects / max) * (h - pad * 2);
          const ss = (d.signups / max) * (h - pad * 2);
          return (
            <g key={d.date}>
              <rect
                x={x + 1}
                y={h - pad - ps}
                width={Math.max(1, barW / 2 - 1)}
                height={ps}
                fill="oklch(0.68 0.19 38)"
                opacity={0.8}
              />
              <rect
                x={x + barW / 2}
                y={h - pad - ss}
                width={Math.max(1, barW / 2 - 1)}
                height={ss}
                fill="oklch(0.74 0.16 220)"
                opacity={0.8}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded" style={{ background: "oklch(0.68 0.19 38)" }} />
          Projects
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded" style={{ background: "oklch(0.74 0.16 220)" }} />
          Signups
        </span>
        <span className="ml-auto">{data[0]?.date} → {data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function QuickActions() {
  const tiles = [
    { to: "/admin/users", icon: Users, label: "Users" },
    { to: "/admin/prompt-templates", icon: Settings, label: "Prompts" },
    { to: "/admin/skills", icon: Sparkles, label: "Skills" },
    { to: "/admin/audit-log", icon: Activity, label: "Audit log" },
    { to: "/feedback", icon: MessageSquare, label: "Feedback" },
    { to: "/bounties", icon: Coins, label: "Bounties" },
    { to: "/settings", icon: Settings, label: "Settings" },
    { to: "/dashboard", icon: LayoutDashboard, label: "My projects" },
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {tiles.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs hover:border-ember/40 transition"
        >
          <t.icon className="h-3.5 w-3.5 text-ember" /> {t.label}
        </Link>
      ))}
      <Link
        to="/intake"
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-3.5 py-1.5 text-xs font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
      >
        <Plus className="h-3.5 w-3.5" /> New idea
      </Link>
    </div>
  );
}

function SearchResults({ query }: { query: string }) {
  const links = useMemo(() => {
    const q = query.toLowerCase();
    const all = [
      { label: "Users", to: "/admin/users" as const, keys: ["user", "users", "role", "admin", "people"] },
      { label: "Prompt templates", to: "/admin/prompt-templates" as const, keys: ["template", "prompt", "ai"] },
      { label: "Model skills", to: "/admin/skills" as const, keys: ["skill", "model"] },
      { label: "Audit log", to: "/admin/audit-log" as const, keys: ["audit", "log", "activity", "history"] },
      { label: "Feedback", to: "/feedback" as const, keys: ["feedback", "wish", "bug", "issue"] },
      { label: "Bounties", to: "/bounties" as const, keys: ["bounty", "bounties", "reward"] },
      { label: "Settings", to: "/settings" as const, keys: ["setting", "settings", "account", "preferences"] },
      { label: "My projects", to: "/dashboard" as const, keys: ["project", "idea", "dashboard"] },
    ];
    return all.filter(
      (l) => l.label.toLowerCase().includes(q) || l.keys.some((k) => k.includes(q)),
    );
  }, [query]);
  if (links.length === 0) return null;
  return (
    <div className="absolute z-20 mt-2 w-full rounded-xl border border-border bg-popover p-1 shadow-elegant">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-8 rounded-md bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}
