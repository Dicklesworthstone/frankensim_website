"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion, springs } from "@/components/motion";
import { Footprints, Play, Shuffle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const AMBER = "#fbbf24";
const ROSE = "#f43f5e";
const LIME = "#a3e635";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";

/* ------------------------------------------------------------------ */
/*  Čech cocycle model                                                 */
/*                                                                     */
/*  N arcs U0..U5 cover a loop (S¹). Consecutive arcs overlap; each    */
/*  overlap carries an additive transition offset g_{i,i+1} ∈ ℝ.       */
/*                                                                     */
/*  The nerve is a cycle graph (1-dimensional) → NO triple overlaps,   */
/*  so the Čech differential δ:C¹→C² is the zero map: every 1-cochain  */
/*  is automatically a cocycle (δg = 0, "pairwise consistent").        */
/*                                                                     */
/*  H¹(S¹) ≅ ℝ, detected by the LOOP SUM (holonomy) S = Σ g_i, which   */
/*  is invariant under coboundaries  g_i → g_i + (h_i − h_{i+1})       */
/*  (telescopes to 0 around the cycle). So:                            */
/*    • S = 0  ⇔  the class is trivial (a coboundary): re-gauge can    */
/*               absorb every offset into patch relabels → all g_i = 0 */
/*               ("auto-fixable bookkeeping").                         */
/*    • S ≠ 0  ⇔  the class is harmonic / nontrivial: re-gauge only    */
/*               shuffles the defect around the ring; Σ|g_i| bottoms   */
/*               out at |S| and never reaches 0 ("structural").        */
/* ------------------------------------------------------------------ */

type Mode = "coboundary" | "harmonic";

const N = 6;

/* Gauge representatives per mode. Every rep within a mode has the SAME
   loop sum (holonomy) — so cycling between them is an honest coboundary
   re-gauge (equal sum on a cycle ⇔ they differ by a coboundary). */
const REPS: Record<Mode, number[][]> = {
  // loop sum 0 everywhere; offsets drain to 0 → the mismatch was labelling
  coboundary: [
    [2, -3, 1, 2, -1, -1],
    [1, -1, 0, 1, 0, -1],
    [0, 0, 0, 0, 0, 0],
  ],
  // loop sum 3 everywhere; the defect slides but Σ|g| never drops below 3
  harmonic: [
    [1, -1, 2, 0, 1, 0],
    [3, 0, 0, 0, 0, 0],
    [0, 3, 0, 0, 0, 0],
    [0, 0, 3, 0, 0, 0],
    [0, 0, 0, 3, 0, 0],
    [0, 0, 0, 0, 3, 0],
    [0, 0, 0, 0, 0, 3],
  ],
};

const SUB = ["₀", "₁", "₂", "₃", "₄", "₅", "₆"];
const sgn = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "0");
const offColor = (n: number) => (n > 0 ? CYAN_GLOW : n < 0 ? VIOLET : SLATE);

/* ------------------------------------------------------------------ */
/*  Ring geometry                                                      */
/* ------------------------------------------------------------------ */

const CX = 240;
const CY = 248;
const R_IN = 112;
const R_OUT = 182;
const R_MARK = 165; // marker travel radius (crosses the overlap bands)
const R_LABEL = 124; // patch label radius
const R_RELABEL = 100; // re-gauge tag radius
const R_BADGE = R_OUT + 24; // offset badge radius

