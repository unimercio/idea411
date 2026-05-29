import { Flame } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border py-14">
      <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-2 font-display font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
            <Flame className="h-4 w-4" />
          </span>
          IdeaForge
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} IdeaForge Labs. Concept to market, in one flow.
        </p>
      </div>
    </footer>
  );
}
