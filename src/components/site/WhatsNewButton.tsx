import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type Release = {
  version: string;
  date?: string;
  time?: string;
  notes: string[];
};

function releaseLabel(release: Release) {
  return [release.version, release.date, release.time].filter(Boolean).join(" · ");
}

async function fetchReleases(): Promise<Release[]> {
  try {
    const res = await fetch(`/release-notes.json?_v=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { releases?: Release[] };
    return Array.isArray(data.releases) ? data.releases : [];
  } catch {
    return [];
  }
}

export function WhatsNewButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [releases, setReleases] = useState<Release[] | null>(null);

  useEffect(() => {
    if (!open || releases !== null) return;
    void fetchReleases().then(setReleases);
  }, [open, releases]);

  const latest = releases?.[0];
  const previous = releases?.slice(1, 5) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5"
          }
          aria-label="What's new"
        >
          <Sparkles className="h-4 w-4" />
          <span>What's new</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What's new</DialogTitle>
          <DialogDescription>
            {latest
              ? releaseLabel(latest)
              : "Recent updates to IdeaForge"}
          </DialogDescription>
        </DialogHeader>

        {releases === null ? (
          <p className="text-sm text-muted-foreground">Loading release notes…</p>
        ) : releases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No release notes available yet.</p>
        ) : (
          <ScrollArea className="max-h-72 pr-3">
            {latest && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {latest.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {previous.length > 0 && (
              <div className="mt-4 space-y-3">
                {previous.map((r) => (
                  <div key={r.version}>
                    <p className="text-xs font-medium text-muted-foreground">
                      {releaseLabel(r)}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {r.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={() => window.location.reload()}>Refresh app</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
