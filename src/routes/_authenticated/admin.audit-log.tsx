import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, Search, KeyRound, ShieldOff, Shield, Trash2, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { listAuditLog, type AuditLogEntry } from "@/lib/api/admin-users.functions";
import { NotAuthorized } from "@/components/site/NotAuthorized";
import { AdminHeader } from "@/components/site/AdminHeader";

export const Route = createFileRoute("/_authenticated/admin/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit log — Admin" },
      { name: "description", content: "Administrative action history." },
    ],
  }),
  component: AuditLogPage,
});

function AuditLogPage() {
  const checkAdminFn = useServerFn(checkAdmin);
  const adminQ = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });
  const listFn = useServerFn(listAuditLog);
  const logQ = useQuery({
    queryKey: ["admin", "audit-log"],
    queryFn: () => listFn(),
    enabled: adminQ.data?.isAdmin === true,
  });

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const list = logQ.data?.entries ?? [];
    return list.filter((e) => {
      if (filter !== "all" && !e.action.startsWith(filter)) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        e.action.toLowerCase().includes(q) ||
        (e.actor_email?.toLowerCase().includes(q) ?? false) ||
        (e.target_email?.toLowerCase().includes(q) ?? false) ||
        (e.target_user_id?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [logQ.data, query, filter]);

  if (adminQ.isLoading) {
    return (
      <div className="grid h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!adminQ.data?.isAdmin) {
    return <NotAuthorized area="the admin audit log" />;
  }

  return (
    <>
    <AdminHeader label="Audit log" />
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to users
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last 200 administrative actions, newest first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip label="Roles" active={filter === "role."} onClick={() => setFilter("role.")} />
          <FilterChip label="Resets" active={filter === "password_reset."} onClick={() => setFilter("password_reset.")} />
          <FilterChip label="Deletions" active={filter === "user.delete"} onClick={() => setFilter("user.delete")} />
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {logQ.isLoading && (
        <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">When</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Actor</th>
              <th className="px-4 py-3 text-left font-medium">Target</th>
              <th className="px-4 py-3 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <Row key={e.id} entry={e} />
            ))}
            {!logQ.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-ember/50 bg-ember/10 text-foreground"
          : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function actionMeta(action: string) {
  if (action === "role.admin.grant")
    return { icon: <Shield className="h-3.5 w-3.5" />, label: "Granted admin", tone: "text-ember" };
  if (action === "role.admin.revoke")
    return { icon: <ShieldOff className="h-3.5 w-3.5" />, label: "Revoked admin", tone: "text-muted-foreground" };
  if (action === "password_reset.send")
    return { icon: <KeyRound className="h-3.5 w-3.5" />, label: "Password reset sent", tone: "text-foreground" };
  if (action === "user.delete")
    return { icon: <Trash2 className="h-3.5 w-3.5" />, label: "Deleted user", tone: "text-destructive" };
  return { icon: <Activity className="h-3.5 w-3.5" />, label: action, tone: "text-foreground" };
}

function Row({ entry }: { entry: AuditLogEntry }) {
  const meta = actionMeta(entry.action);
  const when = new Date(entry.created_at);
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        <div>{when.toLocaleDateString()}</div>
        <div className="text-[11px]">{when.toLocaleTimeString()}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 ${meta.tone}`}>
          {meta.icon}
          <span className="text-sm">{meta.label}</span>
        </span>
        <div className="text-[10px] text-muted-foreground"><code>{entry.action}</code></div>
      </td>
      <td className="px-4 py-3">
        <div className="text-foreground">{entry.actor_email ?? "—"}</div>
        {entry.actor_user_id && <code className="text-[10px] text-muted-foreground">{entry.actor_user_id}</code>}
      </td>
      <td className="px-4 py-3">
        <div className="text-foreground">{entry.target_email ?? "—"}</div>
        {entry.target_user_id && <code className="text-[10px] text-muted-foreground">{entry.target_user_id}</code>}
      </td>
      <td className="px-4 py-3">
        {entry.details && Object.keys(entry.details).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {Object.entries(entry.details).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-[10px]">
                {k}: {String(v)}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
