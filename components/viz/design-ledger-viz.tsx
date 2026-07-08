"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Play, Pause, StepForward, RotateCcw, GitBranch, Boxes, Waves, Sigma, Target } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette (FrankenSim)                                               */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const TEAL = "#14b8a6";
const VIOLET = "#a855f7";
const BLUE = "#3b82f6";
const AMBER = "#f59e0b";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

const EVIDENCE_COLOR: Record<Evidence, string> = {
  verified: "#22d3ee",
  validated: "#a3e635",
  estimated: "#fbbf24",
};

const TYPE_COLOR: Record<NType, string> = {
  geom: CYAN,
  field: TEAL,
  solve: BLUE,
  opt: AMBER,
};
const TYPE_LETTER: Record<NType, string> = { geom: "G", field: "F", solve: "S", opt: "O" };
const TYPE_ICON = { geom: Boxes, field: Waves, solve: Sigma, opt: Target } as const;

const VERSIONS: Record<NType, string> = {
  geom: "geom-core v2.1 · f64",
  field: "fields v1.3 · f64",
  solve: "cutfem v0.9 · kernels v1.4",
  opt: "nsga v0.6 · f64",
};

/* ------------------------------------------------------------------ */
/*  Types + data                                                       */
/* ------------------------------------------------------------------ */

type NType = "geom" | "field" | "solve" | "opt";
type Evidence = "verified" | "validated" | "estimated";

interface NodeDef {
  id: string;
  type: NType;
  name: string;
  x: number;
  y: number;
  inputs: string[];
  op: string;
  budget: string;
  evidence: Evidence;
  fork?: boolean;
}

const CARD_W = 108;
const CARD_H = 44;
const COLX = [64, 192, 320, 448, 576, 704];
const ROWY = [64, 150, 236];

const BASE_NODES: NodeDef[] = [
  { id: "g0", type: "geom", name: "mesh.v0", x: COLX[0], y: ROWY[1], inputs: [], op: "import_step", budget: "acc exact · 0.3s · 128MB", evidence: "verified" },
  { id: "f0", type: "field", name: "sdf φ", x: COLX[1], y: ROWY[0], inputs: ["g0"], op: "sdf_from_mesh", budget: "acc 1e-4 · 0.6s · 96MB", evidence: "verified" },
  { id: "g1", type: "geom", name: "mesh.v1", x: COLX[1], y: ROWY[2], inputs: ["g0"], op: "refine κ<1e-3", budget: "acc 1e-3 · 1.1s · 210MB", evidence: "validated" },
  { id: "s0", type: "solve", name: "forward u", x: COLX[2], y: ROWY[1], inputs: ["g1", "f0"], op: "cutfem_solve", budget: "acc 2e-3 · 4.2s · 1.4GB", evidence: "validated" },
  { id: "f1", type: "field", name: "state u", x: COLX[3], y: ROWY[0], inputs: ["s0"], op: "extract_state", budget: "acc 2e-3 · 0.2s · 640MB", evidence: "validated" },
  { id: "f2", type: "field", name: "adjoint λ", x: COLX[3], y: ROWY[1], inputs: ["s0"], op: "adjoint_solve", budget: "acc 2e-3 · 3.9s · 1.4GB", evidence: "validated" },
  { id: "s1", type: "solve", name: "grad ∇J", x: COLX[4], y: ROWY[1], inputs: ["f2", "f1"], op: "assemble_grad", budget: "acc 3e-3 · 0.5s · 512MB", evidence: "verified" },
  { id: "o0", type: "opt", name: "pareto A", x: COLX[5], y: ROWY[0], inputs: ["s1"], op: "nsga_step", budget: "acc 1e-2 · 2.0s · 256MB", evidence: "estimated" },
  { id: "o1", type: "opt", name: "pareto B", x: COLX[5], y: ROWY[2], inputs: ["s1"], op: "nsga_step", budget: "acc 1e-2 · 2.0s · 256MB", evidence: "estimated" },
];

