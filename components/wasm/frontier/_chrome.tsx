"use client";

/**
 * Shared chrome for the FrankenSim "Frontier" tier — the mostly-3D, WebGL-driven
 * showpiece demos. Pure presentation + a couple of tiny helpers; every one of the
 * five frontier panels owns its own <SyncContainer>, kernel call, and Three.js /
 * canvas scene. This file only exists so the five don't each re-declare the same
 * eyebrow / badge / pill / slider / colors.
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/motion";
import { cn } from "@/lib/utils";

/* -- Palette (FrankenSim cyan/teal) -- */
export const BG = "#04090d";
export const SURFACE = "#08131a";
export const BORDER = "rgba(34,211,238,0.14)";
export const CYAN = "#06b6d4";
export const CYAN_GLOW = "#22d3ee";
export const VIOLET = "#a855f7";
export const TEAL = "#14b8a6";
export const EMERALD = "#10b981";
export const AMBER = "#fbbf24";
export const ROSE = "#fb7185";
export const MUTED = "#94a3b8";
export const BRIGHT = "#e2e8f0";

/** Float64 kernel output → Float32 for GPU buffers / textures. */
export function toF32(src: Float64Array, len = src.length, offset = 0): Float32Array {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = src[offset + i];
  return out;
}

/** Cap the device pixel ratio at 2 (per perf contract). */
export function dpr(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * Reduced-motion, but hydration-safe: server + first client paint report `false`
 * so markup matches, then the real preference is adopted on the next frame.
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

/* -- Eyebrow micro-label -- */
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

/* -- Pulsing "computed live in WASM" badge -- */
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

/* -- Cyan control pill -- */
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

/* -- Labeled slider -- */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
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

/* -- Kernel-error note -- */
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

/* -- "Reanimating kernel…" overlay while the worker boots -- */
export function BootOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${BG}dd` }}>
      <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-amber-300/90 animate-pulse">
        Reanimating kernel…
      </span>
    </div>
  );
}
