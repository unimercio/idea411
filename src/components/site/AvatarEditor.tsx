import { useEffect, useRef, useState } from "react";
import { RotateCw, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Props = {
  src: string;
  size?: number; // output px
  onChange: (dataUrl: string) => void;
};

const PREVIEW = 320;

export function AvatarEditor({ src, size = 512, onChange }: Props) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0); // degrees
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [ready, setReady] = useState(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
      setRotation(0);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
  }, [src]);

  const render = (canvas: HTMLCanvasElement, dim: number) => {
    const img = imgRef.current;
    if (!img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = dim;
    canvas.height = dim;
    ctx.clearRect(0, 0, dim, dim);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, dim, dim);

    // Base scale: cover the square with the rotated image's effective dimension
    const rad = (rotation * Math.PI) / 180;
    const rotated90 = rotation % 180 !== 0;
    const iw = rotated90 ? img.height : img.width;
    const ih = rotated90 ? img.width : img.height;
    const baseScale = dim / Math.min(iw, ih);
    const scale = baseScale * zoom;

    const scaleRatio = dim / PREVIEW;
    ctx.save();
    ctx.translate(dim / 2 + offset.x * scaleRatio, dim / 2 + offset.y * scaleRatio);
    ctx.rotate(rad);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  };

  // Re-render preview + emit cropped output
  useEffect(() => {
    if (!ready) return;
    const c = previewRef.current;
    if (c) render(c, PREVIEW);
    const out = document.createElement("canvas");
    render(out, size);
    onChange(out.toDataURL("image/jpeg", 0.92));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rotation, zoom, offset, size]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="space-y-3">
      <div className="relative mx-auto" style={{ width: PREVIEW, height: PREVIEW }}>
        <canvas
          ref={previewRef}
          width={PREVIEW}
          height={PREVIEW}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="rounded-full border border-border bg-black touch-none cursor-grab active:cursor-grabbing"
        />
        <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary/40" />
      </div>

      <div className="flex items-center gap-3">
        <ZoomOut className="h-4 w-4 text-muted-foreground" />
        <Slider
          min={1}
          max={4}
          step={0.05}
          value={[zoom]}
          onValueChange={(v) => setZoom(v[0])}
          className="flex-1"
        />
        <ZoomIn className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
        >
          <RotateCcw className="h-4 w-4 mr-2" /> Rotate left
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRotation((r) => (r + 90) % 360)}
        >
          <RotateCw className="h-4 w-4 mr-2" /> Rotate right
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setRotation(0);
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          Reset
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">Drag to pan · pinch slider to zoom</p>
    </div>
  );
}
