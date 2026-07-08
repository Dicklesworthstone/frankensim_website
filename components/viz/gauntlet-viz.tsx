"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { Play, StepForward, RotateCcw, Bug } from "lucide-react";
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
const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const AMBER = "#f59e0b";
const TEAL = "#14b8a6";
const VIOLET = "#a855f7";
const LIME = "#a3e635";

/* ------------------------------------------------------------------ */
/*  Gates                                                             */
/* ------------------------------------------------------------------ */

type GStatus = "pending" | "running" | "pass" | "fail";

interface Gate {
  id: string;
  name: string;
  desc: string;
}

const GATES: Gate[] = [
  { id: "G0", name: "Property laws", desc: "algebraic-law suites" },
  { id: "G1", name: "Order-of-accuracy", desc: "manufactured solutions" },
  { id: "G2", name: "Physics envelopes", desc: "canonical benchmarks" },
  { id: "G3", name: "Metamorphic", desc: "relation tests" },
  { id: "G4", name: "Chaos / faults", desc: "cancellation storms" },
  { id: "G5", name: "Determinism", desc: "cross-ISA · bit-identical" },
];
const LAST = GATES.length - 1;
const THEORY_ORDER = 4.0;

function lampColor(s: GStatus): string {
  switch (s) {
    case "pending":
      return SLATE;
    case "running":
      return AMBER;
    case "pass":
      return EMERALD;
    case "fail":
      return ROSE;
  }
}

/* stepper geometry */
const CHIP_W = 118;
const CHIP_GAP = 18;
const CHIP_X = (i: number) => 20 + i * (CHIP_W + CHIP_GAP);
const CHIP_CX = (i: number) => CHIP_X(i) + CHIP_W / 2;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type Phase = "idle" | "running" | "stepping" | "passed" | "failed";

