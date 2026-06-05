import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Flame,
  Sparkles,
  Settings as SettingsIcon,
  Plus,
  Crown,
  Shield,
  Users,
  ScrollText,
  LayoutDashboard,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { toast } from "sonner";
import { getHomePath } from "@/lib/home-path";

export function Nav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setIsAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const checkAdminFn = useServerFn(checkAdmin);
  const adminQuery = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => checkAdminFn(),
    enabled: isAuthed === true,
  });
  const rolesReady = isAuthed !== true || adminQuery.isFetched;
  const isAdmin = isAuthed === true && adminQuery.data?.isAdmin === true;
  const isSysadmin = isAuthed === true && adminQuery.data?.isSysadmin === true;
  const homePath = getHomePath({ isAuthed, isAdmin, isSysadmin });

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out.");
    navigate({ to: "/", replace: true });
  };

  const linkClass = (active: boolean) =>
    `hidden md:inline-flex items-center gap-1.5 text-sm transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  const isActive = (prefix: string, exact = false) =>
    exact ? pathname === prefix : pathname === prefix || pathname.startsWith(prefix + "/");

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-6 pt-5">
        <div className="glass flex items-center justify-between gap-3 rounded-full border border-border px-5 py-3 shadow-elegant">
          <Link to={homePath} className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight shrink-0">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>

          <nav className="flex items-center gap-1 md:gap-4 overflow-x-auto">
            {isAuthed === true && rolesReady && (
              <>
                <Link to="/dashboard" className={linkClass(isActive("/dashboard"))}>
                  <LayoutDashboard className="h-4 w-4" /> {t("common.dashboard")}
                </Link>
                <Link to="/hermes" className={linkClass(isActive("/hermes"))}>
                  <Sparkles className="h-4 w-4" /> Agents
                </Link>
              </>
            )}
            {isAdmin && (
              <>
                <Link to="/admin" className={linkClass(pathname === "/admin")}>
                  <Shield className="h-4 w-4" /> Admin
                </Link>
                <Link to="/admin/prompt-templates" className={linkClass(isActive("/admin/prompt-templates"))}>
                  {t("nav.prompts")}
                </Link>
                <Link to="/admin/skills" className={linkClass(isActive("/admin/skills"))}>
                  {t("nav.skills")}
                </Link>
                <Link to="/admin/users" className={linkClass(isActive("/admin/users"))}>
                  <Users className="h-4 w-4" /> {t("nav.users")}
                </Link>
                <Link to="/admin/audit-log" className={linkClass(isActive("/admin/audit-log"))}>
                  <ScrollText className="h-4 w-4" /> Audit
                </Link>
              </>
            )}
            {isSysadmin && (
              <Link to="/sysadmin" className={linkClass(isActive("/sysadmin"))}>
                <Crown className="h-4 w-4" /> Sysadmin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isAuthed === true && rolesReady && (
              <>
                <Link
                  to="/settings"
                  className="hidden sm:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-2 py-1.5"
                  title={t("common.settings")}
                  aria-label={t("common.settings")}
                >
                  <SettingsIcon className="h-4 w-4" />
                </Link>
                <Link
                  to="/intake"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-3 py-1.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("common.newIdea")}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-2 py-1.5"
                >
                  {t("common.signOut")}
                </button>
              </>
            )}
            {isAuthed === false && (
              <Link to="/auth" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">
                {t("common.signIn")}
              </Link>
            )}
            {isAuthed === null && <span className="inline-flex w-16" aria-hidden />}
          </div>
        </div>
      </div>
    </header>
  );
}