const FORK_NODES: NodeDef[] = [
  { id: "s1f", type: "solve", name: "grad ∇J′", x: COLX[4], y: 316, inputs: ["f2"], op: "assemble_grad·alt-reg", budget: "acc 3e-3 · 0.6s · 512MB", evidence: "validated", fork: true },
  { id: "o0f", type: "opt", name: "pareto A′", x: COLX[5], y: 294, inputs: ["s1f"], op: "nsga_step·seed+1", budget: "acc 1e-2 · 2.0s · 256MB", evidence: "estimated", fork: true },
  { id: "o1f", type: "opt", name: "pareto B′", x: COLX[5], y: 340, inputs: ["s1f"], op: "nsga_step·seed+1", budget: "acc 1e-2 · 2.0s · 256MB", evidence: "estimated", fork: true },
];

type Ev = { kind: "node"; id: string } | { kind: "edge"; from: string; to: string };

// causal event stream: a node appears, then its derivation edges are recorded
const EVENTS: Ev[] = [];
for (const n of BASE_NODES) {
  EVENTS.push({ kind: "node", id: n.id });
  for (const inp of n.inputs) EVENTS.push({ kind: "edge", from: inp, to: n.id });
}
const MAX_STEP = EVENTS.length;

const NODE_STEP: Record<string, number> = {};
EVENTS.forEach((e, i) => {
  if (e.kind === "node") NODE_STEP[e.id] = i;
});

interface EdgeItem {
  from: string;
  to: string;
  idx: number;
}
const BASE_EDGES: EdgeItem[] = EVENTS.flatMap((e, i) => (e.kind === "edge" ? [{ from: e.from, to: e.to, idx: i }] : []));
const FORK_EDGES = FORK_NODES.flatMap((n) => n.inputs.map((f) => ({ from: f, to: n.id })));

const NODE_BY_ID: Record<string, NodeDef> = {};
for (const n of [...BASE_NODES, ...FORK_NODES]) NODE_BY_ID[n.id] = n;

