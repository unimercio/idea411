import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Sparkles,
  Briefcase,
  Workflow,
  MessageSquare,
  Activity,
  Settings,
  Plus,
  LogOut,
  Search,
  Command,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { toast } from "sonner";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/intake", label: "Idea Intake", icon: Sparkles },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/workflows", label: "Workflows", icon: Workflow },
  { to: "/chat", label: "Team Chat", icon: MessageSquare },
  { to: "/system", label: "System Status", icon: Activity },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function OSShell({
  children,
  title,
  eyebrow,
  description,
  actions,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const checkAdminFn = useServerFn(checkAdmin);
  const adminQuery = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => checkAdminFn(),
  });
  const isAdmin = adminQuery.data?.isAdmin === true;

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-surface-1/60 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2.5 px-5 border-b border-border">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-indigo shadow-indigo">
              <span className="font-display text-sm font-bold text-ember-foreground">7</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold tracking-tight">Seven Day</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Ventures · OS
              </p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-5">
            <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Workspace
            </p>
            <ul className="space-y-0.5">
              {PRIMARY_NAV.map((item) => (
                <NavLink key={item.to} item={item} active={isActive(pathname, item.to)} />
              ))}
            </ul>

            {(isAdmin || adminQuery.isLoading) && (
              <>
                <p className="px-2 pb-2 pt-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Operations
                </p>
                <ul className="space-y-0.5">
                  {ADMIN_NAV.map((item) => (
                    <NavLink key={item.to} item={item} active={isActive(pathname, item.to)} />
                  ))}
                </ul>
              </>
            )}
          </nav>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2.5 rounded-lg p-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-3 text-xs font-medium">
                {(email?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-xs font-medium">{email ?? "Loading…"}</p>
                <p className="text-[10px] text-muted-foreground">Incubator member</p>
              </div>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/70 px-5 backdrop-blur-xl lg:px-8">
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface-1/60 px-3 py-1.5 text-xs text-muted-foreground w-72">
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1">Search ventures, ideas, prompts…</span>
              <kbd className="font-mono text-[10px] inline-flex items-center gap-0.5 rounded border border-border px-1 py-0.5">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/intake"
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-indigo px-3.5 py-2 text-xs font-medium text-ember-foreground shadow-indigo hover:brightness-110 transition"
              >
                <Plus className="h-3.5 w-3.5" /> New idea
              </Link>
            </div>
          </header>

          {/* Page header */}
          <div className="border-b border-border bg-surface-1/30">
            <div className="px-5 py-8 lg:px-8 lg:py-10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  {eyebrow && (
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-indigo">
                      {eyebrow}
                    </p>
                  )}
                  <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
                    {title}
                  </h1>
                  {description && (
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
              </div>
            </div>
          </div>

          {/* Page body */}
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 px-5 py-8 lg:px-8"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/dashboard") return pathname === "/dashboard";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition ${
          active
            ? "bg-surface-2 text-foreground"
            : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${active ? "text-indigo" : "text-muted-foreground group-hover:text-foreground"}`}
        />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
