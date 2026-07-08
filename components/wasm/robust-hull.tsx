"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { Hexagon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView, useEasedText } from "@/lib/use-viz-anim";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */
const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const AMBER = "#fbbf24";
const ROSE = "#f43f5e";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";

function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Defer past hydration so the first client render matches the server (false),
    // then adopt the real preference — without a synchronous setState in the effect.
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted ? !!rm : false;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="h-px w-8" style={{ background: `${CYAN}66` }} />
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">{children}</span>
    </div>
  );
}

function LiveBadge({ computing }: { computing: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.2em]"
      style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d`, color: CYAN_GLOW }}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", computing && "animate-pulse")}
        style={{ background: computing ? AMBER : EMERALD, boxShadow: "0 0 6px currentColor" }}
      />
      {computing ? "Computing…" : "Computed live in WASM"}
    </span>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}
    >
      <AlertTriangle size={13} />
      kernel error: {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Compute state                                                      */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

interface HullState {
  radius: number;
  points: Pt[];
  hull: Pt[];
  collinear: Set<string>; // lattice points that lie ON a hull edge (dropped by strict hull)
  collinearEdges: Pt[][]; // hull edges [a,b] that carry ≥1 collinear point
  ms: number;
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Integer collinearity via an exact cross product — the same predicate class
 * (orient2d == 0) the kernel uses. Finds points ON a hull edge (not a vertex),
 * and flags the edges that carry such degenerate collinear runs.
 */
function analyzeBoundary(points: Pt[], hull: Pt[]): { collinear: Set<string>; edges: Pt[][] } {
  const vertexKeys = new Set(hull.map(([x, y]) => key(x, y)));
  const collinear = new Set<string>();
  const edges: Pt[][] = [];
  const H = hull.length;
  for (let e = 0; e < H; e++) {
    const [ax, ay] = hull[e];
    const [bx, by] = hull[(e + 1) % H];
    let edgeHasCollinear = false;
    for (const [px, py] of points) {
      if (vertexKeys.has(key(px, py))) continue;
      const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
      if (cross !== 0) continue;
      // strictly between a and b?
      const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
      const len2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
      if (dot > 0 && dot < len2) {
        collinear.add(key(px, py));
        edgeHasCollinear = true;
      }
    }
    if (edgeHasCollinear) edges.push([hull[e], hull[(e + 1) % H]]);
  }
  return { collinear, edges };
}

export default function RobustHull() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [radius, setRadius] = useState(7);
  const [computing, setComputing] = useState(false);
  const [state, setState] = useState<HullState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const t0 = performance.now();
          const out = await call<Float64Array>("robust_hull", radius);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          const P = out[0];
          const points: Pt[] = [];
          for (let i = 0; i < P; i++) points.push([out[1 + 2 * i], out[2 + 2 * i]]);
          const hBase = 1 + 2 * P;
          const H = out[hBase];
          const hull: Pt[] = [];
          for (let j = 0; j < H; j++) hull.push([out[hBase + 1 + 2 * j], out[hBase + 2 + 2 * j]]);
          const { collinear, edges } = analyzeBoundary(points, hull);
          setState({ radius, points, hull, collinear, collinearEdges: edges, ms });
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 80);
    return () => clearTimeout(timer);
  }, [ready, radius, call]);

  /* ---- geometry ---- */
  const VW = 600;
  const VH = 600;
  const pad = 44;

  const geom = useMemo(() => {
    if (!state) return null;
    const dom = state.radius + 0.8;
    const scale = (VW - 2 * pad) / (2 * dom);
    const mapX = (x: number) => VW / 2 + x * scale;
    const mapY = (y: number) => VH / 2 - y * scale;
    const hullPath =
      state.hull.length > 0
        ? state.hull.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${mapX(x).toFixed(2)} ${mapY(y).toFixed(2)}`).join(" ") + " Z"
        : "";
    const gridLines: number[] = [];
    for (let g = -state.radius; g <= state.radius; g++) gridLines.push(g);
    return { scale, mapX, mapY, hullPath, gridLines, diskR: state.radius * scale };
  }, [state]);

  const stats = useMemo(() => {
    if (!state) return null;
    return { P: state.points.length, H: state.hull.length, C: state.collinear.size };
  }, [state]);

  /* ---- glowing lattice points on a high-DPI canvas (reveal from center out) ---- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state || !geom) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const maxD = state.radius || 1;
    const paint = (progress: number) => {
      ctx.setTransform(2, 0, 0, 2, 0, 0); // 1200 backing → 600 logical, crisp
      ctx.clearRect(0, 0, VW, VH);

      // disk glow fill
      const gr = ctx.createRadialGradient(VW / 2, VH / 2, geom.diskR * 0.1, VW / 2, VH / 2, geom.diskR);
      gr.addColorStop(0, "rgba(34,211,238,0.10)");
      gr.addColorStop(0.7, "rgba(168,85,247,0.05)");
      gr.addColorStop(1, "rgba(4,9,13,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(VW / 2, VH / 2, geom.diskR, 0, Math.PI * 2);
      ctx.fill();

      for (const [x, y] of state.points) {
        if (state.collinear.has(key(x, y))) continue; // collinear drawn as SVG rings
        const d = Math.sqrt(x * x + y * y) / maxD;
        const a = Math.max(0, Math.min(1, (progress - d * 0.8) / 0.2));
        if (a <= 0) continue;
        const px = geom.mapX(x);
        const py = geom.mapY(y);
        ctx.globalAlpha = a * 0.9;
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = "#9fb4c4";
        ctx.shadowColor = CYAN_GLOW;
        ctx.shadowBlur = 6 * a;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    // Reduced-motion, or a reveal that landed while off-screen: paint the final
    // frame once, no rAF. (Radius changes only happen while interacting on-screen.)
    if (reduced || !inViewRef.current) {
      paint(1);
      return;
    }
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      paint(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [state, geom, reduced, inViewRef]);

  const easedHRef = useEasedText<HTMLSpanElement>(stats ? stats.H : 0, reduced, (v) => String(Math.round(v)), {
    duration: 700,
    enabled: !!stats,
    inViewRef,
  });

  return (
    <SyncContainer withPulse accentColor="#06b6d4" className="p-4 md:p-6 bg-black/40">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Eyebrow>Demo 10 · fs-ivl · exact orient2d</Eyebrow>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${CYAN}33`, background: `${CYAN}12`, color: CYAN }}
            >
              <Hexagon className="h-5 w-5" />
            </div>
            <h3 className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              Geometry that never <span className="text-cyan-400">lies</span>.
            </h3>
          </div>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* plot: canvas points under an SVG overlay */}
      <div ref={viewRef} className="relative mx-auto min-w-0 aspect-square w-full max-w-[600px] overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas ref={canvasRef} width={VW * 2} height={VH * 2} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Integer lattice points inside a disk with the exact convex hull drawn as a glowing polygon; collinear boundary points that a strict hull correctly excludes are highlighted, and the degenerate edges that carry them are marked."
        >
          <defs>
            <filter id="hull-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="hull-fill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={CYAN} stopOpacity="0.16" />
              <stop offset="100%" stopColor={CYAN} stopOpacity="0.02" />
            </radialGradient>
          </defs>

          {geom && state && (
            <>
              {/* integer gridlines */}
              {geom.gridLines.map((g) => (
                <g key={`grid-${g}`}>
                  <line x1={geom.mapX(g)} y1={pad} x2={geom.mapX(g)} y2={VH - pad} stroke={`${SLATE}0e`} />
                  <line x1={pad} y1={geom.mapY(g)} x2={VW - pad} y2={geom.mapY(g)} stroke={`${SLATE}0e`} />
                </g>
              ))}

              {/* the disk (idle pulse) */}
              <motion.circle
                cx={VW / 2}
                cy={VH / 2}
                r={geom.diskR}
                fill="none"
                stroke={`${VIOLET}66`}
                strokeWidth={1.2}
                strokeDasharray="4 6"
                animate={inView && !reduced ? { opacity: [0.5, 0.85, 0.5] } : undefined}
                transition={inView && !reduced ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : undefined}
              />

              {/* degenerate collinear edge runs — rose highlight under the hull outline */}
              {state.collinearEdges.map(([a, b], i) => (
                <line
                  key={`ce-${i}`}
                  x1={geom.mapX(a[0])}
                  y1={geom.mapY(a[1])}
                  x2={geom.mapX(b[0])}
                  y2={geom.mapY(b[1])}
                  stroke={`${ROSE}88`}
                  strokeWidth={6}
                  strokeLinecap="round"
                  filter="url(#hull-glow)"
                />
              ))}

              {/* hull fill + glowing outline (sweeps closed) */}
              {geom.hullPath && (
                <>
                  <path d={geom.hullPath} fill="url(#hull-fill)" />
                  <motion.path
                    key={`hull-${state.radius}`}
                    d={geom.hullPath}
                    fill="none"
                    stroke={CYAN_GLOW}
                    strokeWidth={2.6}
                    strokeLinejoin="round"
                    filter="url(#hull-glow)"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={reduced ? { duration: 0 } : { duration: 1, ease: "easeInOut" }}
                  />
                </>
              )}

              {/* collinear boundary points — the degenerate case, exactly excluded */}
              {state.points.map(([x, y], i) => {
                if (!state.collinear.has(key(x, y))) return null;
                return (
                  <motion.g
                    key={`c-${state.radius}-${i}`}
                    initial={reduced ? false : { opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={reduced ? { duration: 0 } : { duration: 0.3, delay: 0.5 + (i % 8) * 0.02 }}
                    style={{ transformOrigin: "center", transformBox: "fill-box" } as React.CSSProperties}
                  >
                    <circle cx={geom.mapX(x)} cy={geom.mapY(y)} r={4.5} fill="none" stroke={ROSE} strokeWidth={1.5} />
                    <circle cx={geom.mapX(x)} cy={geom.mapY(y)} r={1.8} fill={ROSE} />
                  </motion.g>
                );
              })}

              {/* hull vertices (pop in after the sweep) */}
              {state.hull.map(([x, y], i) => (
                <motion.circle
                  key={`v-${state.radius}-${i}`}
                  cx={geom.mapX(x)}
                  cy={geom.mapY(y)}
                  r={5}
                  fill={CYAN_GLOW}
                  stroke={BG}
                  strokeWidth={1.5}
                  filter="url(#hull-glow)"
                  initial={reduced ? false : { opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.3, delay: 1 + (i / Math.max(1, state.hull.length)) * 0.5, ease: "backOut" }}
                  style={{ transformOrigin: "center", transformBox: "fill-box" } as React.CSSProperties}
                />
              ))}

              {/* legend */}
              <g transform={`translate(${pad + 6}, ${pad + 6})`}>
                <rect x={0} y={0} width={200} height={80} rx={6} fill={`${BG}dd`} stroke={BORDER} />
                <circle cx={12} cy={14} r={5} fill={CYAN_GLOW} />
                <text x={26} y={17} fontFamily="monospace" fontSize={9} fill={MUTED}>
                  hull vertex (strict CCW)
                </text>
                <circle cx={12} cy={32} r={4.5} fill="none" stroke={ROSE} strokeWidth={1.4} />
                <text x={26} y={35} fontFamily="monospace" fontSize={9} fill={MUTED}>
                  collinear — correctly dropped
                </text>
                <line x1={6} y1={50} x2={18} y2={50} stroke={`${ROSE}88`} strokeWidth={4} strokeLinecap="round" />
                <text x={26} y={53} fontFamily="monospace" fontSize={9} fill={MUTED}>
                  degenerate edge run
                </text>
                <circle cx={12} cy={68} r={2.6} fill="#9fb4c4" />
                <text x={26} y={71} fontFamily="monospace" fontSize={9} fill={MUTED}>
                  interior lattice point
                </text>
              </g>
            </>
          )}

          {!ready && (
            <text x={VW / 2} y={VH / 2} textAnchor="middle" fontFamily="monospace" fontSize={13} fill={`${AMBER}cc`}>
              REANIMATING KERNEL…
            </text>
          )}
        </svg>
      </div>

      {/* stat cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${SLATE}44`, background: `${SLATE}12` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            lattice points
          </div>
          <div className="font-mono text-2xl font-black tabular-nums" style={{ color: BRIGHT }}>
            {stats ? stats.P : "—"}
          </div>
          <div className="font-mono text-[9px]" style={{ color: SLATE }}>
            integer x²+y² ≤ r²
          </div>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${CYAN}33`, background: `${CYAN}0d` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            hull vertices
          </div>
          <div className="font-mono text-2xl font-black tabular-nums" style={{ color: CYAN_GLOW }}>
            {stats ? <span ref={easedHRef} /> : "—"}
          </div>
          <div className="font-mono text-[9px]" style={{ color: SLATE }}>
            strict CCW · no collinear
          </div>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${ROSE}33`, background: `${ROSE}0d` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            collinear boundary pts
          </div>
          <div className="font-mono text-2xl font-black tabular-nums" style={{ color: ROSE }}>
            {stats ? stats.C : "—"}
          </div>
          <div className="font-mono text-[9px]" style={{ color: SLATE }}>
            exactly excluded (orient2d = 0)
          </div>
        </div>
      </div>

      {error && <div className="mt-3">{<ErrorNote message={error} />}</div>}

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-3">
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
            disk radius = {radius}
          </span>
          <input
            type="range"
            min={3}
            max={11}
            step={1}
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value, 10))}
            disabled={!ready}
            aria-label="Disk radius"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 disabled:opacity-40"
            style={{ accentColor: CYAN }}
          />
        </div>
      </div>

      {/* readout */}
      <div className="mt-4 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> disk r={radius} · exact adaptive orient2d predicates
        {stats && state ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> {stats.P} points →{" "}
            <span style={{ color: CYAN_GLOW }}>{stats.H}-gon hull</span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: ROSE }}>{stats.C} collinear excluded</span>{" "}
            <span style={{ color: MUTED }}>│</span> {state.ms.toFixed(1)} ms
          </>
        ) : (
          <span style={{ color: MUTED }}> · reanimating kernel…</span>
        )}
      </div>

      {/* caption */}
      <div className="mt-5 border-t pt-4 text-sm leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Exact geometric predicates:{" "}
        <span className="font-mono text-cyan-300">fs-ivl</span>&apos;s adaptive Shewchuk-style{" "}
        <span className="font-mono text-cyan-300">orient2d</span> builds the convex hull of every integer lattice point
        in the disk. The boundary is packed with{" "}
        <span style={{ color: ROSE }}>collinear runs</span> (highlighted): points sitting exactly on a hull edge, the
        precise near-degenerate input where floating-point CAD kernels flip an orientation sign and emit a wrong,
        self-intersecting hull. Here the orientation test is provably correct, so the {stats ? `${stats.H}` : ""}-vertex
        hull comes out strictly convex every time. That is real certified computational geometry, live in wasm.
      </div>
    </SyncContainer>
  );
}
