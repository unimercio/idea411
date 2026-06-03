import { Link, useNavigate } from "@tanstack/react-router";
import { Flame, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { toast } from "sonner";

export function Nav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const isAdmin = isAuthed === true && adminQuery.data?.isAdmin === true;


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out.");
    navigate({ to: "/", replace: true });
  };

  return (
    <header className="fixed inset-x-2 top-3 z-50 overflow-x-clip sm:inset-x-6 sm:top-5">
      <div className="mx-auto w-full max-w-7xl">
        <div className="glass flex w-full max-w-full items-center justify-between rounded-full border border-border px-2 sm:px-5 py-2 sm:py-3 shadow-elegant gap-1 sm:gap-2 min-w-0 overflow-hidden">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2 font-display text-sm sm:text-lg font-semibold tracking-tight shrink-0 min-w-0">
            <span className="grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember shrink-0">
              <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <span className="hidden sm:inline">IdeaForge</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors shrink-0"
              aria-label={t("common.menu", { defaultValue: "Menu" })}
            >
              <Menu className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/">{t("common.home", { defaultValue: "Home" })}</Link>
              </DropdownMenuItem>
              {isAuthed === true && (
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">{t("common.dashboard")}</Link>
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/prompt-templates">{t("nav.prompts")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/skills">{t("nav.skills")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/users">{t("nav.users")}</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink justify-end">
            <div className="hidden sm:block">
              <LanguageSwitcher compact />
            </div>
            {isAuthed === true ? (
              <button
                onClick={handleSignOut}
                className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-foreground px-1 sm:px-3 py-1.5 whitespace-nowrap"
              >
                {t("common.signOut")}
              </button>
            ) : isAuthed === false ? (
              <Link to="/auth" className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-foreground px-1 sm:px-3 py-1.5 whitespace-nowrap">
                {t("common.signIn")}
              </Link>
            ) : null}
            <Link
              to="/intake"
              className="inline-flex items-center rounded-full bg-gradient-ember px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition whitespace-nowrap shrink-0"
            >
              <span className="sm:hidden">{t("common.startForgingShort", { defaultValue: "Forge" })}</span>
              <span className="hidden sm:inline">{t("common.startForging")}</span>
            </Link>
          </div>

        </div>
      </div>
    </header>
  );
}
