"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Scissors, ShieldCheck, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const PANEL_BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Geometry model                                                     */
/* ------------------------------------------------------------------ */

type TileId = "A" | "B" | "C" | "D";
type SeamId = "AB" | "BC" | "CD" | "DA";

interface Tile {
  id: TileId;
  x: number;
  y: number;
  w: number;
  h: number;
}

const TILES: Tile[] = [
  { id: "A", x: 132, y: 78, w: 220, h: 151 },
  { id: "B", x: 368, y: 78, w: 220, h: 151 },
  { id: "C", x: 368, y: 241, w: 220, h: 151 },
  { id: "D", x: 132, y: 241, w: 220, h: 151 },
];

interface Seam {
  id: SeamId;
  a: TileId;
  b: TileId;
  o: "v" | "h";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const SEAM_X = 360;
const SEAM_Y = 235;

const SEAMS: Seam[] = [
  { id: "AB", a: "A", b: "B", o: "v", x1: SEAM_X, y1: 78, x2: SEAM_X, y2: 229 },
  { id: "BC", a: "B", b: "C", o: "h", x1: 368, y1: SEAM_Y, x2: 588, y2: SEAM_Y },
  { id: "CD", a: "C", b: "D", o: "v", x1: SEAM_X, y1: 241, x2: SEAM_X, y2: 392 },
  { id: "DA", a: "D", b: "A", o: "h", x1: 132, y1: SEAM_Y, x2: 352, y2: SEAM_Y },
];

const SEAM_LABEL: Record<SeamId, string> = {
  AB: "seam(A,B)",
  BC: "seam(B,C)",
  CD: "seam(C,D)",
  DA: "seam(D,A)",
};

const TILE_ADJ: Record<TileId, SeamId[]> = {
  A: ["AB", "DA"],
  B: ["AB", "BC"],
  C: ["BC", "CD"],
  D: ["CD", "DA"],
};

const EMPTY: Record<SeamId, boolean> = {
  AB: false,
  BC: false,
  CD: false,
  DA: false,
};

/* ------------------------------------------------------------------ */
/*  Stitch geometry                                                    */
/* ------------------------------------------------------------------ */

interface Tick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function seamTicks(seam: Seam): Tick[] {
  const ticks: Tick[] = [];
  const half = 9;
  if (seam.o === "v") {
    const len = seam.y2 - seam.y1;
    const n = Math.max(4, Math.round(len / 24));
    for (let i = 0; i <= n; i++) {
      const y = seam.y1 + 8 + ((len - 16) * i) / n;
      ticks.push({ x1: SEAM_X - half, y1: y, x2: SEAM_X + half, y2: y });
    }
  } else {
    const len = seam.x2 - seam.x1;
    const n = Math.max(4, Math.round(len / 24));
    for (let i = 0; i <= n; i++) {
      const x = seam.x1 + 8 + ((len - 16) * i) / n;
      ticks.push({ x1: x, y1: SEAM_Y - half, x2: x, y2: SEAM_Y + half });
    }
  }
  return ticks;
}

function gapBand(seam: Seam) {
  if (seam.o === "v")
    return {
      x: SEAM_X - 7,
      y: seam.y1,
      w: 14,
      h: seam.y2 - seam.y1,
    };
  return {
    x: seam.x1,
    y: SEAM_Y - 7,
    w: seam.x2 - seam.x1,
    h: 14,
  };
}

function seamMid(seam: Seam) {
  return { x: (seam.x1 + seam.x2) / 2, y: (seam.y1 + seam.y2) / 2 };
}

/* ------------------------------------------------------------------ */
/*  Seam view                                                          */
/* ------------------------------------------------------------------ */

function SeamView({
  seam,
  obstructed,
  reduced,
  onToggle,
}: {
  seam: Seam;
  obstructed: boolean;
  reduced: boolean;
  onToggle: () => void;
}) {
  const ticks = seamTicks(seam);
  const band = gapBand(seam);
  const mid = seamMid(seam);
  const badgeX = seam.o === "v" ? mid.x + 34 : mid.x;
  const badgeY = seam.o === "v" ? mid.y : mid.y - 22;

  return (
    <g style={{ cursor: "pointer" }} onClick={onToggle}>
      {/* hit target */}
      <line
        x1={seam.x1}
        y1={seam.y1}
        x2={seam.x2}
        y2={seam.y2}
        stroke="transparent"
        strokeWidth={20}
      />
      <AnimatePresence mode="wait">
        {obstructed ? (
          <motion.g
            key="ob"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
          >
            {/* leak band */}
            <motion.rect
              x={band.x}
              y={band.y}
              width={band.w}
              height={band.h}
              rx={4}
              fill={`${ROSE}26`}
              stroke={ROSE}
              strokeWidth={1}
              initial={{ opacity: reduced ? 1 : 0, scaleY: reduced ? 1 : 0.4 }}
              animate={{ opacity: 1, scaleY: 1 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              transition={{ duration: reduced ? 0 : 0.3 }}
            />
            {/* broken thread */}
            <line
              x1={seam.x1}
              y1={seam.y1}
              x2={seam.x2}
              y2={seam.y2}
              stroke={ROSE}
              strokeWidth={1.4}
              strokeDasharray="2 7"
              opacity={0.85}
            />
            {/* pulsing obstruction core */}
            <motion.circle
              cx={mid.x}
              cy={mid.y}
              r={5}
              fill={ROSE}
              animate={reduced ? undefined : { opacity: [0.4, 1, 0.4], r: [4, 6, 4] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* badge */}
            <g transform={`translate(${badgeX} ${badgeY})`}>
              <rect
                x={-30}
                y={-10}
                width={60}
                height={20}
                rx={10}
                fill={`${ROSE}22`}
                stroke={ROSE}
                strokeWidth={1}
              />
              <circle cx={-18} cy={0} r={3} fill={ROSE} />
              <text
                x={4}
                y={4}
                textAnchor="middle"
                fill={ROSE}
                fontSize={10}
                fontFamily="monospace"
                fontWeight={600}
              >
                leak
              </text>
            </g>
          </motion.g>
        ) : (
          <motion.g
            key="ok"
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            {/* thread */}
            <line
              x1={seam.x1}
              y1={seam.y1}
              x2={seam.x2}
              y2={seam.y2}
              stroke={CYAN}
              strokeWidth={1}
              strokeDasharray="1 5"
              opacity={0.5}
            />
            {/* sutures draw in sequence (coboundary repair) */}
            {ticks.map((t, i) => (
              <motion.line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={CYAN_GLOW}
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ pathLength: reduced ? 1 : 0, opacity: 0.9 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: reduced ? 0 : 0.18,
                  delay: reduced ? 0 : i * 0.05,
                  ease: "easeOut",
                }}
              />
            ))}
          </motion.g>
        )}
      </AnimatePresence>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  color,
  label,
  ariaLabel,
  disabled,
  children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-xs transition-colors hover:bg-white/5",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
      style={{ borderColor: `${color}44`, color }}
    >
      {children}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SheafWatertightnessViz() {
  const reduced = useReducedMotion() ?? false;

  const [obstructed, setObstructed] = useState<Record<SeamId, boolean>>({
    ...EMPTY,
  });
  const [flash, setFlash] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const toggleSeam = useCallback((id: SeamId) => {
    setObstructed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const injectGap = useCallback(() => {
    setObstructed((prev) => ({ ...prev, BC: true }));
  }, []);

  const repair = useCallback(() => {
    clearTimers();
    setObstructed({ ...EMPTY });
    setFlash(true);
    const t = setTimeout(() => setFlash(false), reduced ? 0 : 700);
    timersRef.current.push(t);
  }, [clearTimers, reduced]);

  const reset = useCallback(() => {
    clearTimers();
    setObstructed({ ...EMPTY });
    setFlash(false);
  }, [clearTimers]);

  /* ---- derived ---- */
  const leaks = SEAMS.filter((s) => obstructed[s.id]);
  const h1 = leaks.length;
  const watertight = h1 === 0;
  const statusColor = watertight ? EMERALD : ROSE;
  const readout = watertight
    ? "H¹ = 0  —  watertight ✓ manifold"
    : `H¹ = ${h1}  —  leak on ${leaks.map((s) => SEAM_LABEL[s.id]).join(", ")}  (coboundary · auto-fixable)`;

  const tileLeaking = (id: TileId) =>
    TILE_ADJ[id].some((sid) => obstructed[sid]);

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border"
      style={{ background: SURFACE, borderColor: PANEL_BORDER }}
    >
      {/* Header control bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: PANEL_BORDER, background: BG }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: statusColor,
              boxShadow: `0 0 8px ${statusColor}aa`,
            }}
          />
          <span
            className="font-mono text-xs sm:text-sm"
            style={{ color: watertight ? EMERALD : ROSE }}
          >
            {readout}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CtrlButton
            onClick={injectGap}
            color={ROSE}
            label="Inject gap"
            ariaLabel="Inject a gap on the interface between chart B and C"
            disabled={obstructed.BC}
          >
            <Scissors size={12} />
          </CtrlButton>
          <CtrlButton
            onClick={repair}
            color={EMERALD}
            label="Repair"
            ariaLabel="Repair all leaks with a coboundary auto-fix"
            disabled={watertight}
          >
            <ShieldCheck size={12} />
          </CtrlButton>
          <CtrlButton
            onClick={reset}
            color={SLATE}
            label="Reset"
            ariaLabel="Reset the sheaf gluing"
          >
            <RotateCcw size={12} />
          </CtrlButton>
        </div>
      </div>

      {/* SVG canvas */}
      <svg
        viewBox="0 0 720 470"
        className="w-full"
        style={{ maxHeight: 520 }}
        role="img"
        aria-label="Cellular sheaf gluing four chart patches along interface seams; a non-vanishing interface cocycle marks a watertightness leak"
      >
        <defs>
          <filter id="sheaf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* watertight flash halo */}
        <AnimatePresence>
          {flash && watertight && (
            <motion.rect
              x={132}
              y={78}
              width={456}
              height={314}
              rx={18}
              fill="none"
              stroke={EMERALD}
              strokeWidth={2}
              filter="url(#sheaf-glow)"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.7 }}
            />
          )}
        </AnimatePresence>

        {/* Tiles */}
        {TILES.map((t) => {
          const leaking = tileLeaking(t.id);
          return (
            <g key={t.id}>
              <motion.rect
                x={t.x}
                y={t.y}
                width={t.w}
                height={t.h}
                rx={12}
                fill={`${CYAN}12`}
                stroke={leaking ? ROSE : CYAN}
                strokeWidth={1.2}
                animate={{
                  stroke: leaking ? ROSE : CYAN,
                  fill: leaking ? `${ROSE}0e` : `${CYAN}12`,
                }}
                transition={{ duration: reduced ? 0 : 0.3 }}
              />
              {/* faint chart texture */}
              <line
                x1={t.x + 18}
                y1={t.y + t.h - 18}
                x2={t.x + t.w - 18}
                y2={t.y + 30}
                stroke={CYAN}
                strokeWidth={1}
                strokeDasharray="2 6"
                opacity={0.16}
              />
              <text
                x={t.x + t.w / 2}
                y={t.y + t.h / 2 + 2}
                textAnchor="middle"
                fill={`${BRIGHT}22`}
                fontSize={54}
                fontFamily="monospace"
                fontWeight={700}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {t.id}
              </text>
              <text
                x={t.x + 14}
                y={t.y + 22}
                fill={leaking ? ROSE : `${CYAN_GLOW}cc`}
                fontSize={11}
                fontFamily="monospace"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                U_{t.id} chart
              </text>
            </g>
          );
        })}

        {/* Seams */}
        {SEAMS.map((s) => (
          <SeamView
            key={s.id}
            seam={s}
            obstructed={obstructed[s.id]}
            reduced={reduced}
            onToggle={() => toggleSeam(s.id)}
          />
        ))}

        {/* central gluing node δ */}
        <circle
          cx={SEAM_X}
          cy={SEAM_Y}
          r={4}
          fill={watertight ? EMERALD : ROSE}
          opacity={0.85}
        />

        {/* hint */}
        <text
          x={360}
          y={452}
          textAnchor="middle"
          fill={`${MUTED}bb`}
          fontSize={11}
          fontFamily="monospace"
        >
          click a seam to toggle its interface cochain · δ = coboundary operator
        </text>
      </svg>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: PANEL_BORDER, color: MUTED }}
      >
        <LegendChip color={CYAN_GLOW} text="seam consistent (δc = 0)" kind="stitch" />
        <LegendChip color={ROSE} text="seam obstruction (δc ≠ 0)" kind="gap" />
        <span style={{ color: SLATE }}>H¹ = 0 ⇔ watertight manifold</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legend chip                                                        */
/* ------------------------------------------------------------------ */

function LegendChip({
  color,
  text,
  kind,
}: {
  color: string;
  text: string;
  kind: "stitch" | "gap";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={22} height={12} aria-hidden="true">
        {kind === "stitch" ? (
          <>
            <line x1={2} y1={6} x2={20} y2={6} stroke={color} strokeWidth={1} strokeDasharray="1 3" opacity={0.6} />
            <line x1={5} y1={2} x2={5} y2={10} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <line x1={11} y1={2} x2={11} y2={10} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <line x1={17} y1={2} x2={17} y2={10} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : (
          <rect x={2} y={3} width={18} height={6} rx={3} fill={`${color}30`} stroke={color} strokeWidth={1} />
        )}
      </svg>
      <span style={{ color }}>{text}</span>
    </span>
  );
}
