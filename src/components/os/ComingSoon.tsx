import { type LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-10 shadow-elegant">
      <div className="absolute inset-0 grid-bg opacity-[0.15]" aria-hidden />
      <div className="relative max-w-xl">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface-2 text-indigo">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo animate-pulse" /> Scheduled · phase 2
        </p>
      </div>
    </div>
  );
}
