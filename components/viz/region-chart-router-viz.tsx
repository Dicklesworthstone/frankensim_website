"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Play, RotateCcw, Route } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const PANEL_BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const TEAL = "#14b8a6";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const BLUE = "#3b82f6";
const AMBER = "#f59e0b";
const ROSE = "#f43f5e";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Chart graph model                                                  */
/* ------------------------------------------------------------------ */

type ChartId = "SDF" | "MESH" | "FREP" | "NURBS" | "VOXEL";

interface ChartNode {
  id: ChartId;
  label: string;
  color: string;
  x: number;
  y: number;
}

const CHARTS: ChartNode[] = [
  { id: "SDF", label: "SDF", color: CYAN, x: 368, y: 172 },
  { id: "MESH", label: "MESH", color: VIOLET, x: 515, y: 66 },
  { id: "FREP", label: "F-REP", color: EMERALD, x: 662, y: 172 },
  { id: "NURBS", label: "NURBS", color: AMBER, x: 606, y: 345 },
  { id: "VOXEL", label: "VOXEL", color: BLUE, x: 424, y: 345 },
];

const POS = Object.fromEntries(CHARTS.map((c) => [c.id, { x: c.x, y: c.y }])) as Record<
  ChartId,
  { x: number; y: number }
>;
const LABEL = Object.fromEntries(CHARTS.map((c) => [c.id, c.label])) as Record<ChartId, string>;

interface Edge {
  a: ChartId;
  b: ChartId;
  cost: number;
  err: number;
}

/** Undirected conversion graph. cost = compute effort, err = precision loss. */
const EDGES: Edge[] = [
  { a: "SDF", b: "MESH", cost: 0.3, err: 0.002 },
  { a: "MESH", b: "FREP", cost: 0.35, err: 0.002 },
  { a: "FREP", b: "NURBS", cost: 0.6, err: 0.008 },
  { a: "NURBS", b: "VOXEL", cost: 0.5, err: 0.006 },
  { a: "VOXEL", b: "SDF", cost: 0.15, err: 0.004 },
  { a: "MESH", b: "NURBS", cost: 0.4, err: 0.002 },
  { a: "SDF", b: "FREP", cost: 0.2, err: 0.001 },
  { a: "SDF", b: "NURBS", cost: 0.95, err: 0.009 },
  { a: "FREP", b: "VOXEL", cost: 0.35, err: 0.003 },
];

/** Certified error budget the router must respect. */
const ERROR_BUDGET = 0.005;
const REGION = { x: 108, y: 214 };

/* ------------------------------------------------------------------ */
/*  Pareto shortest-path router (pure, deterministic)                  */
/* ------------------------------------------------------------------ */

