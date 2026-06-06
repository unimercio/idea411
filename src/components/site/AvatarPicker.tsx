import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AvatarEditor } from "@/components/site/AvatarEditor";

type Props = {
  onUploaded: (path: string) => void;
  currentPath?: string;
  disabled?: boolean;
};

const AVATAR_STYLES = [
  "avataaars",
  "bottts",
  "lorelei",
  "notionists",
  "thumbs",
  "fun-emoji",
  "personas",
  "adventurer",
];
const SEEDS = ["Ada", "Lin", "Mika", "Zola", "Theo", "Iris", "Otis", "Nova", "Juno", "Rex", "Kai", "Vee"];

function buildPresetUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export function AvatarPicker({ onUploaded, currentPath, disabled }: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Start camera when dialog opens
  useEffect(() => {
    if (!cameraOpen) return;
    let active = true;
    setSnapshot(null); setEdited(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not supported on this device.");
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not access camera.");
        setCameraOpen(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cameraOpen, facing]);

  // Stop camera on close
  useEffect(() => {
    if (cameraOpen) return;
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setSnapshot(null); setEdited(null);
  }, [cameraOpen, stream]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, sx, sy, size, size, 0, 0, 512, 512);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.9));
  };

  const uploadBlob = async (blob: Blob, ext: string) => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not signed in");
    const path = `${userData.user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (upErr) throw upErr;
    if (currentPath && currentPath !== path) {
      await supabase.storage.from("avatars").remove([currentPath]);
    }
    return path;
  };

  const saveSnapshot = async () => {
    const source = edited || snapshot;
    if (!source) return;
    setBusy(true);
    try {
      const res = await fetch(source);
      const blob = await res.blob();
      const path = await uploadBlob(blob, "jpg");
      onUploaded(path);
      toast.success("Photo saved. Don't forget to save your profile.");
      setCameraOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const pickPreset = async (url: string) => {
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Couldn't load avatar");
      const blob = await res.blob();
      const path = await uploadBlob(blob, "svg");
      onUploaded(path);
      toast.success("Avatar selected. Don't forget to save your profile.");
      setGalleryOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setCameraOpen(true)}
        disabled={disabled}
      >
        <Camera className="h-4 w-4 mr-2" /> Take photo
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setGalleryOpen(true)}
        disabled={disabled}
      >
        <Sparkles className="h-4 w-4 mr-2" /> Choose avatar
      </Button>

      {/* Camera dialog */}
      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Take a photo</DialogTitle>
            <DialogDescription>
              Use your device's camera to snap a profile photo.
            </DialogDescription>
          </DialogHeader>
          {snapshot ? (
            <AvatarEditor src={snapshot} onChange={setEdited} />
          ) : (
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`}
              />
            </div>
          )}
          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              disabled={busy || !!snapshot}
            >
              <RefreshCcw className="h-4 w-4 mr-2" /> Flip
            </Button>
            <div className="flex gap-2">
              {snapshot ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSnapshot(null)}
                    disabled={busy}
                  >
                    <X className="h-4 w-4 mr-2" /> Retake
                  </Button>
                  <Button type="button" size="sm" onClick={saveSnapshot} disabled={busy}>
                    <Check className="h-4 w-4 mr-2" /> {busy ? "Saving…" : "Use photo"}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={capture} disabled={!stream}>
                  <Camera className="h-4 w-4 mr-2" /> Capture
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avatar gallery dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose an avatar</DialogTitle>
            <DialogDescription>
              Pick from a series of generated avatars. Click one to set it as your profile picture.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {AVATAR_STYLES.map((style) => (
              <div key={style} className="mb-5">
                <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {style}
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {SEEDS.map((seed) => {
                    const url = buildPresetUrl(style, seed);
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => pickPreset(url)}
                        disabled={busy}
                        className="aspect-square rounded-full overflow-hidden border border-border bg-muted hover:ring-2 hover:ring-ring transition disabled:opacity-50"
                        aria-label={`Pick ${style} ${seed}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