export default function GauntletViz() {
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const [gates, setGates] = useState<GStatus[]>(() => GATES.map(() => "pending"));
  const [active, setActive] = useState(-1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [regression, setRegression] = useState(false);
  const [status, setStatus] = useState("idle · press Run Gauntlet");
  const [nonce, setNonce] = useState(0); // replays proof animations
  const [busy, setBusy] = useState(false); // render mirror of busyRef

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

  const setGate = useCallback((i: number, s: GStatus) => {
    setGates((prev) => prev.map((g, j) => (j === i ? s : g)));
  }, []);

  const runDur = reduced ? 0 : 900;

  // ref indirection so the recursive auto-advance never references itself in deps
  const playRef = useRef<(i: number, auto: boolean) => void>(() => {});

  const playGateAt = useCallback(
    (i: number, auto: boolean) => {
      busyRef.current = true;
      setBusy(true);
      setActive(i);
      setNonce((n) => n + 1);
      setGate(i, "running");
      setStatus(`running ${GATES[i].id} · ${GATES[i].name} …`);
      schedule(() => {
        const failed = i === 1 && regression;
        if (failed) {
          setGate(i, "fail");
          setPhase("failed");
          setStatus(`BUILD FAILED at G1 (slope Δ0.40 > 0.20)`);
          busyRef.current = false;
          setBusy(false);
          return;
        }
        setGate(i, "pass");
        if (i >= LAST) {
          setPhase("passed");
          setStatus(`BUILD PASSED · 6/6 gates green · bit-identical`);
          busyRef.current = false;
          setBusy(false);
          return;
        }
        if (auto) {
          schedule(() => playRef.current(i + 1, true), 380);
        } else {
          busyRef.current = false;
          setBusy(false);
          setStatus(`${GATES[i].id} passed · Step ${GATES[i + 1].id}`);
        }
      }, runDur);
    },
    [regression, runDur, schedule, setGate],
  );
  useEffect(() => {
    playRef.current = playGateAt;
  }, [playGateAt]);

  const runAll = useCallback(() => {
    if (busyRef.current) return;
    clearTimers();
    setGates(GATES.map(() => "pending"));
    setPhase("running");
    playGateAt(0, true);
  }, [clearTimers, playGateAt]);

  const stepGate = useCallback(() => {
    if (busyRef.current) return;
    if (phase === "passed" || phase === "failed") return;
    const next = active < 0 ? 0 : active + 1;
    if (next > LAST) return;
    if (next === 0) {
      setGates(GATES.map(() => "pending"));
    }
    setPhase("stepping");
    playGateAt(next, false);
  }, [active, phase, playGateAt]);

  const reset = useCallback(() => {
    clearTimers();
    busyRef.current = false;
    setBusy(false);
    setGates(GATES.map(() => "pending"));
    setActive(-1);
    setPhase("idle");
    setStatus("idle · press Run Gauntlet");
  }, [clearTimers]);

  const toggleRegression = useCallback(() => {
    if (busyRef.current) return;
    setRegression((r) => !r);
    reset();
    setStatus(regression ? "regression cleared · G1 will pass" : "regression armed · G1 slope will drift");
  }, [regression, reset]);

  const headerLamp =
    phase === "failed" ? ROSE : phase === "passed" ? EMERALD : busy ? AMBER : CYAN_GLOW;

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

  const activeStatus: GStatus = active >= 0 ? gates[active] : "pending";

  return (
    <div className="w-full rounded-2xl border" style={{ background: BG, borderColor: BORDER }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: headerLamp, boxShadow: `0 0 8px ${headerLamp}88` }}
          />
          <span className="truncate font-mono text-xs sm:text-sm" style={{ color: BRIGHT }}>
            {status}
          </span>
        </div>
        <button
          onClick={reset}
          aria-label="Reset the Gauntlet"
          className={cn(btnClass, "shrink-0")}
          style={{ borderColor: `${CYAN_GLOW}44`, color: CYAN_GLOW }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 840 480"
        className="w-full"
        style={{ maxHeight: 520 }}
        role="img"
        aria-label="The Gauntlet: a six-tier correctness pipeline G0 to G5 that gates every merge; a build steps through each gate which proves its own check, and a triggered regression makes G1's order-of-accuracy slope drift so the build fails and the pipeline halts"
      >
        <defs>
          <filter id="g-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* pipes between chips */}
        {GATES.slice(0, LAST).map((_, i) => {
          const done = gates[i] === "pass";
          return (
            <line
              key={`pipe-${i}`}
              x1={CHIP_X(i) + CHIP_W}
              y1={60}
              x2={CHIP_X(i + 1)}
              y2={60}
              stroke={done ? `${EMERALD}88` : `${SLATE}55`}
              strokeWidth={2.5}
            />
          );
        })}

        {/* gate chips */}
        {GATES.map((g, i) => {
          const s = gates[i];
          const c = lampColor(s);
          const isActive = i === active;
          return (
            <g key={g.id}>
              <motion.rect
                x={CHIP_X(i)}
                y={24}
                width={CHIP_W}
                height={72}
                rx={12}
                fill={s === "pending" ? SURFACE : `${c}12`}
                stroke={c}
                strokeWidth={isActive ? 2 : 1.2}
                animate={{ opacity: s === "pending" && active >= 0 && i > active ? 0.5 : 1 }}
                transition={{ duration: reduced ? 0 : 0.3 }}
                filter={s === "running" ? "url(#g-glow)" : undefined}
              />
              <text x={CHIP_X(i) + 14} y={48} fill={c} fontSize={16} fontFamily="monospace" fontWeight={700}>{g.id}</text>
              <motion.circle
                cx={CHIP_X(i) + CHIP_W - 16}
                cy={42}
                r={5}
                fill={c}
                animate={{ scale: s === "running" ? [1, 1.4, 1] : 1, opacity: s === "running" ? [0.7, 1, 0.7] : 1 }}
                transition={{ duration: reduced ? 0 : 1, repeat: s === "running" ? Infinity : 0 }}
              />
              <text x={CHIP_X(i) + 14} y={70} fill={BRIGHT} fontSize={10.5} fontFamily="monospace">{g.name}</text>
              <text x={CHIP_X(i) + 14} y={85} fill={MUTED} fontSize={8.5} fontFamily="monospace">{g.desc}</text>
            </g>
          );
        })}

        {/* build token */}
        {active >= 0 && (
          <motion.circle r={7} cy={60} fill={phase === "failed" ? ROSE : CYAN_GLOW} filter="url(#g-glow)" initial={false} animate={{ cx: CHIP_CX(active) }} transition={{ duration: reduced ? 0 : 0.4, ease: "easeInOut" }} />
        )}

        {/* detail panel */}
        <rect x={20} y={120} width={800} height={344} rx={14} fill={SURFACE} stroke={BORDER} strokeWidth={1} />
        <DetailProof active={active} status={activeStatus} regression={regression} reduced={reduced} nonce={nonce} />
      </svg>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3" style={{ borderColor: BORDER }}>
        <button
          onClick={runAll}
          disabled={busy}
          aria-label="Run the full Gauntlet"
          className={btnClass}
          style={{ borderColor: `${CYAN_GLOW}55`, color: CYAN_GLOW }}
        >
          <Play className="h-3.5 w-3.5" />
          Run Gauntlet
        </button>
        <button
          onClick={stepGate}
          disabled={busy || phase === "passed" || phase === "failed"}
          aria-label="Step the build through one gate"
          className={btnClass}
          style={{ borderColor: `${MUTED}44`, color: MUTED }}
        >
          <StepForward className="h-3.5 w-3.5" />
          Step
        </button>
        <button
          onClick={toggleRegression}
          disabled={busy}
          aria-label={regression ? "Clear the injected regression" : "Trigger a G1 regression"}
          className={cn(btnClass, regression && "ring-1")}
          style={{ borderColor: `${ROSE}66`, color: regression ? ROSE : MUTED }}
        >
          <Bug className="h-3.5 w-3.5" />
          {regression ? "Regression armed" : "Trigger regression"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail proof per gate                                             */
/* ------------------------------------------------------------------ */

function DetailProof({
  active,
  status,
  regression,
  reduced,
  nonce,
}: {
  active: number;
  status: GStatus;
  regression: boolean;
  reduced: boolean;
  nonce: number;
}) {
  if (active < 0) {
    return (
      <text x={420} y={300} textAnchor="middle" fill={SLATE} fontSize={13} fontFamily="monospace">
        press Run Gauntlet — every gate must pass to merge · G1 must match theory within Δ0.2
      </text>
    );
  }

  const g = GATES[active];
  const good = status === "pass" || status === "running";
  const drawDur = reduced ? 0 : 0.8;

  return (
    <g key={`${active}-${nonce}`}>
      {/* header */}
      <text x={44} y={152} fill={CYAN_GLOW} fontSize={15} fontFamily="monospace" fontWeight={700}>
        {g.id} · {g.name}
      </text>
      <text x={44} y={172} fill={MUTED} fontSize={11} fontFamily="monospace">
        {g.desc}
      </text>

      {active === 0 && <ProofG0 good={good} reduced={reduced} />}
      {active === 1 && <ProofG1 regression={regression} status={status} drawDur={drawDur} reduced={reduced} />}
      {active === 2 && <ProofG2 good={good} drawDur={drawDur} />}
      {active === 3 && <ProofG3 good={good} reduced={reduced} />}
      {active === 4 && <ProofG4 good={good} drawDur={drawDur} />}
      {active === 5 && <ProofG5 good={good} reduced={reduced} />}
    </g>
  );
}

/* --- G0: algebraic laws --- */
function ProofG0({ good, reduced }: { good: boolean; reduced: boolean }) {
  const laws = [
    "∀ a,b,c · (a∘b)∘c = a∘(b∘c)   associativity",
    "∀ a,b · a∘b = b∘a             commutativity",
    "∀ a · a∘e = a                 identity",
    "∀ a · a∘a⁻¹ = e               inverse",
  ];
  return (
    <g>
      {laws.map((law, i) => (
        <g key={i} transform={`translate(60, ${212 + i * 46})`}>
          <rect x={0} y={-22} width={720} height={36} rx={8} fill="#0a1620" stroke={BORDER} strokeWidth={1} />
          <motion.circle cx={20} cy={-4} r={6} fill={good ? EMERALD : SLATE} initial={{ scale: reduced ? 1 : 0 }} animate={{ scale: 1 }} transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.12 }} />
          <text x={40} y={0} fill={BRIGHT} fontSize={12} fontFamily="monospace">{law}</text>
          {good && <text x={700} y={0} textAnchor="end" fill={EMERALD} fontSize={12} fontFamily="monospace">✓</text>}
        </g>
      ))}
      <text x={60} y={420} fill={MUTED} fontSize={11} fontFamily="monospace">12,480 randomized cases · 0 shrinking counterexamples</text>
    </g>
  );
}

/* --- G1: order-of-accuracy convergence --- */
function ProofG1({
  regression,
  status,
  drawDur,
  reduced,
}: {
  regression: boolean;
  status: GStatus;
  drawDur: number;
  reduced: boolean;
}) {
  const observed = regression ? 3.6 : 3.98;
  const delta = Math.abs(THEORY_ORDER - observed);
  const pass = delta <= 0.2;
  const failing = status === "fail";
  const color = failing ? ROSE : CYAN_GLOW;

  // log-log plot geometry
  const N = 4;
  const xj = (j: number) => 530 + j * 76;
  const yj = (slope: number, j: number) => 210 + ((slope * j) / (THEORY_ORDER * (N - 1))) * 180;
  const obsPts = Array.from({ length: N }, (_, j) => `${xj(j)},${yj(observed, j)}`);
  const theoryLine = `M${xj(0)},${yj(THEORY_ORDER, 0)} L${xj(N - 1)},${yj(THEORY_ORDER, N - 1)}`;
  const obsLine = `M${xj(0)},${yj(observed, 0)} L${xj(N - 1)},${yj(observed, N - 1)}`;

  return (
    <g>
      <text x={60} y={216} fill={MUTED} fontSize={11.5} fontFamily="monospace">u(x) = sin(πx)·e^x   (manufactured)</text>
      <text x={60} y={238} fill={MUTED} fontSize={11.5} fontFamily="monospace">inject source f = L[u], refine h</text>
      <text x={60} y={260} fill={MUTED} fontSize={11.5} fontFamily="monospace">fit log‖e‖ vs log h → slope</text>
      {[1, 2, 4, 8].map((r, j) => (
        <text key={r} x={60} y={296 + j * 20} fill={SLATE} fontSize={10.5} fontFamily="monospace">h = 1/{r} · ‖e‖ = {Math.pow(1 / r, observed).toExponential(1)}</text>
      ))}
      <rect x={56} y={392} width={360} height={40} rx={8} fill={`${color}12`} stroke={color} strokeWidth={1.3} />
      <text x={74} y={417} fill={color} fontSize={14} fontFamily="monospace" fontWeight={700}>slope {observed.toFixed(2)} vs {THEORY_ORDER.toFixed(2)} Δ{delta.toFixed(2)} {pass ? "✓" : "✗"}</text>
      <line x1={500} y1={200} x2={500} y2={410} stroke={SLATE} strokeWidth={1.2} />
      <line x1={500} y1={410} x2={790} y2={410} stroke={SLATE} strokeWidth={1.2} />
      <text x={505} y={198} fill={MUTED} fontSize={9} fontFamily="monospace">‖e‖ (log)</text>
      <text x={790} y={426} textAnchor="end" fill={MUTED} fontSize={9} fontFamily="monospace">refine 1/h →</text>
      <path d={theoryLine} fill="none" stroke={`${LIME}77`} strokeWidth={1.6} strokeDasharray="5 4" />
      <text x={xj(N - 1) + 2} y={yj(THEORY_ORDER, N - 1) + 4} fill={LIME} fontSize={9} fontFamily="monospace">p=4.00</text>
      <motion.path d={obsLine} fill="none" stroke={color} strokeWidth={2.4} initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: drawDur }} filter="url(#g-glow)" />
      {obsPts.map((p, j) => {
        const [cx, cy] = p.split(",").map(Number);
        return <motion.circle key={j} cx={cx} cy={cy} r={4} fill={color} initial={{ scale: reduced ? 1 : 0 }} animate={{ scale: 1 }} transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : 0.3 + j * 0.12 }} />;
      })}
    </g>
  );
}

