import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function AuthButton({ className }: { className?: string }) {
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

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out.");
    navigate({ to: "/", replace: true });
  };

  const base =
    className ??
    "inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-3 py-1.5";

  if (isAuthed === null) return <span className={base} aria-hidden />;
  if (isAuthed) {
    return (
      <button onClick={handleSignOut} className={base}>
        {t("common.signOut")}
      </button>
    );
  }
  return (
    <Link to="/auth" className={base}>
      {t("common.signIn")}
    </Link>
  );
}
