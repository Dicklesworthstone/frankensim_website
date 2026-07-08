"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Play, Pause, StepForward, RotateCcw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette (FrankenSim)                                               */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const SLATE = "#64748b";
const ROSE = "#f43f5e";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const VALIDATED = "#a3e635";

/* ------------------------------------------------------------------ */
/*  Geometry                                                           */
/* ------------------------------------------------------------------ */

const XP = 210; // param bus x
const XA = 316; // assemble center
const XB = 496; // forward solve center
const XC = 676; // objective center
const YF = 142; // forward lane
const YA = 168; // adjoint lane

const BOX_W = 128;
const BOX_HW = BOX_W / 2;
const BOX_Y = 96;
const BOX_H = 104;

interface Box {
  id: string;
  cx: number;
  label: string;
  sub: string;
  adjSub?: string;
  fReach: number; // progress at which forward pass has reached it
  aReach: number; // progress at which adjoint pass has reached it
}

const BOXES: Box[] = [
  { id: "assemble", cx: XA, label: "assemble", sub: "K(p), f(p)", adjSub: "∂R/∂p accum", fReach: 1, aReach: 5 },
  { id: "solve", cx: XB, label: "forward solve", sub: "K·u = f", adjSub: "Kᵀ·λ = ∂J/∂u", fReach: 2, aReach: 4 },
  { id: "objective", cx: XC, label: "objective", sub: "J(u, p)", fReach: 3, aReach: 99 },
];

interface Seg {
  from: [number, number];
  to: [number, number];
  color: string;
}

// 0..2 forward (cyan, →), 3..5 adjoint (violet, ←)
const SEGS: Seg[] = [
  { from: [XP, YF], to: [XA, YF], color: CYAN_GLOW },
  { from: [XA, YF], to: [XB, YF], color: CYAN_GLOW },
  { from: [XB, YF], to: [XC, YF], color: CYAN_GLOW },
  { from: [XC, YA], to: [XB, YA], color: VIOLET },
  { from: [XB, YA], to: [XA, YA], color: VIOLET },
  { from: [XA, YA], to: [XP, YA], color: VIOLET },
];

const SEG_STATUS: string[] = [
  "forward: assemble K(p), f(p) …",
  "forward: solve K·u = f …",
  "forward: evaluate objective J(u, p)",
  "adjoint: Kᵀ·λ = ∂J/∂u — reuse factorization",
  "adjoint: accumulate −λᵀ·∂R/∂p …",
  "adjoint: gradient lands on all params",
];

const DONE_STATUS = "1 forward + 1 adjoint → ∇J for all 128 params · cost ≈ 2 solves";
const IDLE_STATUS = "adjoint-native gradients · press Play";

const SEG_MS = 560;
const SEG_GAP = 150;

interface Param {
  id: string;
  label: string;
  grad: string;
  y: number;
}