/* --- G2: physics envelopes --- */
function ProofG2({ good, drawDur: dur }: { good: boolean; drawDur: number }) {
  const benches = ["Poiseuille flow profile", "Sod shock tube", "lid-driven cavity Re=1000"];
  // schematic envelope band (closed path) + benchmark curve inside
  const upper = "M540,222 C610,210 680,238 760,216 L800,216";
  const lower = "M540,270 C610,258 680,286 760,264 L800,264";
  const band = "M540,222 C610,210 680,238 760,216 L800,216 L800,264 L760,264 C680,286 610,258 540,270 Z";
  const bench = "M540,246 C610,234 680,262 760,240 L800,240";
  return (
    <g>
      {benches.map((b, i) => (
        <g key={b} transform={`translate(60, ${216 + i * 34})`}>
          <circle cx={8} cy={-4} r={5} fill={good ? EMERALD : SLATE} />
          <text x={24} y={0} fill={BRIGHT} fontSize={12} fontFamily="monospace">{b}</text>
          {good && <text x={400} y={0} fill={EMERALD} fontSize={11} fontFamily="monospace">within envelope ✓</text>}
        </g>
      ))}
      <text x={60} y={340} fill={MUTED} fontSize={11} fontFamily="monospace">result curve stays inside the certified physical envelope</text>
      <path d={band} fill={`${TEAL}1e`} stroke="none" />
      <path d={upper} fill="none" stroke={`${TEAL}88`} strokeWidth={1.3} strokeDasharray="4 3" />
      <path d={lower} fill="none" stroke={`${TEAL}88`} strokeWidth={1.3} strokeDasharray="4 3" />
      <motion.path d={bench} fill="none" stroke={good ? CYAN_GLOW : SLATE} strokeWidth={2.2} initial={{ pathLength: dur === 0 ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur }} />
      <text x={540} y={300} fill={TEAL} fontSize={9.5} fontFamily="monospace">certified envelope</text>
    </g>
  );
}

