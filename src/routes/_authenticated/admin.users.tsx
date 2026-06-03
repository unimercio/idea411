import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck, KeyRound, Trash2, Shield, ShieldOff, Search, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { NotAuthorized } from "@/components/site/NotAuthorized";
import {
  listUsers,
  setUserAdmin,
  sendPasswordReset,
  deleteUser,
  type AdminUserRow,
} from "@/lib/api/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — Admin" },
      { name: "description", content: "Manage users, roles, and password resets." },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const checkAdminFn = useServerFn(checkAdmin);
  const adminQ = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });

  if (adminQ.isLoading) {
    return (
      <div className="grid h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!adminQ.data?.isAdmin) {
    return <NotAuthorized area="the user management page" />;
  }

  return <UsersTable />;
}

function UsersTable() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const setAdminFn = useServerFn(setUserAdmin);
  const resetFn = useServerFn(sendPasswordReset);
  const deleteFn = useServerFn(deleteUser);

  const [query, setQuery] = useState("");

  const usersQ = useQuery({ queryKey: ["admin", "users"], queryFn: () => listFn() });

  const setAdminM = useMutation({
    mutationFn: (v: { targetUserId: string; makeAdmin: boolean }) => setAdminFn({ data: v }),
    onSuccess: () => {
      toast.success("Role updated.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetM = useMutation({
    mutationFn: (email: string) =>
      resetFn({
        data: {
          email,
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth`
              : undefined,
        },
      }),
    onSuccess: () => toast.success("Password reset email sent."),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (targetUserId: string) => deleteFn({ data: { targetUserId } }),
    onSuccess: () => {
      toast.success("User deleted.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = usersQ.data?.users ?? [];
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (u) => u.email?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q),
    );
  }, [usersQ.data, query]);

  const currentUserId = usersQ.data?.currentUserId;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage roles, send password resets, and remove users.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/audit-log"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Activity className="h-3.5 w-3.5" /> Audit log
          </Link>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by email or id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {usersQ.isLoading && (
        <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      )}

      {usersQ.error && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(usersQ.error as Error).message}
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Roles</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Last sign in</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === currentUserId}
                onToggleAdmin={(makeAdmin) =>
                  setAdminM.mutate({ targetUserId: u.id, makeAdmin })
                }
                onReset={() => u.email && resetM.mutate(u.email)}
                onDelete={() => {
                  if (confirm(`Permanently delete ${u.email ?? u.id}? This cannot be undone.`)) {
                    deleteM.mutate(u.id);
                  }
                }}
                busy={
                  setAdminM.isPending || resetM.isPending || deleteM.isPending
                }
              />
            ))}
            {!usersQ.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function UserRow({
  user,
  isSelf,
  onToggleAdmin,
  onReset,
  onDelete,
  busy,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  onToggleAdmin: (makeAdmin: boolean) => void;
  onReset: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const isAdmin = user.roles.includes("admin");
  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {user.email ?? <span className="italic text-muted-foreground">no email</span>}
            {isSelf && <Badge variant="outline" className="ml-2 text-[10px]">you</Badge>}
            {!user.email_confirmed_at && (
              <Badge variant="outline" className="ml-2 text-[10px]">unverified</Badge>
            )}
          </span>
          <code className="text-[10px] text-muted-foreground">{user.id}</code>
        </div>
      </td>
      <td className="px-4 py-3">
        {isAdmin ? (
          <Badge className="bg-ember/15 text-ember hover:bg-ember/15">admin</Badge>
        ) : (
          <Badge variant="outline">user</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{fmt(user.created_at)}</td>
      <td className="px-4 py-3 text-muted-foreground">{fmt(user.last_sign_in_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {isAdmin ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleAdmin(false)}
              disabled={busy}
              title="Revoke admin"
            >
              <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Revoke admin
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleAdmin(true)}
              disabled={busy}
              title="Make admin"
            >
              <Shield className="mr-1.5 h-3.5 w-3.5" /> Make admin
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            disabled={busy || !user.email}
            title="Send password reset"
          >
            <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={busy || isSelf}
            title={isSelf ? "You cannot delete yourself" : "Delete user"}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
