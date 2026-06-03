import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** What the visitor was trying to access, e.g. "the user management page". */
  area?: string;
  /** Optional extra content (e.g. a "Claim admin role" button). */
  children?: React.ReactNode;
};

/**
 * Dedicated "not authorized" screen shown when a non-admin user visits
 * an admin page directly via URL. Explains *why* access is restricted
 * and offers clear next steps instead of a silent dead-end.
 */
export function NotAuthorized({ area = "this page", children }: Props) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center px-6 py-16">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/80 p-8 shadow-elegant">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>

        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">
          Access restricted
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You don't have permission to view {area}. This area is reserved for
          administrators — it manages roles, sensitive settings, and other
          users' accounts, so it isn't accessible to standard members.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          If you believe you should have access, ask an existing admin to grant
          you the <span className="font-medium text-foreground">admin</span>{" "}
          role from the Users page.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link to="/dashboard">
              <Home className="mr-1.5 h-3.5 w-3.5" /> Go to dashboard
            </Link>
          </Button>
          {children}
        </div>
      </div>
    </main>
  );
}
