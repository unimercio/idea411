import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Lightweight "new version available" checker.
 *
 * Polls the served HTML document with a HEAD request and watches `ETag` /
 * `Last-Modified`. When the value changes vs. what was seen at first load,
 * the user is shown a dialog with release notes (fetched from
 * `/release-notes.json`) and a "Refresh" action.
 *
 * - Client-only (guards on `window`).
 * - Disabled in dev, inside iframes, and on Lovable preview hostnames so the
 *   editor preview doesn't constantly nag.
 * - No service worker — works with the project's manifest-only PWA setup.
 */
const POLL_MS = 60_000;
const TOAST_ID = "app-update-available";
const SEEN_RELEASE_KEY = "ideaforge:seen-release";

type Release = {
  version: string;
  date?: string;
  time?: string;
  notes: string[];
};

function releaseLabel(release: Release) {
  return [release.version, release.date, release.time].filter(Boolean).join(" · ");
}

function releaseFingerprint(release: Release | undefined) {
  return release ? releaseLabel(release) : null;
}

function getSeenRelease() {
  try {
    return window.localStorage.getItem(SEEN_RELEASE_KEY);
  } catch {
    return null;
  }
}

function setSeenRelease(value: string | null) {
  if (!value) return;
  try {
    window.localStorage.setItem(SEEN_RELEASE_KEY, value);
  } catch {
    /* ignore */
  }
}

function isPreviewLikeHost(host: string) {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

function shouldRun() {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.PROD) return false;
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  if (isPreviewLikeHost(window.location.hostname)) return false;
  return true;
}

async function fetchVersionToken(): Promise<string | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    return (
      res.headers.get("x-deployment-id") ||
      res.headers.get("etag") ||
      res.headers.get("last-modified") ||
      res.headers.get("x-build-id") ||
      null
    );
  } catch {
    return null;
  }
}

async function fetchReleaseNotes(): Promise<Release[]> {
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

export function UpdateChecker() {
  const initialRef = useRef<string | null>(null);
  const notifiedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);
  const [activeRelease, setActiveRelease] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldRun()) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const showUpdate = async (providedNotes?: Release[]) => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
      const notes = providedNotes ?? (await fetchReleaseNotes());
      if (cancelled) return;
      const latestRelease = releaseFingerprint(notes[0]);
      setReleases(notes);
      setActiveRelease(latestRelease);
      setOpen(true);
      toast("A new version is available", {
        id: TOAST_ID,
        description: "See what's new and refresh when ready.",
        duration: Infinity,
        action: {
          label: "What's new",
          onClick: () => setOpen(true),
        },
      });
    };

    const check = async () => {
      const token = await fetchVersionToken();
      if (cancelled || !token) return;
      if (initialRef.current === null) {
        initialRef.current = token;
        return;
      }
      if (token !== initialRef.current) void showUpdate();
    };

    const checkReleaseNotes = async () => {
      const notes = await fetchReleaseNotes();
      if (cancelled || notes.length === 0) return;
      const latestRelease = releaseFingerprint(notes[0]);
      if (latestRelease && latestRelease !== getSeenRelease()) void showUpdate(notes);
    };

    void check();
    void checkReleaseNotes();
    timer = setInterval(() => void check(), POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const latest = releases[0];
  const previous = releases.slice(1, 4);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSeenRelease(activeRelease);
  };

  const handleRefresh = () => {
    setSeenRelease(activeRelease);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>A new version is available</DialogTitle>
          <DialogDescription>
            {latest
              ? `What's new in ${releaseLabel(latest)}`
              : "Refresh to load the latest build."}
          </DialogDescription>
        </DialogHeader>

        {releases.length > 0 ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">
            Release notes aren't available right now, but a newer build is ready.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Later
          </Button>
          <Button onClick={handleRefresh}>Refresh now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