/* --- G3: metamorphic relations --- */
function ProofG3({ good, reduced }: { good: boolean; reduced: boolean }) {
  const rels = ["scale", "permute", "reflect"];
  const c = good ? VIOLET : SLATE;
  return (
    <g>
      <rect x={70} y={210} width={130} height={54} rx={10} fill="#0a1620" stroke={c} strokeWidth={1.4} />
      <text x={135} y={235} textAnchor="middle" fill={BRIGHT} fontSize={13} fontFamily="monospace">f(x)</text>
      <text x={135} y={253} textAnchor="middle" fill={MUTED} fontSize={9.5} fontFamily="monospace">drag = 12.47</text>
      <motion.line x1={200} y1={237} x2={330} y2={237} stroke={c} strokeWidth={2} initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.5 }} />
      <text x={265} y={228} textAnchor="middle" fill={c} fontSize={11} fontFamily="monospace">T · x</text>
      <rect x={330} y={210} width={150} height={54} rx={10} fill="#0a1620" stroke={c} strokeWidth={1.4} />
      <text x={405} y={235} textAnchor="middle" fill={BRIGHT} fontSize={13} fontFamily="monospace">f(T·x)</text>
      <text x={405} y={253} textAnchor="middle" fill={MUTED} fontSize={9.5} fontFamily="monospace">= 2·12.47</text>
      <text x={520} y={242} fill={good ? EMERALD : SLATE} fontSize={13} fontFamily="monospace" fontWeight={700}>R(f(x), f(T·x)) holds {good ? "✓" : ""}</text>
      {rels.map((r, i) => (
        <g key={r} transform={`translate(70, ${312 + i * 30})`}>
          <circle cx={8} cy={-4} r={5} fill={good ? VIOLET : SLATE} />
          <text x={24} y={0} fill={BRIGHT} fontSize={11.5} fontFamily="monospace">metamorphic relation · {r}</text>
          {good && <text x={360} y={0} fill={EMERALD} fontSize={11} fontFamily="monospace">preserved ✓</text>}
        </g>
      ))}
    </g>
  );
}

