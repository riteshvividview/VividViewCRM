"use client";

/** The effects of Sakuga VFX (MIT, vendored in /public/vendor/sakuga), loaded only when the game needs them. */
export interface SakugaFX {
  burst(x: number, y: number, o?: { r?: number; spikes?: number; life?: number }): void;
  shards(x: number, y: number, o?: { n?: number; speed?: number; size?: number }): void;
  splash(x: number, y: number, o?: { w?: number; h?: number }): void;
  slash(x: number, y: number, o?: { len?: number; ang?: number; thick?: number }): void;
  puff(x: number, y: number, o?: { n?: number; size?: number }): void;
  ring(x: number, y: number, o?: { rx?: number; ry?: number }): void;
  kira(x: number, y: number, o?: { r?: number }): void;
  lines(x: number, y: number, o?: { n?: number; dir?: number; len?: number }): void;
  sfx(name: "don" | "gogo" | "kachi" | "pon" | "shu" | "zuza", x: number, y: number, o?: { size?: number; rot?: number }): void;
}

let loading: Promise<SakugaFX | null> | null = null;

export function loadSakuga(): Promise<SakugaFX | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as unknown as { SakugaFX?: SakugaFX };
  if (w.SakugaFX) return Promise.resolve(w.SakugaFX);
  loading ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "/vendor/sakuga/button.js";
    s.async = true;
    s.onload = () => resolve(w.SakugaFX ?? null);
    s.onerror = () => { loading = null; resolve(null); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Big celebration at a point on the screen (correct guess, round start). Quietly does nothing if the effects failed to load. */
export async function celebrate(x: number, y: number, word: "don" | "gogo" | "pon" | "kachi" | "shu" | "zuza" = "don") {
  const fx = await loadSakuga();
  if (!fx) return;
  fx.burst(x, y, { r: 70, spikes: 15 });
  fx.shards(x, y, { n: 12, speed: 260 });
  fx.sfx(word, x, y - 60, { size: 110 });
}

/** Run the effect at an element's centre. */
export function celebrateAt(el: Element | null, word?: "don" | "gogo" | "pon" | "kachi" | "shu" | "zuza") {
  if (!el) return;
  const r = el.getBoundingClientRect();
  void celebrate(r.left + r.width / 2, r.top + r.height / 2, word);
}
