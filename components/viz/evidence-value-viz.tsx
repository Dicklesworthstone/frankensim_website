"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Layers, Hash, GitBranch, Plus, ChevronsDownUp, Eye, EyeOff, RotateCcw } from "lucide-react";
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
const VERIFIED = "#22d3ee";
const ESTIMATED = "#fbbf24";

/* ------------------------------------------------------------------ */
/*  Uncertainty model                                                 */
/* ------------------------------------------------------------------ */

type SliceKey = "numerical" | "statistical" | "model" | "sensitivity";
const SLICE_ORDER: SliceKey[] = ["numerical", "statistical", "model", "sensitivity"];
const SLICE_COLOR: Record<SliceKey, string> = {
  numerical: "#06b6d4", // cyan
  statistical: "#a855f7", // violet
  model: "#f59e0b", // amber
  sensitivity: "#14b8a6", // teal
};
const SLICE_LABEL: Record<SliceKey, string> = {
  numerical: "numerical",
  statistical: "statistical",
  model: "model-form",
  sensitivity: "sensitivity",
};
const SLICE_DESC: Record<SliceKey, string> = {
  numerical: "rounding · discretization · interval bound",
  statistical: "Monte-Carlo / sampling error",
  model: "physics approximation / closure",
  sensitivity: "propagated input uncertainty",
};

type Slices = Record<SliceKey, number>; // units of 1e-2 relative error

type TermKey = "drag" | "lift" | "side";
const TERMS: Record<TermKey, { value: number; slices: Slices }> = {
  drag: { value: 12.47, slices: { numerical: 0.5, statistical: 0.8, model: 1.4, sensitivity: 0.7 } },
  lift: { value: 9.83, slices: { numerical: 0.4, statistical: 1.0, model: 1.6, sensitivity: 0.9 } },
  side: { value: 2.71, slices: { numerical: 0.3, statistical: 0.6, model: 1.1, sensitivity: 0.5 } },
};
const ADD_ORDER: TermKey[] = ["lift", "side"];

const AXIS = 12; // bar full-scale (1e-2)
const CAP = 8; // certification budget cap (1e-2)

/* deterministic blake3-style short hash (FNV-1a, fully seeded from state) */
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

interface Derived {
  slices: Slices;
  total: number;
  value: number;
  grade: "verified" | "estimated";
  hash: string;
}

function derive(included: TermKey[], tighten: number): Derived {
  const slices: Slices = { numerical: 0, statistical: 0, model: 0, sensitivity: 0 };
  let sumSq = 0;
  for (const t of included) {
    const term = TERMS[t];
    for (const k of SLICE_ORDER) slices[k] += term.slices[k]; // conservative linear composition
    sumSq += term.value * term.value;
  }
  slices.numerical *= Math.pow(0.5, tighten); // spend budget → shrink numerical bound
  const total = SLICE_ORDER.reduce((a, k) => a + slices[k], 0);
  const value = Math.sqrt(sumSq);
  const grade: Derived["grade"] = total <= CAP ? "verified" : "estimated";
  const hash = fnvHash(`${included.join("+")}|t${tighten}`);
  return { slices, total, value, grade, hash };
}

