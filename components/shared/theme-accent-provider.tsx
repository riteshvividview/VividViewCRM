"use client";

import { useEffect } from "react";

export const ACCENT_KEY = "vividview-accent";
export type AccentColor = "purple" | "blue" | "emerald" | "rose" | "amber" | "slate";

export function ThemeAccentProvider() {
  useEffect(() => {
    const stored = (localStorage.getItem(ACCENT_KEY) ?? "purple") as AccentColor;
    applyAccent(stored);
  }, []);
  return null;
}

export function applyAccent(accent: AccentColor) {
  const el = document.documentElement;
  if (accent === "purple" || !accent) {
    el.removeAttribute("data-accent");
  } else {
    el.setAttribute("data-accent", accent);
  }
  localStorage.setItem(ACCENT_KEY, accent);
}