/* deterministic blake3-style short hash (FNV-1a) */
function fnvHash(s: string): string {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let h2 = (h ^ 0x9e3779b9) >>> 0;
  h2 = Math.imul(h2, 0x01000193) >>> 0;
  return (h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}
const HASH: Record<string, string> = {};
for (const n of [...BASE_NODES, ...FORK_NODES]) HASH[n.id] = fnvHash(n.id + "|" + n.op);

function edgePath(a: NodeDef, b: NodeDef): string {
  const x1 = a.x + CARD_W;
  const y1 = a.y + CARD_H / 2;
  const x2 = b.x;
  const y2 = b.y + CARD_H / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function clockStr(step: number, forked: boolean): string {
  const m = step * 7 + (forked ? 42 : 0);
  return `${Math.floor(m / 60)}:${pad2(m % 60)}`;
}

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
/*  Node card                                                          */
/* ------------------------------------------------------------------ */

function NodeCard({
  node,
  selected,
  onSelect,
  reduced,
}: {
  node: NodeDef;
  selected: boolean;
  onSelect: (id: string) => void;
  reduced: boolean;
}) {
  const color = node.fork ? VIOLET : TYPE_COLOR[node.type];
  const ev = EVIDENCE_COLOR[node.evidence];
  return (
    <motion.g
      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: reduced ? 0 : 0.3, ease: "backOut" }}
      style={{ cursor: "pointer", transformOrigin: `${node.x + CARD_W / 2}px ${node.y + CARD_H / 2}px` }}
      onClick={() => onSelect(node.id)}
    >
      <rect
        x={node.x}
        y={node.y}
        width={CARD_W}
        height={CARD_H}
        rx={8}
        fill={node.fork ? `${VIOLET}12` : SURFACE}
        stroke={selected ? BRIGHT : color}
        strokeWidth={selected ? 2 : 1.3}
        filter={selected ? "url(#dl-glow)" : undefined}
      />
      {/* type badge */}
      <rect x={node.x + 8} y={node.y + 8} width={18} height={18} rx={4} fill={`${color}22`} stroke={color} strokeWidth={1} />
      <text x={node.x + 17} y={node.y + 21} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={700} fill={color}>
        {TYPE_LETTER[node.type]}
      </text>
      {/* name */}
      <text x={node.x + 32} y={node.y + 19} fontFamily="monospace" fontSize={11} fontWeight={600} fill={BRIGHT}>
        {node.name}
      </text>
      {/* hash chip */}
      <text x={node.x + 32} y={node.y + 34} fontFamily="monospace" fontSize={9} fill={MUTED}>
        blake3:{HASH[node.id].slice(0, 4)}
      </text>
      {/* evidence dot */}
      <circle cx={node.x + CARD_W - 11} cy={node.y + 11} r={4} fill={ev} />
    </motion.g>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function DesignLedgerViz() {
  const reduced = !!useReducedMotion();

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [forked, setForked] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playingRef = useRef(false);
  const playCountRef = useRef(0);

  const stopPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    playingRef.current = false;
    setPlaying(false);
  }, []);

  useEffect(() => () => stopPlay(), [stopPlay]);

  const play = useCallback(() => {
    if (playingRef.current) return;
    const start = step >= MAX_STEP ? 0 : step;
    if (step >= MAX_STEP) setStep(0);
    playCountRef.current = start;
    playingRef.current = true;
    setPlaying(true);
    // self-stopping interval (timer callback — setState here is fine, unlike inside an effect body)
    intervalRef.current = setInterval(() => {
      const next = Math.min(MAX_STEP, playCountRef.current + 1);
      playCountRef.current = next;
      setStep(next);
      if (next >= MAX_STEP) stopPlay();
    }, reduced ? 40 : 430);
  }, [step, reduced, stopPlay]);

  const stepFwd = useCallback(() => {
    stopPlay();
    setStep((s) => Math.min(MAX_STEP, s + 1));
  }, [stopPlay]);

  const toggleFork = useCallback(() => {
    stopPlay();
    setForked((f) => {
      const next = !f;
      if (next) setStep(MAX_STEP); // a fork only makes sense once the base lineage exists
      return next;
    });
  }, [stopPlay]);

  const reset = useCallback(() => {
    stopPlay();
    setStep(0);
    setForked(false);
    setSelected(null);
  }, [stopPlay]);

  const onScrub = useCallback(
    (v: number) => {
      stopPlay();
      setStep(v);
    },
    [stopPlay],
  );

  const nodeVisible = useCallback((id: string) => NODE_STEP[id] < step, [step]);

  const visibleBaseNodes = BASE_NODES.filter((n) => nodeVisible(n.id));
  const artifactCount = visibleBaseNodes.length + (forked ? FORK_NODES.length : 0);
  const eventCount = Math.min(step, MAX_STEP) + (forked ? FORK_NODES.length + FORK_EDGES.length : 0);

  const sel = selected ? NODE_BY_ID[selected] : null;
  const selVisible = sel ? (sel.fork ? forked : nodeVisible(sel.id)) : false;

  const clock = clockStr(step, forked);
  const status = useMemo(() => {
    if (step === 0) return "empty world · scrub or press Play to event-source the campaign";
    if (step < MAX_STEP) return `replaying event stream … ${step}/${MAX_STEP}`;
    if (forked) return "world forked — parallel lineage tinted violet";
    return "lineage complete · click any artifact to explain() its provenance";
  }, [step, forked]);

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:bg-white/5";

  return (
    <section
      className="w-full rounded-2xl border p-4 sm:p-5"
      style={{ background: BG, borderColor: BORDER }}
      aria-label="Design Ledger lineage DAG visualization"
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-bold tracking-tight" style={{ color: BRIGHT }}>
            The Design Ledger
          </h3>
          <p className="mt-0.5 font-mono text-[11px]" style={{ color: MUTED }}>
            content-addressed · event-sourced · time-travelable
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border px-3 py-1" style={{ borderColor: BORDER }}>
          <GitBranch size={12} color={forked ? VIOLET : CYAN_GLOW} />
          <span className="font-mono text-[11px] font-bold" style={{ color: forked ? VIOLET : CYAN_GLOW }}>
            {forked ? "2 worlds" : "1 world"}
          </span>
        </div>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 830 400"
        className="w-full"
        role="img"
        aria-label="A left-to-right lineage graph of content-addressed artifacts — geometry, fields, solves and optimization points — connected by derivation edges. A time scrubber reveals artifacts as their creation events are replayed; a fork branches a violet parallel lineage."
      >
        <defs>
          <filter id="dl-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* time axis */}
        {COLX.map((cx, i) => (
          <g key={`ax-${i}`}>
            <line x1={cx + CARD_W / 2} y1={40} x2={cx + CARD_W / 2} y2={378} stroke={`${SLATE}12`} strokeWidth={1} />
            <text x={cx + CARD_W / 2} y={30} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={`${MUTED}99`}>
              {clockStr(Math.min(i * 3 + 1, MAX_STEP), false)}
            </text>
          </g>
        ))}
        <text x={16} y={30} fontFamily="monospace" fontSize={9} fill={SLATE}>
          time →
        </text>

        {/* base edges */}
        {BASE_EDGES.map((e) => {
          const visible = e.idx < step;
          if (!visible) return null;
          const a = NODE_BY_ID[e.from];
          const b = NODE_BY_ID[e.to];
          return (
            <motion.path
              key={`e-${e.from}-${e.to}`}
              d={edgePath(a, b)}
              fill="none"
              stroke={`${TYPE_COLOR[b.type]}88`}
              strokeWidth={1.5}
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.35 }}
            />
          );
        })}

        {/* fork edges */}
        <AnimatePresence>
          {forked &&
            FORK_EDGES.map((e) => {
              const a = NODE_BY_ID[e.from];
              const b = NODE_BY_ID[e.to];
              return (
                <motion.path
                  key={`fe-${e.from}-${e.to}`}
                  d={edgePath(a, b)}
                  fill="none"
                  stroke={`${VIOLET}88`}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.4 }}
                />
              );
            })}
        </AnimatePresence>

        {/* base nodes */}
        <AnimatePresence>
          {visibleBaseNodes.map((n) => (
            <NodeCard key={n.id} node={n} selected={selected === n.id} onSelect={setSelected} reduced={reduced} />
          ))}
        </AnimatePresence>

        {/* fork nodes */}
        <AnimatePresence>
          {forked &&
            FORK_NODES.map((n) => (
              <NodeCard key={n.id} node={n} selected={selected === n.id} onSelect={setSelected} reduced={reduced} />
            ))}
        </AnimatePresence>

        {/* evidence legend */}
        <g transform="translate(64, 386)">
          {(["verified", "validated", "estimated"] as Evidence[]).map((k, i) => (
            <g key={k} transform={`translate(${i * 118}, 0)`}>
              <circle cx={0} cy={-3} r={4} fill={EVIDENCE_COLOR[k]} />
              <text x={10} y={0} fontFamily="monospace" fontSize={9} fill={MUTED}>
                {k}
              </text>
            </g>
          ))}
          <g transform="translate(470, 0)">
            <rect x={-4} y={-9} width={12} height={12} rx={3} fill={`${VIOLET}22`} stroke={VIOLET} strokeWidth={1} />
            <text x={14} y={0} fontFamily="monospace" fontSize={9} fill={VIOLET}>
              forked world
            </text>
          </g>
        </g>
      </svg>

      {/* Scrubber */}
      <div className="mt-3 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          t
        </span>
        <input
          type="range"
          min={0}
          max={MAX_STEP}
          step={1}
          value={step}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Time scrubber: replay the artifact event stream"
          className="h-1 w-full cursor-pointer appearance-none rounded-full"
          style={{ accentColor: CYAN, background: `${SLATE}55` }}
        />
        <span className="shrink-0 font-mono text-[11px] font-bold" style={{ color: CYAN_GLOW }}>
          {clock}
        </span>
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CtrlButton onClick={playing ? stopPlay : play} active={playing} color="#10b981" label={playing ? "Pause replay" : "Play event replay"}>
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? "Pause" : "Play"}
        </CtrlButton>
        <CtrlButton onClick={stepFwd} disabled={playing || step >= MAX_STEP} color={CYAN_GLOW} label="Record next event">
          <StepForward size={13} />
          Step
        </CtrlButton>
        <CtrlButton onClick={toggleFork} active={forked} color={VIOLET} label={forked ? "Merge the forked world back" : "Fork the world into a parallel lineage"}>
          <GitBranch size={13} />
          {forked ? "Merge world" : "Fork world"}
        </CtrlButton>
        <CtrlButton onClick={reset} color={SLATE} label="Reset the ledger">
          <RotateCcw size={13} />
          Reset
        </CtrlButton>
      </div>

      {/* Status readout */}
      <div
        className="mt-3 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span> artifacts {artifactCount} · events {eventCount} · @ t={clock} ·{" "}
        <span style={{ color: sel ? EVIDENCE_COLOR[sel.evidence] : MUTED }}>
          explain({sel ? HASH[sel.id].slice(0, 4) : "—"})
        </span>{" "}
        <span style={{ color: SLATE }}>│</span> <span style={{ color: MUTED }}>{status}</span>
      </div>

      {/* explain() panel */}
      <AnimatePresence mode="wait">
        {sel && (
          <motion.div
            key={sel.id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="mt-3 rounded-lg border p-3"
            style={{ borderColor: sel.fork ? `${VIOLET}55` : BORDER, background: "#0a1620" }}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = TYPE_ICON[sel.type];
                  const c = sel.fork ? VIOLET : TYPE_COLOR[sel.type];
                  return <Icon size={15} color={c} />;
                })()}
                <span className="font-mono text-xs font-bold" style={{ color: BRIGHT }}>
                  explain(<span style={{ color: sel.fork ? VIOLET : TYPE_COLOR[sel.type] }}>{sel.name}</span>)
                </span>
                {!selVisible && (
                  <span className="font-mono text-[10px]" style={{ color: SLATE }}>
                    · not yet recorded at t={clock}
                  </span>
                )}
              </div>
              <span
                className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold"
                style={{ borderColor: EVIDENCE_COLOR[sel.evidence], color: EVIDENCE_COLOR[sel.evidence] }}
              >
                {sel.evidence}
              </span>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-2">
              <div className="flex gap-2">
                <dt style={{ color: SLATE }}>hash</dt>
                <dd style={{ color: CYAN_GLOW }}>blake3:{HASH[sel.id]}</dd>
              </div>
              <div className="flex gap-2">
                <dt style={{ color: SLATE }}>op</dt>
                <dd style={{ color: BRIGHT }}>{sel.op}</dd>
              </div>
              <div className="flex gap-2">
                <dt style={{ color: SLATE }}>budget</dt>
                <dd style={{ color: MUTED }}>{sel.budget}</dd>
              </div>
              <div className="flex gap-2">
                <dt style={{ color: SLATE }}>seed</dt>
                <dd style={{ color: MUTED }}>0x{HASH[sel.id].slice(0, 8).toUpperCase()}</dd>
              </div>
              <div className="flex gap-2">
                <dt style={{ color: SLATE }}>versions</dt>
                <dd style={{ color: MUTED }}>{VERSIONS[sel.type]}</dd>
              </div>
              <div className="flex gap-2">
                <dt style={{ color: SLATE }}>caps</dt>
                <dd style={{ color: MUTED }}>fs.read · cpu.f64{sel.fork ? " · fork" : ""}</dd>
              </div>
              <div className="col-span-full flex flex-wrap gap-2">
                <dt style={{ color: SLATE }}>inputs</dt>
                <dd className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {sel.inputs.length === 0 ? (
                    <span style={{ color: SLATE }}>∅ (root artifact)</span>
                  ) : (
                    sel.inputs.map((inp) => (
                      <button
                        key={inp}
                        type="button"
                        onClick={() => setSelected(inp)}
                        aria-label={`Jump to input ${NODE_BY_ID[inp].name}`}
                        className={cn(btnClass, "px-2 py-0.5")}
                        style={{ borderColor: BORDER, color: BRIGHT }}
                      >
                        <span style={{ color: TYPE_COLOR[NODE_BY_ID[inp].type] }}>{NODE_BY_ID[inp].name}</span>
                        <span style={{ color: MUTED }}>blake3:{HASH[inp].slice(0, 4)}</span>
                      </button>
                    ))
                  )}
                </dd>
              </div>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