const fmtErr = (v: number) => `${v.toFixed(1)}e-2`;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function EvidenceValueViz() {
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const [included, setIncluded] = useState<TermKey[]>(["drag"]);
  const [tighten, setTighten] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState("Certified<f64> · press Compose or Tighten");

  const [busy, setBusy] = useState(false);
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

  const d = derive(included, tighten);
  const gradeColor = d.grade === "verified" ? VERIFIED : ESTIMATED;
  const nextTerm = ADD_ORDER.find((t) => !included.includes(t)) ?? null;

  const compose = useCallback(() => {
    if (busy || !nextTerm) return;
    setBusy(true);
    setStatus(`composing + ${nextTerm} …`);
    schedule(() => {
      setIncluded((prev) => [...prev, nextTerm]);
      const nd = derive([...included, nextTerm], tighten);
      setStatus(`+ ${nextTerm} composed · total rel-err ${fmtErr(nd.total)} · ${nd.grade}`);
      setBusy(false);
    }, 420);
  }, [busy, nextTerm, included, tighten, schedule]);

  const tightenNumerical = useCallback(() => {
    if (busy || tighten >= 3) return;
    setBusy(true);
    setStatus("spending budget — tightening numerical bound …");
    schedule(() => {
      const nt = tighten + 1;
      setTighten(nt);
      const nd = derive(included, nt);
      setStatus(`numerical tightened ×${nt} · total rel-err ${fmtErr(nd.total)} · ${nd.grade}`);
      setBusy(false);
    }, 420);
  }, [busy, tighten, included, schedule]);

  const reset = useCallback(() => {
    clearTimers();
    setBusy(false);
    setIncluded(["drag"]);
    setTighten(0);
    setReveal(false);
    setStatus("Certified<f64> · press Compose or Tighten");
  }, [clearTimers]);

  const lampColor = busy ? ESTIMATED : gradeColor;

  /* bar geometry */
  const barX = 40;
  const barY = 196;
  const barW = 680;
  const barH = 52;
  const capX = barX + (CAP / AXIS) * barW;

  const segs = SLICE_ORDER.map((k, i) => {
    const before = SLICE_ORDER.slice(0, i).reduce((a, kk) => a + d.slices[kk], 0);
    const w = (d.slices[k] / AXIS) * barW;
    return { k, x: barX + (before / AXIS) * barW, w };
  });

  const valueName = included.length === 1 ? "drag" : "‖F‖ resultant";

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="w-full rounded-2xl border" style={{ background: BG, borderColor: BORDER }}>
      {/* Header */}
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
          aria-label="Reset evidence value demo"
          className={cn(btnClass, "shrink-0")}
          style={{ borderColor: `${CYAN_GLOW}44`, color: CYAN_GLOW }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 760 470"
        className="w-full"
        style={{ maxHeight: 500 }}
        role="img"
        aria-label="Evidence value carrying its certificate: a value plus four conservatively-composing uncertainty slices — numerical, statistical, model-form and sensitivity — a total relative-error readout, an epistemic grade and a provenance hash"
      >
        {/* value card */}
        <rect x={30} y={26} width={344} height={128} rx={14} fill={SURFACE} stroke={BORDER} strokeWidth={1} />
        <text x={48} y={54} fill={MUTED} fontSize={11} fontFamily="monospace" letterSpacing={0.5}>
          Certified&lt;f64&gt;
        </text>
        <AnimatePresence>
          <motion.text
            key={`${valueName}-${d.value.toFixed(2)}`}
            x={48}
            y={104}
            fill={BRIGHT}
            fontSize={40}
            fontFamily="monospace"
            fontWeight={700}
            initial={{ opacity: 0, y: reduced ? 104 : 112 }}
            animate={{ opacity: 1, y: 104 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.3 }}
          >
            {d.value.toFixed(2)}
          </motion.text>
        </AnimatePresence>
        <text x={48} y={132} fill={MUTED} fontSize={13} fontFamily="monospace">
          {valueName} · N
        </text>
        {/* grade chip */}
        <motion.rect
          x={266}
          y={40}
          width={92}
          height={26}
          rx={13}
          animate={{ fill: `${gradeColor}22`, stroke: gradeColor }}
          transition={{ duration: reduced ? 0 : 0.4 }}
          strokeWidth={1.3}
        />
        <motion.text
          x={312}
          y={57}
          textAnchor="middle"
          fontSize={12}
          fontFamily="monospace"
          fontWeight={700}
          animate={{ fill: gradeColor }}
          transition={{ duration: reduced ? 0 : 0.4 }}
        >
          {d.grade}
        </motion.text>

        {/* certificate panel */}
        <rect x={386} y={26} width={344} height={128} rx={14} fill={SURFACE} stroke={BORDER} strokeWidth={1} />
        <text x={404} y={54} fill={MUTED} fontSize={11} fontFamily="monospace" letterSpacing={0.5}>
          total rel-err
        </text>
        <motion.text
          key={fmtErr(d.total)}
          x={404}
          y={98}
          fontSize={34}
          fontFamily="monospace"
          fontWeight={700}
          animate={{ fill: gradeColor }}
          transition={{ duration: reduced ? 0 : 0.4 }}
        >
          {fmtErr(d.total)}
        </motion.text>
        <text x={404} y={124} fill={MUTED} fontSize={11} fontFamily="monospace">
          conservative linear budget · cap {fmtErr(CAP)}
        </text>
        <text x={404} y={142} fill={SLATE} fontSize={10.5} fontFamily="monospace">
          ∂value/∂inputs — adjoint hook attached
        </text>

        {/* error budget bar */}
        <text x={barX} y={barY - 12} fill={MUTED} fontSize={11} fontFamily="monospace" letterSpacing={0.5}>
          ERROR BUDGET — stacked, composes conservatively
        </text>
        <rect x={barX} y={barY} width={barW} height={barH} rx={8} fill="#0a1620" stroke={BORDER} strokeWidth={1} />
        {segs.map((s) => (
          <motion.rect
            key={s.k}
            y={barY + 3}
            height={barH - 6}
            initial={false}
            animate={{ x: s.x + 3, width: Math.max(0, s.w - 6) }}
            transition={{ duration: reduced ? 0 : 0.55, ease: "easeInOut" }}
            rx={4}
            fill={SLICE_COLOR[s.k]}
            opacity={0.9}
          />
        ))}
        {/* budget cap marker */}
        <line x1={capX} y1={barY - 6} x2={capX} y2={barY + barH + 6} stroke={ESTIMATED} strokeWidth={1.4} strokeDasharray="4 3" />
        <text x={capX} y={barY - 10} textAnchor="middle" fill={ESTIMATED} fontSize={9.5} fontFamily="monospace">
          cap
        </text>
        <text x={barX + barW} y={barY + barH + 18} textAnchor="end" fill={SLATE} fontSize={9.5} fontFamily="monospace">
          {fmtErr(AXIS)} full-scale
        </text>

        {/* slice legend row */}
        {SLICE_ORDER.map((k, i) => {
          const lx = barX + i * 172;
          return (
            <g key={k}>
              <rect x={lx} y={288} width={12} height={12} rx={2.5} fill={SLICE_COLOR[k]} />
              <text x={lx + 18} y={298} fill={BRIGHT} fontSize={11} fontFamily="monospace" fontWeight={600}>
                {SLICE_LABEL[k]}
              </text>
              <text x={lx + 18} y={313} fill={MUTED} fontSize={10.5} fontFamily="monospace">
                {fmtErr(d.slices[k])}
              </text>
            </g>
          );
        })}

        {/* divider */}
        <line x1={30} y1={332} x2={730} y2={332} stroke={BORDER} strokeWidth={1} />

        {/* provenance chip / model card */}
        <g
          onClick={() => setReveal((r) => !r)}
          style={{ cursor: "pointer" }}
          role="button"
          aria-label={reveal ? "Hide model card" : "Reveal model card and provenance"}
        >
          <rect x={30} y={348} width={230} height={30} rx={15} fill={`${CYAN_GLOW}12`} stroke={`${CYAN_GLOW}44`} strokeWidth={1.2} />
          <circle cx={49} cy={363} r={4} fill={CYAN_GLOW} />
          <text x={62} y={367} fill={CYAN_GLOW} fontSize={12} fontFamily="monospace">
            blake3:{d.hash.slice(0, 4)}…{d.hash.slice(-2)}
          </text>
          <text x={244} y={367} textAnchor="end" fill={MUTED} fontSize={11} fontFamily="monospace">
            {reveal ? "−" : "+"}
          </text>
        </g>

        <AnimatePresence>
          {reveal && (
            <motion.g
              key="model-card"
              initial={{ opacity: 0, y: reduced ? 392 : 400 }}
              animate={{ opacity: 1, y: 392 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
            >
              <rect x={30} y={0} width={700} height={62} rx={12} fill={SURFACE} stroke={BORDER} strokeWidth={1} />
              <text x={46} y={20} fill={MUTED} fontSize={10.5} fontFamily="monospace">
                model card · provenance blake3:{d.hash} · adjoint ∂({valueName})/∂(inputs) available
              </text>
              {SLICE_ORDER.map((k, i) => (
                <g key={k} transform={`translate(${46 + i * 172}, 34)`}>
                  <rect x={0} y={-8} width={9} height={9} rx={2} fill={SLICE_COLOR[k]} />
                  <text x={15} y={0} fill={SLICE_COLOR[k]} fontSize={10} fontFamily="monospace" fontWeight={600}>
                    {SLICE_LABEL[k]}
                  </text>
                  <text x={0} y={16} fill={SLATE} fontSize={8.5} fontFamily="monospace">
                    {SLICE_DESC[k]}
                  </text>
                </g>
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3" style={{ borderColor: BORDER }}>
        <button
          onClick={compose}
          disabled={busy || !nextTerm}
          aria-label={nextTerm ? `Compose in ${nextTerm}` : "Fully composed"}
          className={btnClass}
          style={{ borderColor: `${CYAN_GLOW}55`, color: CYAN_GLOW }}
        >
          <Plus className="h-3.5 w-3.5" />
          {nextTerm ? `Compose (+${nextTerm})` : "Fully composed"}
        </button>
        <button
          onClick={tightenNumerical}
          disabled={busy || tighten >= 3}
          aria-label="Tighten the numerical slice by spending more budget"
          className={btnClass}
          style={{ borderColor: `${SLICE_COLOR.numerical}66`, color: SLICE_COLOR.numerical }}
        >
          <ChevronsDownUp className="h-3.5 w-3.5" />
          Tighten numerical
        </button>
        <button
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? "Hide model card" : "Reveal model card"}
          className={btnClass}
          style={{ borderColor: `${MUTED}44`, color: MUTED }}
        >
          {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {reveal ? "Hide model card" : "Reveal model card"}
        </button>
      </div>

      {/* footnote */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-4 font-mono text-[11px]" style={{ color: SLATE }}>
        <span className="inline-flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" /> the certificate travels inside the value
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5" /> provenance is content-addressed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" /> adjoint hook enables sensitivity back-prop
        </span>
      </div>
    </div>
  );
}
