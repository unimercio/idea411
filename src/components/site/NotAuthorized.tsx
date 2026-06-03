import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type Props = {
  area?: string;
  children?: React.ReactNode;
};

export function NotAuthorized({ area, children }: Props) {
  const { t } = useTranslation();
  const resolvedArea = area ?? t("notAuthorized.defaultArea");
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center px-6 py-16">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("notAuthorized.back")}
      </Link>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/80 p-8 shadow-elegant">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>

        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">
          {t("notAuthorized.title")}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("notAuthorized.explanation", { area: resolvedArea })}
        </p>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("notAuthorized.requestAdmin")}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link to="/dashboard">
              <Home className="mr-1.5 h-3.5 w-3.5" /> {t("notAuthorized.goDashboard")}
            </Link>
          </Button>
          {children}
        </div>
      </div>
    </main>
  );
}
