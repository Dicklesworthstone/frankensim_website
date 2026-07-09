"use client";

/**
 * Shared chrome for the FrankenSim "Deep Kernel" tier — five showpiece panels,
 * each driving a genuine newly-unlocked compiled-Rust WASM kernel (discrete Hodge
 * decomposition, FEEC Navier–Stokes, a Matérn Gaussian process, CMA-ES, and
 * entropic optimal transport). Pure presentation plus a few tiny hooks; every one
 * of the five owns its own <SyncContainer>, kernel call, canvas scene, and
 * animation loop. This file exists only so the five don't each re-declare the
 * same eyebrow / badge / pill / slider / colors / DPR-sizing boilerplate.
 */

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { useReducedMotion } from "@/components/motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette (FrankenSim — cyan/teal, deep-space black)                 */
/* ------------------------------------------------------------------ */

export const BG = "#04090d";
export const SURFACE = "#08131a";
export const BORDER = "rgba(34,211,238,0.14)";
export const CYAN = "#06b6d4";
export const CYAN_GLOW = "#22d3ee";
export const VIOLET = "#a855f7";
export const TEAL = "#14b8a6";
export const EMERALD = "#10b981";
export const AMBER = "#fbbf24";
export const ROSE = "#f43f5e";
export const MUTED = "#94a3b8";
export const BRIGHT = "#e2e8f0";

/** Parse "#rrggbb" → [r,g,b]. */
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Cap the device pixel ratio at 2 (per the perf contract). */
export function dpr(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * Reduced-motion, but hydration-safe: server + first client paint report `false`
 * so the markup matches, then the real preference is adopted on the next frame.
 */
export function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted ? !!rm : false;
}

/**
 * DPR-aware backing-store sizing for a CSS-sized canvas. The element's *display*
 * size is driven by CSS (an `aspect-*` class); this only sets `canvas.width/height`
 * to that size × devicePixelRatio (capped at 2) and re-invokes `redraw` whenever it
 * changes. Pass a stable `redraw` (e.g. `useCallback(() => drawRef.current(), [])`).
 */
export function useCanvasDpr(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  redraw: () => void,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const d = dpr();
      const cw = canvas.clientWidth || 480;
      const ch = canvas.clientHeight || cw;
      const w = Math.max(240, Math.min(1600, Math.round(cw * d)));
      const h = Math.max(160, Math.min(1600, Math.round(ch * d)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        redraw();
      }
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(canvas);
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [canvasRef, redraw]);
}

/* ------------------------------------------------------------------ */
/*  Presentation atoms                                                 */
/* ------------------------------------------------------------------ */

/** Eyebrow micro-label — cyan hairline + tracked caps. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
        {children}
      </span>
    </div>
  );
}

/** Pulsing "computed live in WASM" badge — amber dot while computing, else emerald. */
export function LiveBadge({ computing }: { computing: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.2em]"
      style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d`, color: CYAN_GLOW }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full animate-pulse"
        style={{ background: computing ? AMBER : EMERALD, boxShadow: "0 0 6px currentColor" }}
      />
      Computed live in WASM
    </span>
  );
}

/** Header row: eyebrow + title on the left, live badge on the right. */
export function PanelHeader({
  eyebrow,
  title,
  computing,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  computing: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2.5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">{title}</h3>
      </div>
      <LiveBadge computing={computing} />
    </div>
  );
}

/** Cyan control pill (segmented-toggle button). */
export function Pill({
  onClick,
  active,
  color = CYAN,
  children,
  ariaLabel,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  color?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/5",
      )}
      style={{
        borderColor: active ? color : `${color}55`,
        color: active ? BG : color,
        background: active ? color : "transparent",
      }}
    >
      {children}
    </button>
  );
}

/** Labeled range slider with a live tabular-nums readout. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  format,
  color = CYAN,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  format?: (v: number) => string;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex min-w-0 flex-1 items-center gap-2", disabled && "opacity-40")}>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onCommit ? (e) => onCommit(parseFloat((e.target as HTMLInputElement).value)) : undefined}
        onKeyUp={onCommit ? (e) => onCommit(parseFloat((e.target as HTMLInputElement).value)) : undefined}
        aria-label={label}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10"
        style={{ accentColor: color }}
      />
      <span
        className="w-12 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums"
        style={{ color: BRIGHT }}
      >
        {(format ?? ((v: number) => String(v)))(value)}
      </span>
    </label>
  );
}

/** Kernel-error note (amber). */
export function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}
    >
      kernel error: {message}
    </div>
  );
}

/** "Reanimating kernel…" overlay while the shared worker boots. */
export function BootOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${BG}dd` }}>
      <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-amber-300/90 animate-pulse">
        Reanimating kernel…
      </span>
    </div>
  );
}

/** Mono stat/readout strip beneath the visualization. */
export function Readout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
      style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
    >
      <span style={{ color: CYAN_GLOW }}>›</span> {children}
    </div>
  );
}

/** Caption block naming the real kernel + why it's unprecedented in a browser. */
export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
      {children}
    </div>
  );
}
