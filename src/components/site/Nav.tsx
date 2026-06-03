import { Link, useNavigate } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { toast } from "sonner";

export function Nav() {
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
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-6 pt-5">
        <div className="glass flex items-center justify-between rounded-full border border-border px-5 py-3 shadow-elegant">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            {isAuthed === true && (
              <Link to="/dashboard" className="hover:text-foreground transition-colors">Projects</Link>
            )}
            {isAdmin && (
              <>
                <Link to="/admin/prompt-templates" className="hover:text-foreground transition-colors">Prompts</Link>
                <Link to="/admin/skills" className="hover:text-foreground transition-colors">Skills</Link>
                <Link to="/admin/users" className="hover:text-foreground transition-colors">Users</Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2">
            {isAuthed === true ? (
              <button
                onClick={handleSignOut}
                className="hidden sm:inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-3 py-1.5"
              >
                Sign out
              </button>
            ) : isAuthed === false ? (
              <Link to="/auth" className="hidden sm:inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">
                Sign in
              </Link>
            ) : (
              <span className="hidden sm:inline-flex w-16" aria-hidden />
            )}
            <Link
              to="/intake"
              className="inline-flex items-center rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
            >
              Start forging
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