function edgeBetween(a: ChartId, b: ChartId): Edge | undefined {
  return EDGES.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

const ADJ = Object.fromEntries(
  CHARTS.map((c) => [
    c.id,
    EDGES.filter((e) => e.a === c.id || e.b === c.id).map((e) => (e.a === c.id ? e.b : e.a)),
  ]),
) as Record<ChartId, ChartId[]>;

interface RoutePath {
  nodes: ChartId[];
  cost: number;
  err: number;
  withinBudget: boolean;
}

function enumeratePaths(src: ChartId, dst: ChartId): RoutePath[] {
  const out: RoutePath[] = [];
  const walk = (node: ChartId, visited: ChartId[], cost: number, err: number) => {
    if (node === dst) {
      out.push({
        nodes: [...visited],
        cost: Math.round(cost * 1000) / 1000,
        err: Math.round(err * 100000) / 100000,
        withinBudget: err <= ERROR_BUDGET + 1e-9,
      });
      return;
    }
    for (const nb of ADJ[node]) {
      if (visited.includes(nb)) continue;
      const e = edgeBetween(node, nb)!;
      walk(nb, [...visited, nb], cost + e.cost, err + e.err);
    }
  };
  walk(src, [src], 0, 0);
  return out;
}

interface RouteSolution {
  chosen: RoutePath | null;
  alts: RoutePath[];
}

function solveRoute(src: ChartId, dst: ChartId): RouteSolution {
  const all = enumeratePaths(src, dst);
  const within = all.filter((p) => p.withinBudget).sort((a, b) => a.cost - b.cost);
  const chosen = within[0] ?? null;

  // Alternatives illustrate the Pareto choice: prefer cheaper-but-rejected paths
  // (they exceed the error budget) then the next-cheapest legal ones.
  const others = all
    .filter((p) => p.nodes.join() !== chosen?.nodes.join())
    .sort((a, b) => a.cost - b.cost);
  const cheaperRejected = others.filter((p) => !p.withinBudget && (!chosen || p.cost < chosen.cost));
  const rest = others.filter((p) => !cheaperRejected.includes(p));
  const alts = [...cheaperRejected, ...rest].slice(0, 2);

  return { chosen, alts };
}

function pathEdges(nodes: ChartId[]): [ChartId, ChartId][] {
  const segs: [ChartId, ChartId][] = [];
  for (let i = 0; i < nodes.length - 1; i++) segs.push([nodes[i], nodes[i + 1]]);
  return segs;
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

function fmtSci(x: number): string {
  if (x <= 0) return "0";
  let exp = Math.floor(Math.log10(x));
  let mant = Math.round((x / Math.pow(10, exp)) * 10) / 10;
  if (mant >= 10) {
    mant /= 10;
    exp += 1;
  }
  const m = Number.isInteger(mant) ? String(mant) : mant.toFixed(1);
  return `${m}e${exp}`;
}

function fmtCost(x: number): string {
  return String(Math.round(x * 100) / 100);
}

/* ------------------------------------------------------------------ */
/*  Mini chart glyphs                                                  */
/* ------------------------------------------------------------------ */

function Glyph({ id, color: s }: { id: ChartId; color: string }) {
  if (id === "SDF")
    return (
      <g stroke={s} strokeWidth={1.4} fill="none" opacity={0.9}>
        <circle r={5} />
        <circle r={10} opacity={0.6} />
        <circle r={1.4} fill={s} stroke="none" />
      </g>
    );
  if (id === "MESH")
    return (
      <g stroke={s} strokeWidth={1.3} fill="none" opacity={0.9}>
        <path d="M -10 8 L 0 -10 L 10 8 Z" />
        <path d="M 0 -10 L 0 8 M -5 -1 L 5 -1" strokeWidth={0.9} opacity={0.7} />
      </g>
    );
  if (id === "FREP")
    return (
      <g stroke={s} strokeWidth={1.4} fill="none" opacity={0.9}>
        <circle cx={-4} r={7} />
        <circle cx={4} r={7} />
      </g>
    );
  if (id === "NURBS")
    return (
      <g stroke={s} strokeWidth={1.5} fill="none" opacity={0.95}>
        <path d="M -10 7 C -4 -12, 4 12, 10 -7" />
        <circle cx={-10} cy={7} r={1.6} fill={s} stroke="none" />
        <circle cx={10} cy={-7} r={1.6} fill={s} stroke="none" />
      </g>
    );
  return (
    <g fill={`${s}55`} stroke={s} strokeWidth={1} opacity={0.95}>
      <rect x={-9} y={-9} width={8} height={8} rx={1} />
      <rect x={1} y={-9} width={8} height={8} rx={1} />
      <rect x={-9} y={1} width={8} height={8} rx={1} />
      <rect x={1} y={1} width={8} height={8} rx={1} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Controls + legend                                                  */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  color,
  label,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-xs transition-colors hover:bg-white/5",
      )}
      style={{ borderColor: `${color}44`, color }}
    >
      {children}
      {label}
    </button>
  );
}

