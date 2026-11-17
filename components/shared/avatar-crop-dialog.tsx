"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlassMinus, faMagnifyingGlassPlus, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const VIEW = 280; // on-screen crop square, px
const OUTPUT = 512; // saved picture, px

/**
 * Lets the user position and zoom a photo inside a round frame, then returns a
 * 512×512 JPEG. Because the result is redrawn at a fixed size, the original
 * file can be any size.
 */
export function AvatarCropDialog({ file, onCancel, onCropped }: {
  file: File | null;
  onCancel: () => void;
  onCropped: (blob: Blob) => Promise<void> | void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    setImg(null); setZoom(1); setPos({ x: 0, y: 0 }); setError(null);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setError("This file could not be opened as an image.");
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The picture always covers the frame: at zoom 1 its shorter side equals the frame.
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : VIEW;
  const h = img ? img.naturalHeight * base * zoom : VIEW;
  const clamp = (p: { x: number; y: number }, width = w, height = h) => ({
    x: Math.min(0, Math.max(VIEW - width, p.x)),
    y: Math.min(0, Math.max(VIEW - height, p.y)),
  });

  // Centre the picture when it loads.
  useEffect(() => {
    if (!img) return;
    const s = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
    setPos({ x: (VIEW - img.naturalWidth * s) / 2, y: (VIEW - img.naturalHeight * s) / 2 });
  }, [img]);

  function changeZoom(next: number) {
    if (!img) return;
    const z = Math.min(4, Math.max(1, next));
    const nw = img.naturalWidth * base * z, nh = img.naturalHeight * base * z;
    // Keep the centre of the frame fixed while zooming.
    const cx = (VIEW / 2 - pos.x) / w, cy = (VIEW / 2 - pos.y) / h;
    setZoom(z);
    setPos(clamp({ x: VIEW / 2 - cx * nw, y: VIEW / 2 - cy * nh }, nw, nh));
  }

  async function save() {
    if (!img || saving) return;
    setSaving(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT; canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    const scale = base * zoom; // screen px per image px
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUTPUT, OUTPUT);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (blob) await onCropped(blob);
    else setError("Could not prepare the picture. Try another file.");
    setSaving(false);
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o && !saving) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Adjust your photo</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative touch-none select-none overflow-hidden rounded-xl bg-muted"
            style={{ width: VIEW, height: VIEW, cursor: img ? (drag.current ? "grabbing" : "grab") : "default" }}
            onPointerDown={(e) => { if (!img) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
            onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            onWheel={(e) => changeZoom(zoom - e.deltaY * 0.002)}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: pos.x, top: pos.y, width: w, height: h }} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {error ?? <FontAwesomeIcon icon={faSpinner} spin />}
              </div>
            )}
            {/* Round frame: everything outside the circle is dimmed. */}
            {img && <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }} />}
          </div>

          <div className="flex w-full items-center gap-3 text-muted-foreground">
            <FontAwesomeIcon icon={faMagnifyingGlassMinus} className="h-3.5 w-3.5" />
            <input type="range" min={1} max={4} step={0.01} value={zoom} disabled={!img} onChange={(e) => changeZoom(Number(e.target.value))} aria-label="Zoom" className="h-1.5 flex-1 cursor-pointer accent-primary" />
            <FontAwesomeIcon icon={faMagnifyingGlassPlus} className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs text-muted-foreground">Drag the photo to position it. Use the slider or scroll to zoom.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={!img || saving}>
            {saving && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
