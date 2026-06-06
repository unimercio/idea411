import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { getHomePath } from "@/lib/home-path";
import { HeaderBrand } from "./HeaderBrand";

export function AdminHeader({ label = "Admin" }: { label?: string }) {
  const checkAdminFn = useServerFn(checkAdmin);
  const adminQ = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });
  const isAdmin = adminQ.data?.isAdmin === true;
  const isSysadmin = adminQ.data?.isSysadmin === true;
  const homePath = getHomePath({ isAuthed: true, isAdmin, isSysadmin });

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
        <HeaderBrand to={homePath} />
        <span className="text-xs uppercase tracking-[0.2em] text-ember">{label}</span>
      </div>
    </header>
  );
}
