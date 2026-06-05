import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame } from "lucide-react";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { getHomePath } from "@/lib/home-path";

export function AdminHeader({ label = "Admin" }: { label?: string }) {
  const checkAdminFn = useServerFn(checkAdmin);
  const adminQ = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });
  const isAdmin = adminQ.data?.isAdmin === true;
  const isSysadmin = adminQ.data?.isSysadmin === true;
  const homePath = getHomePath({ isAuthed: true, isAdmin, isSysadmin });

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
        <Link to={homePath} className="flex items-center gap-2 font-display font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
            <Flame className="h-4 w-4" />
          </span>
          IdeaForge
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-ember">{label}</span>
      </div>
    </header>
  );
}
