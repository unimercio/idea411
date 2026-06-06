import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PUBLISHED_URL = "https://idea411.lovable.app";

export function MobileInstallQR({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(PUBLISHED_URL, {
      width: 320,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "inline-flex shrink-0 items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          }
          title="Install on mobile"
          aria-label="Install on mobile"
        >
          <Smartphone className="h-4 w-4" />
          <span className="hidden sm:inline">Install</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Install on mobile</DialogTitle>
          <DialogDescription>
            Scan the QR with your phone camera to open the published app, then use your browser's
            “Add to Home Screen” to install.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-lg border border-border bg-white p-3">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={`QR code linking to ${PUBLISHED_URL}`}
                width={256}
                height={256}
                className="block h-64 w-64"
              />
            ) : (
              <div className="h-64 w-64 animate-pulse rounded bg-muted" />
            )}
          </div>
          <a
            href={PUBLISHED_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-ember hover:underline"
          >
            {PUBLISHED_URL}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