const PARAMS: Param[] = [
  { id: "p0", label: "p₀", grad: "+0.42", y: 112 },
  { id: "p1", label: "p₁", grad: "−1.13", y: 146 },
  { id: "p2", label: "p₂", grad: "+0.07", y: 180 },
  { id: "p3", label: "p₃", grad: "+2.65", y: 214 },
  { id: "p4", label: "p₄", grad: "−0.88", y: 248 },
  { id: "p127", label: "p₁₂₇", grad: "+0.19", y: 282 },
];

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  active,
  disabled,
  color,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  color: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5",
        "font-mono text-xs font-semibold tracking-wide transition-colors hover:bg-white/5",
        "disabled:cursor-not-allowed disabled:opacity-40",
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

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function AdjointFlowViz() {
  const reduced = !!useReducedMotion();

  const [progress, setProgress] = useState(0); // 0..6 completed segments
  const [flying, setFlying] = useState<number | null>(null); // segment index in flight
  const [playing, setPlaying] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [status, setStatus] = useState(IDLE_STATUS);

  const playingRef = useRef(false);
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

  // ref indirection so the self-scheduling loop never reads a stale/undeclared closure
  const runSegmentRef = useRef<(i: number) => void>(() => {});

  const runSegment = useCallback(
    (i: number) => {
      setFlying(i);
      setStatus(SEG_STATUS[i]);
      schedule(() => {
        setFlying(null);
        const next = i + 1;
        setProgress(next);
        if (next >= 6) {
          setStatus(DONE_STATUS);
          setShowCheck(true);
          setPlaying(false);
          playingRef.current = false;
        } else if (playingRef.current) {
          schedule(() => runSegmentRef.current(next), SEG_GAP);
        }
      }, SEG_MS);
    },
    [schedule],
  );

  useEffect(() => {
    runSegmentRef.current = runSegment;
  }, [runSegment]);

  const play = useCallback(() => {
    if (playingRef.current) return;
    clearTimers();
    setShowCheck(false);
    setFlying(null);
    setProgress(0);
    setPlaying(true);
    playingRef.current = true;
    schedule(() => runSegment(0), 80);
  }, [clearTimers, runSegment, schedule]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    clearTimers();
    setFlying(null);
    setStatus("paused");
  }, [clearTimers]);

  const step = useCallback(() => {
    if (flying !== null) return;
    playingRef.current = false;
    setPlaying(false);
    if (progress >= 6) return;
    runSegment(progress);
  }, [flying, progress, runSegment]);

  const reset = useCallback(() => {
    clearTimers();
    playingRef.current = false;
    setPlaying(false);
    setFlying(null);
    setProgress(0);
    setShowCheck(false);
    setStatus(IDLE_STATUS);
  }, [clearTimers]);

  const complete = progress >= 6;

  return (
    <section
      className="w-full rounded-2xl border p-4 sm:p-5"
      style={{ background: BG, borderColor: BORDER }}
      aria-label="Adjoint-native gradient flow visualization"
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: complete ? VALIDATED : flying !== null && flying >= 3 ? VIOLET : CYAN_GLOW,
              boxShadow: `0 0 8px ${complete ? VALIDATED : flying !== null && flying >= 3 ? VIOLET : CYAN_GLOW}88`,
            }}
          />
          <div className="min-w-0">
            <h3 className="font-mono text-sm font-bold tracking-tight" style={{ color: BRIGHT }}>
              Adjoint-native gradients
            </h3>
            <p className="truncate font-mono text-[11px]" style={{ color: MUTED }}>
              differentiate through the solution — not through the iterations
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border px-3 py-1"
          style={{ borderColor: `${VIOLET}44` }}
        >
          <span className="font-mono text-[11px] font-bold" style={{ color: VIOLET }}>
            implicit function theorem
          </span>
        </div>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 800 330"
        className="w-full"
        role="img"
        aria-label="Left-to-right solver pipeline: design parameters flow forward through assemble and solve stages to an objective as cyan packets, then a violet adjoint packet returns right-to-left solving one reverse problem and depositing the full gradient back onto every parameter."
      >
        <defs>
          <filter id="af-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ----- param panel ----- */}
        <rect x={18} y={60} width={196} height={250} rx={12} fill={SURFACE} stroke={BORDER} />
        <text x={32} y={84} fontFamily="monospace" fontSize={11} fontWeight={700} fill={CYAN_GLOW}>
          design params
        </text>
        <text x={182} y={84} textAnchor="end" fontFamily="monospace" fontSize={10} fill={MUTED}>
          p ∈ ℝ¹²⁸
        </text>

        {/* param bus */}
        <line x1={XP} y1={112} x2={XP} y2={282} stroke={`${SLATE}44`} strokeWidth={1} />

        {PARAMS.map((p) => (
          <g key={p.id}>
            {/* landing arrow from bus into the param */}
            <AnimatePresence>
              {complete && (
                <motion.line
                  key={`arr-${p.id}`}
                  x1={XP}
                  y1={p.y}
                  x2={72}
                  y2={p.y}
                  stroke={VALIDATED}
                  strokeWidth={1.4}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.7 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.4 }}
                />
              )}
            </AnimatePresence>
            <circle cx={48} cy={p.y} r={5} fill={complete ? VALIDATED : SLATE} />
            <text x={62} y={p.y + 4} fontFamily="monospace" fontSize={12} fill={BRIGHT}>
              {p.label}
            </text>
            <AnimatePresence>
              {complete && (
                <motion.text
                  key={`g-${p.id}`}
                  x={200}
                  y={p.y + 4}
                  textAnchor="end"
                  fontFamily="monospace"
                  fontSize={11}
                  fontWeight={700}
                  fill={VALIDATED}
                  initial={{ opacity: 0, x: 214 }}
                  animate={{ opacity: 1, x: 200 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reduced ? 0 : 0.35,
                    delay: reduced ? 0 : PARAMS.indexOf(p) * 0.05,
                  }}
                >
                  {p.grad}
                </motion.text>
              )}
            </AnimatePresence>
          </g>
        ))}

        {/* ----- connectors / lanes ----- */}
        {SEGS.map((s, i) => {
          const traversed = progress > i;
          return (
            <line
              key={`seg-${i}`}
              x1={s.from[0]}
              y1={s.from[1]}
              x2={s.to[0]}
              y2={s.to[1]}
              stroke={traversed ? s.color : `${SLATE}30`}
              strokeWidth={traversed ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* objective turn: ∂J/∂u drop from forward lane to adjoint lane */}
        {progress >= 3 && (
          <>
            <line x1={XC} y1={YF} x2={XC} y2={YA} stroke={VIOLET} strokeWidth={2} strokeLinecap="round" />
            <text x={XC + 8} y={(YF + YA) / 2 + 3} fontFamily="monospace" fontSize={9} fill={VIOLET}>
              ∂J/∂u
            </text>
          </>
        )}

        {/* ----- stage boxes ----- */}
        {BOXES.map((b) => {
          const fOn = progress >= b.fReach;
          const aOn = progress >= b.aReach;
          const flyHere = flying !== null && SEGS[flying].to[0] === b.cx;
          const color = aOn ? VIOLET : fOn ? CYAN_GLOW : SLATE;
          const showAdj = aOn && b.adjSub;
          return (
            <g key={b.id}>
              <motion.rect
                x={b.cx - BOX_HW}
                y={BOX_Y}
                width={BOX_W}
                height={BOX_H}
                rx={12}
                animate={{
                  stroke: color,
                  fill: fOn ? `${color}14` : `${SLATE}0c`,
                }}
                transition={{ duration: reduced ? 0 : 0.35 }}
                strokeWidth={flyHere ? 2.6 : 1.4}
                filter={flyHere ? "url(#af-glow)" : undefined}
              />
              <text
                x={b.cx}
                y={120}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize={12}
                fontWeight={700}
                fill={fOn ? BRIGHT : MUTED}
              >
                {b.label}
              </text>
              <text
                x={b.cx}
                y={190}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize={10}
                fill={showAdj ? VIOLET : `${MUTED}cc`}
              >
                {showAdj ? b.adjSub : b.sub}
              </text>
            </g>
          );
        })}

        {/* lane legend dots inside solve box */}
        <circle cx={XB - 44} cy={YF} r={3} fill={progress >= 2 ? CYAN_GLOW : `${SLATE}66`} />
        <circle cx={XB - 44} cy={YA} r={3} fill={progress >= 4 ? VIOLET : `${SLATE}66`} />

        {/* ----- flying packet ----- */}
        <AnimatePresence>
          {flying !== null && (
            <motion.circle
              key={`pk-${flying}`}
              r={7}
              fill={SEGS[flying].color}
              filter="url(#af-glow)"
              initial={{ cx: SEGS[flying].from[0], cy: SEGS[flying].from[1] }}
              animate={{ cx: SEGS[flying].to[0], cy: SEGS[flying].to[1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : SEG_MS / 1000, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        {/* ----- IFT formula ----- */}
        <text
          x={(XA - BOX_HW + XC + BOX_HW) / 2}
          y={232}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={11}
          fill={`${MUTED}dd`}
        >
          dJ/dp = ∂J/∂p − λᵀ·∂R/∂p — one linear solve, gradient for every p
        </text>

        {/* ----- cost comparison ----- */}
        <text x={252} y={262} fontFamily="monospace" fontSize={10} fill={MUTED}>
          cost to get ∇J over 128 params
        </text>
        {/* adjoint row */}
        <text x={252} y={288} fontFamily="monospace" fontSize={10} fill={CYAN_GLOW}>
          adjoint
        </text>
        <motion.rect
          x={326}
          y={280}
          height={10}
          rx={3}
          fill={CYAN_GLOW}
          animate={{ width: complete ? 2 * 2.6 : 0, opacity: complete ? 1 : 0.35 }}
          transition={{ duration: reduced ? 0 : 0.5 }}
        />
        <text x={340} y={288} fontFamily="monospace" fontSize={9} fill={CYAN_GLOW}>
          ≈ 2 solves
        </text>
        {/* finite-diff row */}
        <text x={252} y={308} fontFamily="monospace" fontSize={10} fill={ROSE}>
          finite-diff
        </text>
        <motion.rect
          x={326}
          y={300}
          height={10}
          rx={3}
          fill={ROSE}
          animate={{ width: complete ? 128 * 2.6 : 0, opacity: complete ? 0.85 : 0.25 }}
          transition={{ duration: reduced ? 0 : 0.7 }}
        />
        <text x={674} y={308} textAnchor="end" fontFamily="monospace" fontSize={9} fill={ROSE}>
          128 solves
        </text>

        {/* ----- gradient check stamp ----- */}
        <AnimatePresence>
          {showCheck && (
            <motion.g
              key="stamp"
              initial={{ opacity: 0, scale: reduced ? 1 : 0.6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: -8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.35, ease: "backOut" }}
              transform={`translate(${XC - 20}, 74)`}
            >
              <rect x={-70} y={-16} width={150} height={30} rx={6} fill={`${VALIDATED}18`} stroke={VALIDATED} strokeWidth={1.4} />
              <text x={-56} y={4} fontFamily="monospace" fontSize={11} fontWeight={700} fill={VALIDATED}>
                grad-check ✓
              </text>
              <text x={78} y={4} textAnchor="end" fontFamily="monospace" fontSize={8.5} fill={`${VALIDATED}cc`}>
                &lt;1e-9
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CtrlButton
          onClick={playing ? pause : play}
          active={playing}
          color={EMERALD}
          label={playing ? "Pause the sweep" : "Play forward then adjoint sweep"}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? "Pause" : "Play"}
        </CtrlButton>
        <CtrlButton onClick={step} disabled={playing || complete} color={CYAN_GLOW} label="Advance one solver stage">
          <StepForward size={13} />
          Step
        </CtrlButton>
        <CtrlButton onClick={reset} color={SLATE} label="Reset the pipeline">
          <RotateCcw size={13} />
          Reset
        </CtrlButton>
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px]"
          style={{
            borderColor: complete ? `${VALIDATED}55` : BORDER,
            color: complete ? VALIDATED : MUTED,
          }}
        >
          <CheckCircle2 size={12} />
          gradient checks gate every merge
        </span>
      </div>

      {/* Status readout */}
      <div
        className="mt-3 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: complete ? VALIDATED : CYAN_GLOW }}>›</span> {status}
        {complete && (
          <>
            {" "}
            <span style={{ color: SLATE }}>│</span>{" "}
            <span style={{ color: ROSE }}>finite differences would need 128 solves</span>
          </>
        )}
      </div>
    </section>
  );
}
