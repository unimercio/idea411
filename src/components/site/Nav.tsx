import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";

export function Nav() {
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
            <a href="/#flow" className="hover:text-foreground transition-colors">How it works</a>
            <a href="/#showcase" className="hover:text-foreground transition-colors">Showcase</a>
            <a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">
              Sign in
            </Link>
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
