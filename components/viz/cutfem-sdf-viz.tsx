"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Play, Pause, StepForward, Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const PANEL_BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const AMBER = "#f59e0b";
const LIME = "#a3e635";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Grid + level-set model                                             */
/* ------------------------------------------------------------------ */

const GX0 = 44;
const GY0 = 52;
const CW = 28;
const CH = 28;
const COLS = 24;
const ROWS = 12;
const CX0 = 380;
const CY0 = 220;

const INITIAL_PHASE = 0.4;

interface ShapeParams {
  cx: number;
  cy: number;
  R: number;
  k1: number;
  k2: number;
  p1: number;
  p2: number;
}

function shapeParams(phase: number): ShapeParams {
  return {
    cx: CX0 + 30 * Math.sin(phase * 0.9),
    cy: CY0 + 16 * Math.sin(phase * 0.7 + 1),
    R: 120 + 12 * Math.sin(phase * 0.5),
    k1: 0.18 + 0.05 * Math.sin(phase),
    k2: 0.08 * Math.cos(phase * 0.8),
    p1: phase,
    p2: phase * 1.3 + 0.5,
  };
}

function radiusAt(theta: number, sp: ShapeParams): number {
  return (
    sp.R *
    (1 + sp.k1 * Math.sin(3 * theta + sp.p1) + sp.k2 * Math.sin(5 * theta + sp.p2))
  );
}

/** Signed distance proxy: < 0 inside the shape, > 0 outside. */
function phiAt(x: number, y: number, sp: ShapeParams): number {
  const dx = x - sp.cx;
  const dy = y - sp.cy;
  const r = Math.hypot(dx, dy);
  const th = Math.atan2(dy, dx);
  return r - radiusAt(th, sp);
}

type CellClass = "in" | "cut" | "out";

interface Cell {
  key: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  cls: CellClass;
  quad: { x: number; y: number }[];
}

interface Frame {
  cells: Cell[];
  path: string;
  active: number;
  cut: number;
}

const QUAD_OFFSETS = [0.28, 0.72];

