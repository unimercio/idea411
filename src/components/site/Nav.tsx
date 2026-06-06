import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";

import { HeaderBrand } from "./HeaderBrand";
import { getHomePath } from "@/lib/home-path";

export function Nav() {
  const { t } = useTranslation();
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
  const isSysadmin = isAuthed === true && adminQuery.data?.isSysadmin === true;
  const homePath = getHomePath({ isAuthed, isAdmin, isSysadmin });


  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-6 pt-5">
        <div className="glass flex items-center justify-between rounded-full border border-border px-5 py-3 shadow-elegant">
          <HeaderBrand
            to={homePath}
            logoClassName="flex shrink-0 items-center gap-2 font-display text-lg font-semibold tracking-tight"
          />
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            {isAuthed === true && (
              <Link to="/dashboard" className="hover:text-foreground transition-colors">{t("common.dashboard")}</Link>
            )}
            {isAuthed === true && (
              <>
                <Link to="/feedback" className="hover:text-foreground transition-colors">Feedback</Link>
                <Link to="/bounties" className="hover:text-foreground transition-colors">Bounties</Link>
              </>
            )}
            {isAdmin && (
              <>
                <Link to="/admin/prompt-templates" className="hover:text-foreground transition-colors">{t("nav.prompts")}</Link>
                <Link to="/admin/skills" className="hover:text-foreground transition-colors">{t("nav.skills")}</Link>
                <Link to="/admin/users" className="hover:text-foreground transition-colors">{t("nav.users")}</Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/intake"
              className="inline-flex items-center rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
            >
              {t("common.startForging")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
