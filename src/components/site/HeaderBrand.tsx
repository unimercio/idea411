import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";

import { AuthButton } from "./AuthButton";

type LinkTo = React.ComponentProps<typeof Link>["to"];

export function HeaderBrand({
  to = "/" as LinkTo,
  className,
  logoClassName,
  showAuth = true,
}: {
  to?: LinkTo;
  className?: string;
  logoClassName?: string;
  showAuth?: boolean;
}) {
  const classes = className
    ? `flex min-w-0 items-center gap-3 ${className}`
    : "flex min-w-0 items-center gap-3";

  return (
    <div className={classes}>
      <Link
        to={to}
        className={logoClassName ?? "flex shrink-0 items-center gap-2 font-display font-semibold"}
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
          <Flame className="h-4 w-4" />
        </span>
        IdeaForge
      </Link>
      <MobileInstallQR className="inline-flex shrink-0 items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground" />
      {showAuth && (
        <AuthButton className="ml-auto inline-flex shrink-0 items-center text-sm text-muted-foreground hover:text-foreground px-2 py-1.5" />
      )}
    </div>
  );
}

