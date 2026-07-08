"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { ShieldCheck, FlaskConical, Gauge, RotateCcw, Play, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                           */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";
const CYAN_GLOW = "#22d3ee";

/* ------------------------------------------------------------------ */
/*  Epistemic type system                                             */
/* ------------------------------------------------------------------ */

type EColor = "verified" | "validated" | "estimated";

const E_COLOR: Record<EColor, string> = {
  verified: "#22d3ee", // cyan   — interval-certified numerics
  validated: "#a3e635", // lime   — anchored to experimental data
  estimated: "#fbbf24", // amber  — best-effort / surrogate
};
const E_STRENGTH: Record<EColor, number> = { verified: 2, validated: 1, estimated: 0 };
const E_ORDER: EColor[] = ["verified", "validated", "estimated"];
const OPS = ["⊕", "⊗", "∘"] as const; // ⊕ ⊗ ∘

function nextColor(c: EColor): EColor {
  return E_ORDER[(E_ORDER.indexOf(c) + 1) % 3];
}
// weakest grade wins — an estimate can never be laundered into a certificate
function combine(a: EColor, b: EColor): EColor {
  return E_STRENGTH[a] <= E_STRENGTH[b] ? a : b;
}
function note(a: EColor, b: EColor, r: EColor): string {
  if (a === b) return "same grade";
  if (r === "estimated") return "no laundering";
  return "weakest wins";
}
function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy - r * Math.sin(a)).toFixed(1)}`);
  }
  return "M" + pts.join(" L") + " Z";
}

const LEGEND: { grade: EColor; icon: typeof ShieldCheck; desc: string }[] = [
  { grade: "verified", icon: ShieldCheck, desc: "interval-certified — bounds proven" },
  { grade: "validated", icon: FlaskConical, desc: "anchored to data within a regime" },
  { grade: "estimated", icon: Gauge, desc: "best-effort surrogate — no proof" },
];

/* ------------------------------------------------------------------ */
/*  SVG pill                                                          */
/* ------------------------------------------------------------------ */

function GradePill({
  x,
  y,
  w,
  h,
  grade,
  onClick,
  reduced,
  clickable,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  grade: EColor;
  onClick?: () => void;
  reduced: boolean;
  clickable: boolean;
}) {
  const color = E_COLOR[grade];
  const noPointer = { pointerEvents: "none", userSelect: "none" } as const;
  return (
    <motion.g onClick={onClick} style={{ cursor: clickable ? "pointer" : "default" }} whileHover={clickable ? { scale: reduced ? 1 : 1.03 } : undefined}>
      <motion.rect x={x} y={y} width={w} height={h} rx={h / 2} animate={{ fill: `${color}22`, stroke: color }} transition={{ duration: reduced ? 0 : 0.4 }} strokeWidth={1.4} />
      <circle cx={x + h / 2} cy={y + h / 2} r={h / 2 - 12} fill={color} opacity={0.9} />
      <text x={x + h - 2} y={y + h / 2 - 2} fill={color} fontSize={14} fontFamily="monospace" fontWeight={600} style={noPointer}>{grade}</text>
      <text x={x + h - 2} y={y + h / 2 + 15} fill={MUTED} fontSize={9.5} fontFamily="monospace" style={noPointer}>{clickable ? "click to cycle" : "Evidence<T>"}</text>
    </motion.g>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type Phase = "idle" | "combining" | "done";

export default function EpistemicColorsViz() {
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const [selA, setSelA] = useState<EColor>("verified");
  const [selB, setSelB] = useState<EColor>("estimated");
  const [opIdx, setOpIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<EColor | null>(null);

  // regime demo
  const [regimePlaying, setRegimePlaying] = useState(false);
  const [regimeCrossed, setRegimeCrossed] = useState(false);
  const [regimeDone, setRegimeDone] = useState(false);

  const [status, setStatus] = useState("select operands · press Combine");

  const busyRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  const schedule = useCallback(
    (fn: () => void, ms: number) => {
      const id = setTimeout(fn, reduced ? 0 : ms);
      timersRef.current.push(id);
    },
    [reduced],
  );
  useEffect(() => () => clearTimers(), [clearTimers]);

  const op = OPS[opIdx];

  const invalidate = useCallback(() => {
    if (busyRef.current) return;
    setPhase("idle");
    setResult(null);
  }, []);

  const cycleA = useCallback(() => {
    invalidate();
    setSelA((c) => nextColor(c));
  }, [invalidate]);
  const cycleB = useCallback(() => {
    invalidate();
    setSelB((c) => nextColor(c));
  }, [invalidate]);
  const cycleOp = useCallback(() => {
    invalidate();
    setOpIdx((i) => (i + 1) % OPS.length);
  }, [invalidate]);

  const runCombine = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase("combining");
    setResult(null);
    setStatus(`typecheck: ${selA} ${op} ${selB} …`);
    schedule(() => {
      const r = combine(selA, selB);
      setResult(r);
      setPhase("done");
      setStatus(`${selA} ${op} ${selB} → ${r} (${note(selA, selB, r)})`);
      busyRef.current = false;
    }, 820);
  }, [selA, selB, op, schedule]);

  const runRegime = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRegimePlaying(true);
    setRegimeCrossed(false);
    setRegimeDone(false);
    setStatus("validated value crossing regime boundary …");
    schedule(() => {
      setRegimeCrossed(true);
      setStatus("regime exited — auto-demoting …");
    }, 880);
    schedule(() => {
      setRegimeDone(true);
      setStatus("validated → estimated (regime exited)");
      busyRef.current = false;
    }, 1600);
  }, [schedule]);

  const reset = useCallback(() => {
    clearTimers();
    busyRef.current = false;
    setSelA("verified");
    setSelB("estimated");
    setOpIdx(0);
    setPhase("idle");
    setResult(null);
    setRegimePlaying(false);
    setRegimeCrossed(false);
    setRegimeDone(false);
    setStatus("select operands · press Combine");
  }, [clearTimers]);

  /* regime pill geometry */
  const REG_BASE_X = 90;
  const REG_DX = 440;
  const regimeColor: EColor = regimeCrossed ? "estimated" : "validated";

  const lampColor =
    phase === "combining" || regimePlaying
      ? "#f59e0b"
      : result
        ? E_COLOR[result]
        : CYAN_GLOW;

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="w-full rounded-2xl border" style={{ background: BG, borderColor: BORDER }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: lampColor, boxShadow: `0 0 8px ${lampColor}88` }}
          />
          <span className="truncate font-mono text-xs sm:text-sm" style={{ color: BRIGHT }}>
            {status}
          </span>
        </div>
        <button
          onClick={reset}
          aria-label="Reset epistemic color demo"
          className={cn(btnClass, "shrink-0")}
          style={{ borderColor: `${CYAN_GLOW}44`, color: CYAN_GLOW }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 760 540"
        className="w-full"
        style={{ maxHeight: 560 }}
        role="img"
        aria-label="Three-color epistemic type system: verified, validated and estimated grades combine so the weakest grade wins, and a validated value auto-demotes to estimated when it leaves its regime of validity"
      >
        <defs>
          <filter id="ec-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ---- Composition section ---- */}
        <text x={40} y={30} fill={MUTED} fontSize={12} fontFamily="monospace" letterSpacing={1}>COMPOSITION — weakest grade wins</text>

        {/* connectors */}
        <path d="M130,124 C 150,178 300,162 348,184" fill="none" stroke={`${E_COLOR[selA]}55`} strokeWidth={1.5} />
        <path d="M630,124 C 610,178 460,162 412,184" fill="none" stroke={`${E_COLOR[selB]}55`} strokeWidth={1.5} />
        <path d="M380,258 L 380,288" fill="none" stroke={result ? `${E_COLOR[result]}88` : `${SLATE}66`} strokeWidth={1.5} />

        {/* operand pills */}
        <GradePill x={40} y={64} w={180} h={60} grade={selA} onClick={cycleA} reduced={reduced} clickable />
        <GradePill x={540} y={64} w={180} h={60} grade={selB} onClick={cycleB} reduced={reduced} clickable />

        {/* operator node */}
        <g onClick={cycleOp} style={{ cursor: "pointer" }}>
          <circle cx={380} cy={94} r={30} fill={SURFACE} stroke={`${CYAN_GLOW}55`} strokeWidth={1.4} />
          <text x={380} y={102} textAnchor="middle" fill={CYAN_GLOW} fontSize={26} fontFamily="monospace">{op}</text>
          <text x={380} y={144} textAnchor="middle" fill={MUTED} fontSize={9.5} fontFamily="monospace">operator</text>
        </g>

        {/* combinator hexagon */}
        <motion.path
          d={hexPath(380, 210, 48)}
          fill={SURFACE}
          stroke={CYAN_GLOW}
          strokeWidth={1.6}
          animate={{ opacity: phase === "combining" ? [0.6, 1, 0.6] : 1 }}
          transition={{ duration: reduced ? 0 : 1.1, repeat: phase === "combining" ? Infinity : 0 }}
          filter={phase === "combining" ? "url(#ec-glow)" : undefined}
        />
        <text x={380} y={206} textAnchor="middle" fill={BRIGHT} fontSize={11} fontFamily="monospace" fontWeight={600}>TYPECHECK</text>
        <text x={380} y={222} textAnchor="middle" fill={MUTED} fontSize={9} fontFamily="monospace">grade lattice</text>

        {/* flowing particles */}
        <AnimatePresence>
          {phase === "combining" && (
            <>
              <motion.circle key="pa" r={6} fill={E_COLOR[selA]} initial={{ cx: 130, cy: 94, opacity: 0 }} animate={{ cx: 380, cy: 210, opacity: [0, 1, 1, 0.2] }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.8, ease: "easeInOut" }} />
              <motion.circle key="pb" r={6} fill={E_COLOR[selB]} initial={{ cx: 630, cy: 94, opacity: 0 }} animate={{ cx: 380, cy: 210, opacity: [0, 1, 1, 0.2] }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.8, ease: "easeInOut" }} />
            </>
          )}
        </AnimatePresence>

        {/* result pill */}
        <AnimatePresence>
          {result && (
            <motion.g key={result} initial={{ opacity: 0, y: reduced ? 0 : 8, scale: reduced ? 1 : 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.35 }}>
              <rect x={270} y={288} width={220} height={58} rx={12} fill={`${E_COLOR[result]}1f`} stroke={E_COLOR[result]} strokeWidth={1.6} filter="url(#ec-glow)" />
              <text x={288} y={314} fill={E_COLOR[result]} fontSize={15} fontFamily="monospace" fontWeight={700}>{result}</text>
              <text x={288} y={332} fill={MUTED} fontSize={10} fontFamily="monospace">= {selA} {op} {selB}</text>
              {result === "estimated" && (selA !== "estimated" || selB !== "estimated") && (
                <text x={472} y={322} textAnchor="end" fill={E_COLOR.estimated} fontSize={9.5} fontFamily="monospace">no laundering</text>
              )}
            </motion.g>
          )}
        </AnimatePresence>

        {/* lock note */}
        <g transform="translate(270, 350)">
          <path d="M3,7 v-2 a3,3 0 0 1 6,0 v2" fill="none" stroke={SLATE} strokeWidth={1.4} />
          <rect x={1} y={7} width={10} height={8} rx={1.6} fill="none" stroke={SLATE} strokeWidth={1.4} />
          <text x={20} y={15} fill={SLATE} fontSize={9.5} fontFamily="monospace">an estimate can never be laundered into a certificate</text>
        </g>

        {/* ---- Regime section ---- */}
        <line x1={40} y1={384} x2={720} y2={384} stroke={BORDER} strokeWidth={1} />
        <text x={40} y={410} fill={MUTED} fontSize={12} fontFamily="monospace" letterSpacing={1}>REGIME OF VALIDITY — leaving demotes to estimated</text>

        {/* regime box */}
        <rect x={40} y={428} width={300} height={96} rx={12} fill={`${E_COLOR.validated}0d`} stroke={`${E_COLOR.validated}66`} strokeWidth={1.4} strokeDasharray="5 4" />
        <text x={54} y={448} fill={E_COLOR.validated} fontSize={10} fontFamily="monospace">regime of validity</text>

        {/* boundary */}
        <line x1={380} y1={418} x2={380} y2={532} stroke={`${E_COLOR.estimated}88`} strokeWidth={1.6} strokeDasharray="4 4" />
        <text x={388} y={430} fill={E_COLOR.estimated} fontSize={9.5} fontFamily="monospace">boundary</text>
        <text x={560} y={448} fill={SLATE} fontSize={10} fontFamily="monospace">outside regime</text>

        {/* regime pill */}
        <motion.g initial={false} animate={{ x: regimePlaying ? REG_DX : 0 }} transition={{ duration: reduced ? 0 : 1.6, ease: "easeInOut" }}>
          <motion.rect x={REG_BASE_X} y={452} width={140} height={48} rx={24} animate={{ fill: `${E_COLOR[regimeColor]}22`, stroke: E_COLOR[regimeColor] }} transition={{ duration: reduced ? 0 : 0.4 }} strokeWidth={1.5} />
          <motion.circle cx={REG_BASE_X + 24} cy={476} r={9} animate={{ fill: E_COLOR[regimeColor] }} transition={{ duration: reduced ? 0 : 0.4 }} />
          <motion.text x={REG_BASE_X + 44} y={481} fontSize={13} fontFamily="monospace" fontWeight={600} animate={{ fill: E_COLOR[regimeColor] }} transition={{ duration: reduced ? 0 : 0.4 }}>{regimeColor}</motion.text>
        </motion.g>

        {regimeDone && (
          <text x={560} y={512} fill={E_COLOR.estimated} fontSize={10} fontFamily="monospace" fontWeight={600}>auto-demoted</text>
        )}
      </svg>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <button
          onClick={runCombine}
          aria-label="Combine the two operand grades"
          className={btnClass}
          style={{ borderColor: `${CYAN_GLOW}55`, color: CYAN_GLOW }}
        >
          <Play className="h-3.5 w-3.5" />
          Combine
        </button>
        <button
          onClick={runRegime}
          aria-label="Take a validated value out of its regime of validity"
          className={btnClass}
          style={{ borderColor: `${E_COLOR.estimated}55`, color: E_COLOR.estimated }}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Leave regime
        </button>
      </div>

      {/* Legend + lattice */}
      <div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-2" style={{ borderColor: BORDER }}>
        {/* legend chips */}
        <ul className="flex flex-col gap-2">
          {LEGEND.map(({ grade, icon: Icon, desc }) => (
            <li
              key={grade}
              className="flex items-center gap-2.5 rounded-lg border px-3 py-2"
              style={{ borderColor: `${E_COLOR[grade]}44`, background: `${E_COLOR[grade]}0d` }}
            >
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${E_COLOR[grade]}22` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: E_COLOR[grade] }} />
              </span>
              <span className="font-mono text-xs font-semibold" style={{ color: E_COLOR[grade] }}>
                {grade}
              </span>
              <span className="font-mono text-[11px]" style={{ color: MUTED }}>
                {desc}
              </span>
            </li>
          ))}
        </ul>

        {/* composition lattice */}
        <div className="overflow-x-auto">
          <div className="mb-1.5 font-mono text-[11px]" style={{ color: MUTED }}>
            composition lattice — click a cell to load operands
          </div>
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr>
                <th className="p-1 text-left" style={{ color: SLATE }}>
                  A\B
                </th>
                {E_ORDER.map((b) => (
                  <th key={b} className="p-1" style={{ color: E_COLOR[b] }}>
                    {b.slice(0, 4)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {E_ORDER.map((a) => (
                <tr key={a}>
                  <td className="p-1 text-left" style={{ color: E_COLOR[a] }}>
                    {a.slice(0, 4)}
                  </td>
                  {E_ORDER.map((b) => {
                    const r = combine(a, b);
                    const active = a === selA && b === selB;
                    return (
                      <td key={b} className="p-1 text-center">
                        <button
                          aria-label={`Set operands to ${a} and ${b}`}
                          onClick={() => {
                            invalidate();
                            setSelA(a);
                            setSelB(b);
                          }}
                          className={cn(
                            "w-full rounded px-1.5 py-1 transition-colors",
                            active ? "ring-1" : "hover:brightness-125",
                          )}
                          style={{
                            background: `${E_COLOR[r]}${active ? "33" : "14"}`,
                            color: E_COLOR[r],
                          }}
                        >
                          {r.slice(0, 4)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