function LegendChip({
  color,
  text,
  solid,
  dashed,
}: {
  color: string;
  text: string;
  solid?: boolean;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={20} height={8} aria-hidden="true">
        <line
          x1={1}
          y1={4}
          x2={19}
          y2={4}
          stroke={color}
          strokeWidth={solid ? 3 : 2}
          strokeDasharray={dashed ? "3 3" : undefined}
        />
      </svg>
      <span style={{ color }}>{text}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

type Phase = "idle" | "routing" | "done" | "noroute";

export default function RegionChartRouterViz() {
  const reduced = useReducedMotion() ?? false;

  const [source, setSource] = useState<ChartId | null>(null);
  const [target, setTarget] = useState<ChartId | null>(null);
  const [solution, setSolution] = useState<RouteSolution | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hovered, setHovered] = useState<ChartId | null>(null);
  const [routeKey, setRouteKey] = useState(0);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const runRoute = useCallback(
    (src: ChartId, dst: ChartId) => {
      clearTimers();
      const sol = solveRoute(src, dst);
      setSolution(sol);
      setRouteKey((k) => k + 1);
      if (!sol.chosen) {
        setPhase("noroute");
        return;
      }
      setPhase("routing");
      const hops = sol.chosen.nodes.length - 1;
      const dur = reduced ? 10 : 460 * hops + 300;
      timersRef.current.push(setTimeout(() => setPhase("done"), dur));
    },
    [clearTimers, reduced],
  );

  const handleNode = useCallback(
    (id: ChartId) => {
      if (phase === "routing") return;
      if (source && target) {
        setSource(id);
        setTarget(null);
        setSolution(null);
        setPhase("idle");
        return;
      }
      if (!source) {
        setSource(id);
        setSolution(null);
        setPhase("idle");
        return;
      }
      if (id === source) return;
      setTarget(id);
      runRoute(source, id);
    },
    [phase, source, target, runRoute],
  );

  const playDemo = useCallback(() => {
    setSource("SDF");
    setTarget("NURBS");
    runRoute("SDF", "NURBS");
  }, [runRoute]);

  const reset = useCallback(() => {
    clearTimers();
    setSource(null);
    setTarget(null);
    setSolution(null);
    setPhase("idle");
  }, [clearTimers]);

  /* ---- status readout ---- */
  const chosen = solution?.chosen ?? null;
  let statusColor = SLATE;
  let statusText = "idle — pick a source chart";
  if (phase === "idle" && source && !target) statusText = `src ${LABEL[source]} — pick a target`;
  if (phase === "routing") {
    statusColor = CYAN_GLOW;
    statusText = "routing — Pareto shortest path…";
  }
  if (phase === "noroute") {
    statusColor = ROSE;
    statusText = `no certified route ${source ? LABEL[source] : ""} → ${target ? LABEL[target] : ""} ✗`;
  }
  if (phase === "done" && chosen) {
    statusColor = EMERALD;
    statusText = "route certified ✓";
  }

  const routeString = chosen
    ? `route: ${chosen.nodes.map((n) => LABEL[n]).join(" → ")}   cost ${fmtCost(chosen.cost)}   err ${fmtSci(chosen.err)}   ${chosen.withinBudget ? "✓ certified" : "✗"}`
    : phase === "noroute"
      ? `no chain within err budget ${fmtSci(ERROR_BUDGET)}`
      : `err budget ${fmtSci(ERROR_BUDGET)} · click Region charts to route`;

  const chosenEdges = chosen ? pathEdges(chosen.nodes) : [];
  const packetPts = chosen ? chosen.nodes.map((n) => POS[n]) : [];

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
            style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}aa` }}
          />
          <Route size={14} style={{ color: statusColor }} />
          <span className="font-mono text-xs sm:text-sm" style={{ color: BRIGHT }}>
            {statusText}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CtrlButton
            onClick={playDemo}
            color={CYAN_GLOW}
            label="Route demo"
            ariaLabel="Run a demo route from SDF to NURBS"
          >
            <Play size={12} />
          </CtrlButton>
          <CtrlButton onClick={reset} color={SLATE} label="Reset" ariaLabel="Reset the router">
            <RotateCcw size={12} />
          </CtrlButton>
        </div>
      </div>

      {/* SVG canvas */}
      <svg
        viewBox="0 0 820 470"
        className="w-full"
        style={{ maxHeight: 520 }}
        role="img"
        aria-label="Rep Router selecting the cheapest error-budget-respecting conversion chain between geometry charts presenting an abstract region"
      >
        <defs>
          <filter id="rcr-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="rcr-region" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={CYAN_GLOW} stopOpacity={0.55} />
            <stop offset="60%" stopColor={CYAN} stopOpacity={0.18} />
            <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Presentation links: Region Ω → every chart (no chart privileged) */}
        {CHARTS.map((c) => (
          <line
            key={`pres-${c.id}`}
            x1={REGION.x}
            y1={REGION.y}
            x2={c.x}
            y2={c.y}
            stroke={CYAN}
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={0.18}
          />
        ))}

        {/* Region Ω glyph */}
        <g>
          <motion.circle
            cx={REGION.x}
            cy={REGION.y}
            r={46}
            fill="url(#rcr-region)"
            animate={reduced ? undefined : { r: [44, 50, 44] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <ellipse cx={REGION.x} cy={REGION.y} rx={30} ry={18} fill="none" stroke={CYAN_GLOW} strokeWidth={1.4} opacity={0.75} />
          <ellipse cx={REGION.x} cy={REGION.y} rx={13} ry={8} fill="none" stroke={CYAN_GLOW} strokeWidth={1.2} opacity={0.5} />
          <text x={REGION.x} y={REGION.y + 5} textAnchor="middle" fill={CYAN_GLOW} fontSize={17} fontFamily="monospace" fontWeight={700}>
            Ω
          </text>
          <text x={REGION.x} y={REGION.y + 64} textAnchor="middle" fill={MUTED} fontSize={10} fontFamily="monospace">
            Region (never stored)
          </text>
        </g>

        {/* Base conversion edges + cost/err weights */}
        {EDGES.map((e) => {
          const a = POS[e.a];
          const b = POS[e.b];
          const incident = hovered === e.a || hovered === e.b;
          return (
            <g key={`edge-${e.a}-${e.b}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={incident ? CYAN : SLATE} strokeWidth={1} opacity={incident ? 0.5 : 0.28} />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 3}
                textAnchor="middle"
                fill={incident ? CYAN_GLOW : SLATE}
                fontSize={7.5}
                fontFamily="monospace"
                opacity={incident ? 0.95 : 0.5}
                style={{ pointerEvents: "none" }}
              >
                {fmtCost(e.cost)} / {fmtSci(e.err)}
              </text>
            </g>
          );
        })}

        {/* Alternative (Pareto-dominated / rejected) paths */}
        <AnimatePresence>
          {solution?.alts.map((alt, ai) =>
            pathEdges(alt.nodes).map((seg, si) => {
              const a = POS[seg[0]];
              const b = POS[seg[1]];
              return (
                <motion.line
                  key={`alt-${routeKey}-${ai}-${si}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={alt.withinBudget ? TEAL : ROSE}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.4 }}
                />
              );
            }),
          )}
        </AnimatePresence>

        {/* Chosen path — draws on, glowing */}
        {chosenEdges.map((seg, i) => {
          const a = POS[seg[0]];
          const b = POS[seg[1]];
          return (
            <motion.line
              key={`chosen-${routeKey}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={CYAN_GLOW}
              strokeWidth={3}
              strokeLinecap="round"
              filter="url(#rcr-glow)"
              initial={{ pathLength: reduced ? 1 : 0, opacity: 0.9 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : i * 0.46, ease: "easeInOut" }}
            />
          );
        })}

        {/* Traveling certificate packet */}
        {chosen && packetPts.length > 1 && (
          <motion.circle
            key={`packet-${routeKey}`}
            r={6}
            fill={CYAN_GLOW}
            filter="url(#rcr-glow)"
            initial={{ cx: packetPts[0].x, cy: packetPts[0].y, opacity: 0 }}
            animate={{
              cx: packetPts.map((p) => p.x),
              cy: packetPts.map((p) => p.y),
              opacity: [0, 1, 1, 1, 1],
            }}
            transition={{ duration: reduced ? 0.01 : 0.46 * (packetPts.length - 1), ease: "easeInOut" }}
          />
        )}

        {/* Chart nodes */}
        {CHARTS.map((c) => {
          const isSrc = source === c.id;
          const isDst = target === c.id;
          const isHover = hovered === c.id;
          const onChosen = chosen?.nodes.includes(c.id) ?? false;
          return (
            <g
              key={c.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => handleNode(c.id)}
            >
              {(isSrc || isDst) && (
                <motion.circle
                  cx={c.x}
                  cy={c.y}
                  r={37}
                  fill="none"
                  stroke={isSrc ? CYAN_GLOW : VIOLET}
                  strokeWidth={1.5}
                  strokeDasharray="3 4"
                  opacity={0.9}
                  animate={reduced ? undefined : { rotate: 360 }}
                  transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              )}
              <circle
                cx={c.x}
                cy={c.y}
                r={isHover ? 32 : 30}
                fill={`${c.color}1f`}
                stroke={c.color}
                strokeWidth={onChosen ? 2.4 : isHover ? 2 : 1.4}
                opacity={onChosen || phase === "idle" || !chosen ? 1 : 0.5}
                filter={onChosen || isHover ? "url(#rcr-glow)" : undefined}
              />
              <g transform={`translate(${c.x} ${c.y - 2})`}>
                <Glyph id={c.id} color={c.color} />
              </g>
              <text
                x={c.x}
                y={c.y + 46}
                textAnchor="middle"
                fill={c.color}
                fontSize={11}
                fontFamily="monospace"
                fontWeight={600}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {c.label}
              </text>
              {(isSrc || isDst) && (
                <text
                  x={c.x}
                  y={c.y - 40}
                  textAnchor="middle"
                  fill={isSrc ? CYAN_GLOW : VIOLET}
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {isSrc ? "SRC" : "DST"}
                </text>
              )}
            </g>
          );
        })}

        {/* Route result readout */}
        <text
          x={410}
          y={452}
          textAnchor="middle"
          fill={chosen ? EMERALD : `${MUTED}cc`}
          fontSize={12}
          fontFamily="monospace"
        >
          {routeString}
        </text>
      </svg>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: PANEL_BORDER, color: MUTED }}
      >
        <LegendChip color={CYAN_GLOW} text="chosen chain" solid />
        <LegendChip color={ROSE} text="rejected · over err budget" dashed />
        <LegendChip color={TEAL} text="legal alternative" dashed />
        <span style={{ color: SLATE }}>edge label = cost / err</span>
      </div>
    </div>
  );
}