function computeFrame(phase: number): Frame {
  const sp = shapeParams(phase);
  const cells: Cell[] = [];
  let active = 0;
  let cut = 0;

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const x = GX0 + i * CW;
      const y = GY0 + j * CH;
      const c00 = phiAt(x, y, sp);
      const c10 = phiAt(x + CW, y, sp);
      const c01 = phiAt(x, y + CH, sp);
      const c11 = phiAt(x + CW, y + CH, sp);
      const insideCount =
        (c00 < 0 ? 1 : 0) +
        (c10 < 0 ? 1 : 0) +
        (c01 < 0 ? 1 : 0) +
        (c11 < 0 ? 1 : 0);

      let cls: CellClass;
      if (insideCount === 4) cls = "in";
      else if (insideCount === 0) cls = "out";
      else cls = "cut";

      const quad: { x: number; y: number }[] = [];
      if (cls === "in") {
        quad.push({ x: x + CW / 2, y: y + CH / 2 });
      } else if (cls === "cut") {
        // integration points only over the physical (inside) sub-region
        for (const ox of QUAD_OFFSETS) {
          for (const oy of QUAD_OFFSETS) {
            const qx = x + ox * CW;
            const qy = y + oy * CH;
            if (phiAt(qx, qy, sp) < 0) quad.push({ x: qx, y: qy });
          }
        }
      }

      if (cls === "in") active += 1;
      if (cls === "cut") cut += 1;

      cells.push({
        key: `${i}-${j}`,
        x,
        y,
        cx: x + CW / 2,
        cy: y + CH / 2,
        cls,
        quad,
      });
    }
  }

  // boundary contour phi = 0
  const N = 128;
  let path = "";
  for (let k = 0; k <= N; k++) {
    const th = (2 * Math.PI * k) / N;
    const r = radiusAt(th, sp);
    const px = sp.cx + r * Math.cos(th);
    const py = sp.cy + r * Math.sin(th);
    path += `${k === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)} `;
  }
  path += "Z";

  return { cells, path, active, cut };
}

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  color,
  label,
  ariaLabel,
  active,
  children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  ariaLabel: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-xs transition-colors hover:bg-white/5",
      )}
      style={{
        borderColor: `${color}${active ? "" : "44"}`,
        color,
        background: active ? `${color}1a` : "transparent",
      }}
    >
      {children}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function CutfemSdfViz() {
  const reduced = useReducedMotion() ?? false;

  const [phase, setPhase] = useState(INITIAL_PHASE);
  const [playing, setPlaying] = useState(false);
  const [showQuad, setShowQuad] = useState(false);
  const [hovered, setHovered] = useState<Cell | null>(null);

  const frame = useMemo(() => computeFrame(phase), [phase]);

  /* ---- continuous play (cleaned up on unmount / stop) ---- */
  useEffect(() => {
    if (!playing || reduced) return;
    const id = setInterval(() => setPhase((p) => p + 0.05), 60);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const stepOnce = useCallback(() => {
    setPhase((p) => p + (reduced ? 0.6 : 0.4));
  }, [reduced]);

  const togglePlay = useCallback(() => {
    if (reduced) {
      stepOnce();
      return;
    }
    setPlaying((p) => !p);
  }, [reduced, stepOnce]);

  const reset = useCallback(() => {
    setPlaying(false);
    setPhase(INITIAL_PHASE);
    setShowQuad(false);
    setHovered(null);
  }, []);

  const total = COLS * ROWS;
  const outside = total - frame.active - frame.cut;
  const readout = `active ${frame.active} · cut ${frame.cut} · meshing steps: 0`;
  const sp = shapeParams(phase);

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
            style={{ backgroundColor: CYAN_GLOW, boxShadow: `0 0 8px ${CYAN_GLOW}aa` }}
          />
          <span className="font-mono text-xs sm:text-sm" style={{ color: BRIGHT }}>
            {readout}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CtrlButton
            onClick={stepOnce}
            color={CYAN}
            label="Step"
            ariaLabel="Step the level set forward"
          >
            <StepForward size={12} />
          </CtrlButton>
          <CtrlButton
            onClick={togglePlay}
            color={CYAN_GLOW}
            label={playing ? "Pause" : "Play"}
            ariaLabel={playing ? "Pause level-set morphing" : "Play level-set morphing"}
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </CtrlButton>
          <CtrlButton
            onClick={() => setShowQuad((q) => !q)}
            color={LIME}
            label="Quadrature"
            ariaLabel="Toggle integration quadrature points"
            active={showQuad}
          >
            <Sparkles size={12} />
          </CtrlButton>
          <CtrlButton
            onClick={reset}
            color={SLATE}
            label="Reset"
            ariaLabel="Reset the level set"
          >
            <RotateCcw size={12} />
          </CtrlButton>
        </div>
      </div>

      {/* SVG canvas */}
      <svg
        viewBox="0 0 760 460"
        className="w-full"
        style={{ maxHeight: 520 }}
        role="img"
        aria-label="CutFEM classification of a background grid against a signed-distance level set: interior, cut, and inactive cells with zero body-fitted meshing"
      >
        <defs>
          <pattern
            id="cutfem-hatch"
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={6} stroke={AMBER} strokeWidth={1} opacity={0.45} />
          </pattern>
          <filter id="cutfem-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background grid lines */}
        <g stroke={SLATE} strokeWidth={0.5} opacity={0.18}>
          {Array.from({ length: COLS + 1 }, (_, i) => (
            <line
              key={`vx-${i}`}
              x1={GX0 + i * CW}
              y1={GY0}
              x2={GX0 + i * CW}
              y2={GY0 + ROWS * CH}
            />
          ))}
          {Array.from({ length: ROWS + 1 }, (_, j) => (
            <line
              key={`hz-${j}`}
              x1={GX0}
              y1={GY0 + j * CH}
              x2={GX0 + COLS * CW}
              y2={GY0 + j * CH}
            />
          ))}
        </g>

        {/* Classified cells */}
        {frame.cells.map((c) => {
          if (c.cls === "out") return null;
          if (c.cls === "in") {
            return (
              <rect
                key={c.key}
                x={c.x + 0.5}
                y={c.y + 0.5}
                width={CW - 1}
                height={CH - 1}
                fill={`${CYAN}14`}
                stroke={`${CYAN}26`}
                strokeWidth={0.5}
              />
            );
          }
          // cut cell
          const isHover = hovered?.key === c.key;
          return (
            <g
              key={c.key}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(c)}
              onMouseLeave={() => setHovered((h) => (h?.key === c.key ? null : h))}
            >
              <rect x={c.x} y={c.y} width={CW} height={CH} fill={`${AMBER}12`} />
              <rect x={c.x} y={c.y} width={CW} height={CH} fill="url(#cutfem-hatch)" />
              <rect
                x={c.x + 0.5}
                y={c.y + 0.5}
                width={CW - 1}
                height={CH - 1}
                fill="none"
                stroke={AMBER}
                strokeWidth={isHover ? 1.8 : 1}
                opacity={isHover ? 1 : 0.85}
              />
            </g>
          );
        })}

        {/* phi = 0 boundary */}
        <path
          d={frame.path}
          fill="none"
          stroke={CYAN_GLOW}
          strokeWidth={2.4}
          strokeLinejoin="round"
          filter="url(#cutfem-glow)"
        />

        {/* Quadrature points */}
        <AnimatePresence>
          {showQuad && (
            <motion.g
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
            >
              {frame.cells.map((c) =>
                c.quad.map((q, qi) => (
                  <circle
                    key={`${c.key}-q${qi}`}
                    cx={q.x}
                    cy={q.y}
                    r={1.7}
                    fill={c.cls === "cut" ? AMBER : LIME}
                    opacity={0.9}
                  />
                )),
              )}
            </motion.g>
          )}
        </AnimatePresence>

        {/* phi labels */}
        <text
          x={sp.cx}
          y={sp.cy + 4}
          textAnchor="middle"
          fill={`${CYAN_GLOW}cc`}
          fontSize={12}
          fontFamily="monospace"
          style={{ pointerEvents: "none" }}
        >
          φ &lt; 0
        </text>
        <text
          x={GX0 + COLS * CW - 6}
          y={GY0 + 16}
          textAnchor="end"
          fill={`${MUTED}99`}
          fontSize={11}
          fontFamily="monospace"
          style={{ pointerEvents: "none" }}
        >
          φ &gt; 0 · inactive
        </text>

        {/* Hover tooltip for cut cells */}
        {hovered && hovered.cls === "cut" && (
          <g style={{ pointerEvents: "none" }}>
            <line
              x1={hovered.cx}
              y1={hovered.y}
              x2={Math.min(Math.max(hovered.cx, 168), 592)}
              y2={hovered.y - 14}
              stroke={AMBER}
              strokeWidth={1}
              opacity={0.7}
            />
            <g
              transform={`translate(${Math.min(Math.max(hovered.cx, 168), 592)} ${Math.max(hovered.y - 40, 20)})`}
            >
              <rect
                x={-158}
                y={-16}
                width={316}
                height={26}
                rx={8}
                fill={BG}
                stroke={AMBER}
                strokeWidth={1}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                fill={AMBER}
                fontSize={11}
                fontFamily="monospace"
              >
                cut cell — ghost penalty + Nitsche BC
              </text>
            </g>
          </g>
        )}

        {/* status footer */}
        <text
          x={44}
          y={444}
          fill={`${MUTED}bb`}
          fontSize={11}
          fontFamily="monospace"
        >
          zero body-fitted mesh · outside {outside} cells inactive · hover a cut cell
        </text>
      </svg>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: PANEL_BORDER, color: MUTED }}
      >
        <LegendChip color={CYAN} text="interior (active)" swatch="fill" />
        <LegendChip color={AMBER} text="cut cell · ghost + Nitsche" swatch="hatch" />
        <LegendChip color={SLATE} text="outside (inactive)" swatch="grid" />
        <LegendChip color={LIME} text="quadrature point" swatch="dot" />
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
  swatch,
}: {
  color: string;
  text: string;
  swatch: "fill" | "hatch" | "grid" | "dot";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={16} height={12} aria-hidden="true">
        {swatch === "fill" && (
          <rect x={1} y={2} width={14} height={8} rx={2} fill={`${color}30`} stroke={color} strokeWidth={1} />
        )}
        {swatch === "hatch" && (
          <>
            <rect x={1} y={2} width={14} height={8} rx={2} fill="none" stroke={color} strokeWidth={1} />
            <line x1={3} y1={10} x2={9} y2={2} stroke={color} strokeWidth={1} opacity={0.7} />
            <line x1={7} y1={10} x2={13} y2={2} stroke={color} strokeWidth={1} opacity={0.7} />
          </>
        )}
        {swatch === "grid" && (
          <rect x={1} y={2} width={14} height={8} rx={2} fill="none" stroke={color} strokeWidth={0.8} opacity={0.5} />
        )}
        {swatch === "dot" && <circle cx={8} cy={6} r={2.4} fill={color} />}
      </svg>
      <span style={{ color }}>{text}</span>
    </span>
  );
}
