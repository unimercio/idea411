import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
            <Flame className="h-4 w-4" />
          </span>
          IdeaForge
        </Link>
        <p className="text-xs text-muted-foreground">
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