/* --- G4: chaos / cancellation storms --- */
function ProofG4({ good, drawDur: dur }: { good: boolean; drawDur: number }) {
  const c = good ? CYAN_GLOW : SLATE;
  // deterministic jagged-but-bounded signal
  const ys = [0, 18, -14, 22, -20, 12, -24, 26, -10, 20, -18, 14, -22, 8, -16, 24, -12, 16];
  const x0 = 60;
  const step = (720 - x0) / (ys.length - 1);
  const midY = 300;
  const path = ys.map((y, i) => `${i === 0 ? "M" : "L"}${(x0 + i * step).toFixed(1)},${midY + y}`).join(" ");
  return (
    <g>
      <text x={60} y={216} fill={MUTED} fontSize={11.5} fontFamily="monospace">catastrophic cancellation storm + fault injection</text>
      <line x1={x0} y1={midY - 34} x2={720} y2={midY - 34} stroke={`${EMERALD}66`} strokeWidth={1.2} strokeDasharray="5 4" />
      <line x1={x0} y1={midY + 34} x2={720} y2={midY + 34} stroke={`${EMERALD}66`} strokeWidth={1.2} strokeDasharray="5 4" />
      <text x={724} y={midY - 30} fill={EMERALD} fontSize={9} fontFamily="monospace">+ε bound</text>
      <text x={724} y={midY + 40} fill={EMERALD} fontSize={9} fontFamily="monospace">−ε bound</text>
      <motion.path d={path} fill="none" stroke={c} strokeWidth={1.8} initial={{ pathLength: dur === 0 ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur }} />
      <g transform="translate(400, 236)">
        <path d="M2,0 L-6,14 L1,14 L-3,26 L9,10 L2,10 Z" fill={AMBER} stroke="none" />
        <text x={14} y={12} fill={AMBER} fontSize={10} fontFamily="monospace">fault injected @ t=9</text>
      </g>
      {good && <text x={60} y={392} fill={EMERALD} fontSize={12.5} fontFamily="monospace" fontWeight={600}>error stayed within ±ε under fault — recovered ✓</text>}
    </g>
  );
}

/* --- G5: determinism / cross-ISA --- */
function ProofG5({ good, reduced }: { good: boolean; reduced: boolean }) {
  const hash = "blake3:7c4e…a19f";
  const rows = ["run A · threads = 4  · x86-64", "run B · threads = 64 · aarch64"];
  const c = good ? EMERALD : SLATE;
  return (
    <g>
      {rows.map((label, i) => (
        <motion.g key={i} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : i * 0.2 }}>
          <rect x={70} y={194 + i * 60} width={560} height={44} rx={9} fill="#0a1620" stroke={BORDER} strokeWidth={1} />
          <text x={86} y={220 + i * 60} fill={BRIGHT} fontSize={12} fontFamily="monospace">{label}</text>
          <text x={614} y={220 + i * 60} textAnchor="end" fill={c} fontSize={12} fontFamily="monospace">{hash}</text>
        </motion.g>
      ))}
      <text x={350} y={352} textAnchor="middle" fill={c} fontSize={22} fontFamily="monospace" fontWeight={700}>≡</text>
      {good && <text x={70} y={408} fill={EMERALD} fontSize={13} fontFamily="monospace" fontWeight={600}>hashes identical across ISA / thread count — bit-identical ✓</text>}
    </g>
  );
}