function polar(r: number, angDeg: number): [number, number] {
  const a = (angDeg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function annularSector(rIn: number, rOut: number, a0: number, a1: number): string {
  const [x0o, y0o] = polar(rOut, a0);
  const [x1o, y1o] = polar(rOut, a1);
  const [x1i, y1i] = polar(rIn, a1);
  const [x0i, y0i] = polar(rIn, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

const patchCenter = (i: number) => -90 + 60 * i; // U0 at top
const edgeMid = (i: number) => patchCenter(i) + 30; // overlap i between Ui, U(i+1)

const PATCHES = Array.from({ length: N }, (_, i) => {
  const c = patchCenter(i);
  return {
    i,
    path: annularSector(R_IN, R_OUT, c - 36, c + 36),
    label: polar(R_LABEL, c),
    relabel: polar(R_RELABEL, c),
  };
});

const EDGES = Array.from({ length: N }, (_, i) => {
  const m = edgeMid(i);
  return {
    i,
    next: (i + 1) % N,
    overlap: annularSector(R_IN, R_OUT, m - 6, m + 6),
    mid: polar(R_MARK, m),
    badge: polar(R_BADGE, m),
  };
});

const markerPos = (crossed: number): [number, number] => polar(R_MARK, -90 + 60 * crossed);

/* ------------------------------------------------------------------ */
/*  Buttons                                                            */
/* ------------------------------------------------------------------ */

function Btn({
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
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 py-2 font-mono text-xs transition-colors hover:bg-white/5",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
      style={{ borderColor: `${color}55`, color }}
    >
      {children}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ObstructionH1Viz() {
  const reduced = useReducedMotion() ?? false;

  const [mode, setMode] = useState<Mode>("harmonic");
  const [gaugeIdx, setGaugeIdx] = useState(0);
  const [offsets, setOffsets] = useState<number[]>(REPS.harmonic[0]);
  const [crossed, setCrossed] = useState(0); // 0..N edges traversed by the marker
  const [busy, setBusy] = useState(false);
  const [relabel, setRelabel] = useState<number[]>(() => new Array(N).fill(0));

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

  const trans = reduced ? { duration: 0 } : springs.smooth;

  /* ---- derived ---- */
  const holonomy = offsets.reduce((a, b) => a + b, 0); // loop sum = H¹ class in ℝ
  const localMismatch = offsets.reduce((a, b) => a + Math.abs(b), 0); // Σ|g|
  const isCoboundary = holonomy === 0;
  const floorMismatch = Math.abs(holonomy); // min achievable Σ|g|
  const classColor = isCoboundary ? LIME : ROSE;

  // running transported value after k crossings
  const partials: number[] = [0];
  for (let k = 0; k < N; k++) partials.push(partials[k] + offsets[k]);
  const phi = partials[crossed];
  const done = crossed >= N;
  const walking = busy;

  const phiColor = done ? classColor : crossed > 0 ? AMBER : MUTED;
  const justEdge = crossed > 0 && crossed <= N ? crossed - 1 : null;

  /* ---- transitions between gauge reps (honest coboundary) ---- */
  const applyOffsets = useCallback(
    (next: number[], curr: number[]) => {
      // coboundary h with next[i]-curr[i] = h[i]-h[i+1], gauge-fixed h[0]=0
      const h = new Array(N).fill(0);
      for (let i = 1; i < N; i++) h[i] = h[i - 1] - (next[i - 1] - curr[i - 1]);
      setRelabel(h);
      setOffsets(next);
      setCrossed(0); // re-walk to confirm the invariant
      if (!reduced) schedule(() => setRelabel(new Array(N).fill(0)), 1500);
    },
    [reduced, schedule],
  );

  /* ---- controls ---- */
  const step = useCallback(() => {
    clearTimers();
    setBusy(false);
    setCrossed((c) => (c >= N ? 0 : c + 1));
  }, [clearTimers]);

  const walk = useCallback(() => {
    clearTimers();
    setCrossed(0);
    if (reduced) {
      setCrossed(N);
      return;
    }
    setBusy(true);
    for (let k = 1; k <= N; k++) {
      schedule(() => {
        setCrossed(k);
        if (k === N) setBusy(false);
      }, k * 540);
    }
  }, [clearTimers, reduced, schedule]);

  const regauge = useCallback(() => {
    clearTimers();
    setBusy(false);
    const reps = REPS[mode];
    const nextIdx =
      mode === "coboundary" ? Math.min(gaugeIdx + 1, reps.length - 1) : (gaugeIdx + 1) % reps.length;
    setGaugeIdx(nextIdx);
    applyOffsets(reps[nextIdx], offsets);
  }, [clearTimers, mode, gaugeIdx, offsets, applyOffsets]);

  const switchMode = useCallback(
    (m: Mode) => {
      clearTimers();
      setBusy(false);
      setMode(m);
      setGaugeIdx(0);
      setOffsets(REPS[m][0]);
      setCrossed(0);
      setRelabel(new Array(N).fill(0));
    },
    [clearTimers],
  );

  const reset = useCallback(() => {
    clearTimers();
    setBusy(false);
    setGaugeIdx(0);
    setOffsets(REPS[mode][0]);
    setCrossed(0);
    setRelabel(new Array(N).fill(0));
  }, [clearTimers, mode]);

  const regaugeDisabled = mode === "coboundary" && gaugeIdx >= REPS.coboundary.length - 1;

  /* ---- readouts ---- */
  const statusLine = isCoboundary
    ? "coboundary — trivial class, auto-fixable bookkeeping"
    : "harmonic — nontrivial class, structural obstruction";
  const lampColor = walking ? AMBER : classColor;

  const [mx, my] = markerPos(crossed);

  const seg = "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 py-2 font-mono text-xs transition-colors";

  return (
    <div className="w-full rounded-2xl border" style={{ background: SURFACE, borderColor: BORDER }}>
      {/* Header status line */}
      <div
        className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3"
        style={{ borderColor: BORDER, background: BG }}
      >
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: lampColor, boxShadow: `0 0 8px ${lampColor}aa` }}
        />
        <span className="font-mono text-xs sm:text-sm" style={{ color: classColor }}>
          {statusLine}
        </span>
        <span className="font-mono text-xs" style={{ color: MUTED }}>
          · holonomy Σg = <span style={{ color: classColor, fontWeight: 700 }}>{sgn(holonomy)}</span>
        </span>
      </div>

      {/* SVG canvas */}
      <svg
        viewBox="0 0 720 500"
        className="w-full"
        style={{ maxHeight: 540 }}
        role="img"
        aria-label="A loop is covered by six overlapping arcs, each overlap carrying a transition offset. A marker transports a value around the loop, accumulating offsets. The residual on return is the holonomy — the first Čech cohomology class. A coboundary re-gauge drains a trivial class to zero offsets, but a harmonic class only slides around the ring and never vanishes."
      >
        <defs>
          <filter id="h1-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* faint guide circle = the loop being covered */}
        <circle cx={CX} cy={CY} r={(R_IN + R_OUT) / 2} fill="none" stroke={`${CYAN}22`} strokeWidth={1} strokeDasharray="2 6" />

        {/* completion halo */}
        <AnimatePresence>
          {done && (
            <motion.circle
              key={`halo-${isCoboundary}`}
              cx={CX}
              cy={CY}
              r={(R_IN + R_OUT) / 2}
              fill="none"
              stroke={classColor}
              strokeWidth={2}
              filter="url(#h1-glow)"
              initial={{ opacity: reduced ? 0.5 : 0 }}
              animate={reduced ? { opacity: 0.5 } : { opacity: [0, 0.9, 0.5] }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.9 }}
            />
          )}
        </AnimatePresence>

        {/* patch arcs */}
        {PATCHES.map((p) => (
          <path key={p.i} d={p.path} fill={`${CYAN}12`} stroke={`${CYAN}55`} strokeWidth={1} />
        ))}

        {/* overlap bands (brighter — where two arcs coincide) */}
        {EDGES.map((e) => (
          <path key={e.i} d={e.overlap} fill={`${CYAN_GLOW}22`} stroke={`${CYAN_GLOW}40`} strokeWidth={0.75} />
        ))}

        {/* patch labels */}
        {PATCHES.map((p) => (
          <text
            key={p.i}
            x={p.label[0]}
            y={p.label[1] + 5}
            textAnchor="middle"
            fill={`${BRIGHT}cc`}
            fontSize={16}
            fontFamily="monospace"
            fontWeight={700}
            style={{ userSelect: "none" }}
          >
            U{SUB[p.i]}
          </text>
        ))}

        {/* re-gauge relabel tags (h_i absorbed into patch labels) */}
        <AnimatePresence>
          {relabel.map((h, i) =>
            h !== 0 ? (
              <motion.text
                key={`rl-${i}-${h}`}
                x={PATCHES[i].relabel[0]}
                y={PATCHES[i].relabel[1] + 3}
                textAnchor="middle"
                fill={VIOLET}
                fontSize={10.5}
                fontFamily="monospace"
                fontWeight={600}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.25 }}
              >
                ↻h={sgn(h)}
              </motion.text>
            ) : null,
          )}
        </AnimatePresence>

        {/* offset badges g_{i,i+1} */}
        {EDGES.map((e) => {
          const g = offsets[e.i];
          const c = offColor(g);
          return (
            <g key={e.i}>
              <line x1={e.mid[0]} y1={e.mid[1]} x2={e.badge[0]} y2={e.badge[1]} stroke={`${c}44`} strokeWidth={1} />
              <motion.circle
                cx={e.badge[0]}
                cy={e.badge[1]}
                r={17}
                animate={{ fill: `${c}1f`, stroke: c }}
                transition={trans}
                strokeWidth={1.2}
              />
              <text
                x={e.badge[0]}
                y={e.badge[1] - 3}
                textAnchor="middle"
                fill={`${MUTED}`}
                fontSize={7.5}
                fontFamily="monospace"
              >
                g{SUB[e.i]}
                {SUB[e.next]}
              </text>
              <AnimatePresence mode="wait">
                <motion.text
                  key={`${e.i}-${g}`}
                  x={e.badge[0]}
                  y={e.badge[1] + 9}
                  textAnchor="middle"
                  fill={c}
                  fontSize={13}
                  fontFamily="monospace"
                  fontWeight={700}
                  initial={{ opacity: reduced ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.2 }}
                >
                  {sgn(g)}
                </motion.text>
              </AnimatePresence>
            </g>
          );
        })}

        {/* crossing ripple */}
        <AnimatePresence>
          {justEdge !== null && !reduced && (
            <motion.circle
              key={`ripple-${crossed}`}
              cx={EDGES[justEdge].mid[0]}
              cy={EDGES[justEdge].mid[1]}
              fill="none"
              stroke={AMBER}
              strokeWidth={2}
              initial={{ r: 5, opacity: 0.85 }}
              animate={{ r: 22, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* base point at U0 (start = return) */}
        <g>
          <circle cx={polar(R_MARK, -90)[0]} cy={polar(R_MARK, -90)[1]} r={5} fill="none" stroke={`${SLATE}`} strokeWidth={1.4} strokeDasharray="2 2" />
          <text x={polar(R_MARK, -90)[0]} y={polar(R_MARK, -90)[1] - 14} textAnchor="middle" fill={SLATE} fontSize={9} fontFamily="monospace">
            base φ₀=0
          </text>
        </g>

        {/* central transported-value readout */}
        <text x={CX} y={CY - 22} textAnchor="middle" fill={MUTED} fontSize={10.5} fontFamily="monospace" letterSpacing={0.5}>
          transported φ
        </text>
        <AnimatePresence mode="wait">
          <motion.text
            key={`phi-${crossed}-${phi}`}
            x={CX}
            y={CY + 14}
            textAnchor="middle"
            fill={phiColor}
            fontSize={40}
            fontFamily="monospace"
            fontWeight={800}
            initial={{ opacity: reduced ? 1 : 0, y: reduced ? CY + 14 : CY + 22 }}
            animate={{ opacity: 1, y: CY + 14 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
          >
            {sgn(phi)}
          </motion.text>
        </AnimatePresence>
        <text x={CX} y={CY + 36} textAnchor="middle" fill={SLATE} fontSize={10} fontFamily="monospace">
          {done ? (isCoboundary ? "= 0 · loop closes" : "≠ 0 · residual = Σg") : `crossed ${crossed}/${N}`}
        </text>

        {/* traveling marker */}
        <motion.g initial={false} animate={{ x: mx, y: my }} transition={walking ? { duration: reduced ? 0 : 0.5, ease: "easeInOut" } : trans}>
          <circle cx={0} cy={0} r={13} fill={`${AMBER}33`} />
          <circle cx={0} cy={0} r={8} fill={BRIGHT} stroke={AMBER} strokeWidth={2} />
        </motion.g>

        {/* ---- side panel ---- */}
        <g>
          <rect x={468} y={44} width={240} height={414} rx={12} fill={BG} stroke={BORDER} strokeWidth={1} />

          {/* cocycle line (always true) */}
          <circle cx={484} cy={70} r={3} fill={CYAN_GLOW} />
          <text x={494} y={74} fill={`${CYAN_GLOW}cc`} fontSize={10.5} fontFamily="monospace">
            δg = 0 · cocycle ✓
          </text>
          <text x={484} y={90} fill={SLATE} fontSize={9} fontFamily="monospace">
            (no triple overlaps on a ring)
          </text>

          {/* holonomy */}
          <text x={484} y={116} fill={MUTED} fontSize={10.5} fontFamily="monospace" letterSpacing={0.5}>
            HOLONOMY  Σ g
          </text>
          <motion.text x={484} y={150} fontSize={30} fontFamily="monospace" fontWeight={800} animate={{ fill: classColor }} transition={trans}>
            {sgn(holonomy)}
          </motion.text>
          <text x={556} y={150} fill={classColor} fontSize={10.5} fontFamily="monospace">
            {isCoboundary ? "[g] = 0" : "[g] ≠ 0"}
          </text>
          <text x={556} y={135} fill={SLATE} fontSize={9} fontFamily="monospace">
            invariant
          </text>

          {/* local mismatch */}
          <text x={484} y={176} fill={MUTED} fontSize={10} fontFamily="monospace">
            local mismatch Σ|g| ={" "}
            <tspan fill={localMismatch === 0 ? LIME : AMBER} fontWeight={700}>
              {localMismatch}
            </tspan>
          </text>
          <text x={484} y={191} fill={SLATE} fontSize={9} fontFamily="monospace">
            floor = |Σg| = {floorMismatch} {isCoboundary ? "→ drains to 0" : "→ cannot reach 0"}
          </text>

          {/* verdict chip */}
          <motion.rect x={484} y={202} width={208} height={26} rx={13} animate={{ fill: `${classColor}1f`, stroke: classColor }} transition={trans} strokeWidth={1.2} />
          <motion.text x={588} y={219} textAnchor="middle" fontSize={11} fontFamily="monospace" fontWeight={700} animate={{ fill: classColor }} transition={trans}>
            {isCoboundary ? "AUTO-FIXABLE bookkeeping" : "STRUCTURAL merge conflict"}
          </motion.text>

          <line x1={484} y1={242} x2={692} y2={242} stroke={BORDER} strokeWidth={1} />

          {/* transport ledger */}
          <text x={484} y={260} fill={MUTED} fontSize={10.5} fontFamily="monospace" letterSpacing={0.5}>
            TRANSPORT LEDGER
          </text>
          {EDGES.map((e, i) => {
            const rowY = 272 + i * 26;
            const active = i < crossed;
            const current = i === crossed - 1;
            return (
              <g key={i}>
                {current && <rect x={478} y={rowY - 2} width={220} height={22} rx={5} fill={`${AMBER}18`} />}
                <text x={486} y={rowY + 13} fill={active ? BRIGHT : SLATE} fontSize={10.5} fontFamily="monospace">
                  U{SUB[e.i]}→U{SUB[e.next]}
                </text>
                <text x={576} y={rowY + 13} fill={active ? offColor(offsets[i]) : `${SLATE}99`} fontSize={10.5} fontFamily="monospace" fontWeight={active ? 700 : 400}>
                  {sgn(offsets[i])}
                </text>
                <text x={686} y={rowY + 13} textAnchor="end" fill={active ? BRIGHT : `${SLATE}99`} fontSize={10.5} fontFamily="monospace">
                  φ={sgn(partials[i + 1])}
                </text>
              </g>
            );
          })}

          {/* return row */}
          <line x1={484} y1={434} x2={692} y2={434} stroke={`${BORDER}`} strokeWidth={1} strokeDasharray="2 3" />
          <text x={486} y={450} fill={done ? classColor : SLATE} fontSize={10.5} fontFamily="monospace" fontWeight={700}>
            back at U₀ → φ = {sgn(holonomy)}
          </text>
        </g>

        {/* caption */}
        <text x={CX} y={480} textAnchor="middle" fill={`${MUTED}aa`} fontSize={10.5} fontFamily="monospace">
          6-arc Čech cover of a loop · transport composes the transitions gᵢ,ᵢ₊₁
        </text>
      </svg>

      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 pt-3" style={{ borderColor: BORDER }}>
        <span className="font-mono text-[11px]" style={{ color: SLATE }}>
          class:
        </span>
        <button
          onClick={() => switchMode("coboundary")}
          aria-label="Inspect a coboundary (fixable) cocycle"
          aria-pressed={mode === "coboundary"}
          className={seg}
          style={{
            borderColor: mode === "coboundary" ? LIME : `${SLATE}55`,
            color: mode === "coboundary" ? LIME : MUTED,
            background: mode === "coboundary" ? `${LIME}14` : "transparent",
          }}
        >
          coboundary (fixable)
        </button>
        <button
          onClick={() => switchMode("harmonic")}
          aria-label="Inspect a harmonic (structural) cocycle"
          aria-pressed={mode === "harmonic"}
          className={seg}
          style={{
            borderColor: mode === "harmonic" ? ROSE : `${SLATE}55`,
            color: mode === "harmonic" ? ROSE : MUTED,
            background: mode === "harmonic" ? `${ROSE}14` : "transparent",
          }}
        >
          harmonic (structural)
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-2">
        <Btn onClick={step} color={CYAN_GLOW} label={done ? "Restart walk" : "Step"} ariaLabel="Step the marker across one overlap">
          <Footprints className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={walk} color={AMBER} label="Walk loop" ariaLabel="Transport the marker around the whole loop">
          <Play className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          onClick={regauge}
          color={VIOLET}
          label={regaugeDisabled ? "Re-gauged ✓" : "Re-gauge patches"}
          ariaLabel="Apply a coboundary re-gauge: redistribute offsets by relabelling patches"
          disabled={regaugeDisabled}
        >
          <Shuffle className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={reset} color={SLATE} label="Reset" ariaLabel="Reset the cover to its initial offsets">
          <RotateCcw className="h-3.5 w-3.5" />
        </Btn>
      </div>

      {/* Legend / teaching footnote */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: BORDER, color: MUTED }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: LIME }} />
          coboundary: Σg=0, offsets drain to 0 — labelling artefact, auto-fixable
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ROSE }} />
          harmonic: Σg≠0, defect only slides — FrankenSim surfaces it as structural
        </span>
        <span style={{ color: SLATE }}>H¹ = cocycles / coboundaries · re-gauge preserves the loop sum</span>
      </div>
    </div>
  );
}
