"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { StepForward, RotateCcw, Cpu } from "lucide-react";
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
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Machines + kernels                                                 */
/* ------------------------------------------------------------------ */

type MachineId = "m4" | "tr";

interface Machine {
  id: MachineId;
  name: string;
  cores: number;
  bw: number; // GB/s (STREAM)
  peak: number; // GFLOP/s (f64 compute roof)
}

const MACHINES: Record<MachineId, Machine> = {
  m4: { id: "m4", name: "Apple M4 Max", cores: 16, bw: 546, peak: 1600 },
  tr: { id: "tr", name: "Threadripper PRO 7995WX", cores: 96, bw: 330, peak: 5000 },
};

interface Kernel {
  id: string;
  name: string;
  I: number; // arithmetic intensity FLOP/byte
  effM4: number; // fraction of the roofline attained on M4
  effTR: number; // fraction of the roofline attained on Threadripper
  ldx: number; // label offset x
  ldy: number; // label offset y
  anchor: "start" | "middle" | "end";
}

const KERNELS: Kernel[] = [
  { id: "gemm", name: "GEMM f64", I: 18, effM4: 0.78, effTR: 0.82, ldx: -12, ldy: -12, anchor: "end" },
  { id: "sdf", name: "SDF sphere-trace", I: 6, effM4: 0.55, effTR: 0.64, ldx: 12, ldy: -10, anchor: "start" },
  { id: "feec", name: "FEEC apply", I: 4, effM4: 0.68, effTR: 0.71, ldx: 12, ldy: 16, anchor: "start" },
  { id: "fft", name: "FFT", I: 2.5, effM4: 0.62, effTR: 0.58, ldx: -12, ldy: 16, anchor: "end" },
  { id: "lbm", name: "LBM D3Q19", I: 0.9, effM4: 0.72, effTR: 0.7, ldx: 12, ldy: -10, anchor: "start" },
  { id: "spmv", name: "SpMV", I: 0.2, effM4: 0.88, effTR: 0.86, ldx: 12, ldy: 16, anchor: "start" },
];

/* ------------------------------------------------------------------ */
/*  Log-log geometry                                                   */
/* ------------------------------------------------------------------ */

const I_MIN = 0.1;
const I_MAX = 100;
const P_MIN = 20;
const P_MAX = 8000;

const PLOT_L = 64;
const PLOT_R = 772;
const PLOT_T = 40;
const PLOT_B = 340;
const PLOT_W = PLOT_R - PLOT_L;
const PLOT_H = PLOT_B - PLOT_T;

const LOG_IMIN = Math.log10(I_MIN);
const LOG_ISPAN = Math.log10(I_MAX) - LOG_IMIN;
const LOG_PMIN = Math.log10(P_MIN);
const LOG_PSPAN = Math.log10(P_MAX) - LOG_PMIN;

const xPix = (I: number) => PLOT_L + ((Math.log10(I) - LOG_IMIN) / LOG_ISPAN) * PLOT_W;
const yPix = (P: number) => PLOT_B - ((Math.log10(P) - LOG_PMIN) / LOG_PSPAN) * PLOT_H;

function roof(I: number, m: Machine) {
  return Math.min(m.peak, m.bw * I);
}
function isCompute(I: number, m: Machine) {
  return I >= m.peak / m.bw;
}
function eff(k: Kernel, m: Machine) {
  return m.id === "m4" ? k.effM4 : k.effTR;
}

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  active,
  color,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5",
        "font-mono text-xs font-semibold tracking-wide transition-colors hover:bg-white/5",
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

export default function RooflineViz() {
  const reduced = !!useReducedMotion();

  const [machineId, setMachineId] = useState<MachineId>("m4");
  const [selected, setSelected] = useState<string | null>("gemm");
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const m = MACHINES[machineId];
  const ridgeI = m.peak / m.bw;

  const stopPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  const cycle = useCallback(() => {
    setSelected((prev) => {
      const idx = prev ? KERNELS.findIndex((k) => k.id === prev) : -1;
      return KERNELS[(idx + 1) % KERNELS.length].id;
    });
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      stopPlay();
    } else {
      setPlaying(true);
      cycle();
      intervalRef.current = setInterval(cycle, reduced ? 500 : 1200);
    }
  }, [playing, stopPlay, cycle, reduced]);

  const toggleMachine = useCallback((id: MachineId) => {
    setMachineId(id);
  }, []);

  const reset = useCallback(() => {
    stopPlay();
    setMachineId("m4");
    setSelected("gemm");
  }, [stopPlay]);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  /* ---- roofline anchor points ---- */
  const aX = xPix(I_MIN);
  const aY = yPix(roof(I_MIN, m));
  const rX = xPix(ridgeI);
  const rY = yPix(m.peak);
  const bX = xPix(I_MAX);
  const bY = yPix(m.peak);

  const sel = selected ? KERNELS.find((k) => k.id === selected) ?? null : null;

  const xTicks = [0.1, 1, 10, 100];
  const yTicks = [100, 1000];

  const selBound = sel ? (isCompute(sel.I, m) ? "compute-bound" : "memory-bound") : "";
  const selPct = sel ? Math.round(eff(sel, m) * 100) : 0;

  return (
    <section
      className="w-full rounded-2xl border p-4 sm:p-5"
      style={{ background: BG, borderColor: BORDER }}
      aria-label="Roofline model visualization"
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-bold tracking-tight" style={{ color: BRIGHT }}>
            Roofline-honest kernels
          </h3>
          <p className="mt-0.5 font-mono text-[11px]" style={{ color: MUTED }}>
            arithmetic intensity vs machine peak · every kernel ships its roofline analysis
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border px-3 py-1" style={{ borderColor: BORDER }}>
          <Cpu size={12} color={CYAN_GLOW} />
          <span className="font-mono text-[11px] font-bold" style={{ color: CYAN_GLOW }}>
            {m.name}
          </span>
        </div>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 800 380"
        className="w-full"
        role="img"
        aria-label={`Log-log roofline chart for ${m.name}: a slanted memory-bandwidth roof rising to a flat compute roof, with kernel dots plotted by arithmetic intensity and attained performance`}
      >
        <defs>
          <filter id="rl-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* plot frame */}
        <rect x={PLOT_L} y={PLOT_T} width={PLOT_W} height={PLOT_H} fill={SURFACE} stroke={BORDER} />

        {/* gridlines + ticks */}
        {xTicks.map((t) => (
          <g key={`x-${t}`}>
            <line x1={xPix(t)} y1={PLOT_T} x2={xPix(t)} y2={PLOT_B} stroke={`${SLATE}22`} strokeWidth={1} />
            <text x={xPix(t)} y={PLOT_B + 16} textAnchor="middle" fontFamily="monospace" fontSize={10} fill={MUTED}>
              {t}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line x1={PLOT_L} y1={yPix(t)} x2={PLOT_R} y2={yPix(t)} stroke={`${SLATE}22`} strokeWidth={1} />
            <text x={PLOT_L - 8} y={yPix(t) + 3} textAnchor="end" fontFamily="monospace" fontSize={10} fill={MUTED}>
              {t >= 1000 ? `${t / 1000}k` : t}
            </text>
          </g>
        ))}

        {/* axis titles */}
        <text
          x={(PLOT_L + PLOT_R) / 2}
          y={PLOT_B + 32}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={11}
          fill={MUTED}
        >
          arithmetic intensity — FLOP / byte (log)
        </text>
        <text
          x={16}
          y={(PLOT_T + PLOT_B) / 2}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={11}
          fill={MUTED}
          transform={`rotate(-90 16 ${(PLOT_T + PLOT_B) / 2})`}
        >
          performance — GFLOP/s (log)
        </text>

        {/* region shading (recomputed per machine) */}
        <polygon
          points={`${aX},${PLOT_B} ${aX},${aY} ${rX},${rY} ${rX},${PLOT_B}`}
          fill={`${AMBER}10`}
        />
        <polygon
          points={`${rX},${PLOT_B} ${rX},${rY} ${bX},${bY} ${bX},${PLOT_B}`}
          fill={`${VIOLET}10`}
        />

        {/* ridge vertical guide */}
        <motion.line
          animate={{ x1: rX, x2: rX }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
          y1={rY}
          y2={PLOT_B}
          stroke={`${CYAN}55`}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <motion.text
          animate={{ x: rX }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
          y={PLOT_B - 8}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={9}
          fill={`${CYAN_GLOW}cc`}
        >
          ridge {ridgeI.toFixed(1)}
        </motion.text>

        {/* roofline: diagonal (bandwidth) + flat (compute) */}
        <motion.line
          animate={{ x1: aX, y1: aY, x2: rX, y2: rY }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
          stroke={AMBER}
          strokeWidth={2.5}
        />
        <motion.line
          animate={{ x1: rX, y1: rY, x2: bX, y2: bY }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
          stroke={VIOLET}
          strokeWidth={2.5}
        />
        <motion.text
          animate={{ x: (aX + rX) / 2 - 6, y: (aY + rY) / 2 - 8 }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
          textAnchor="end"
          fontFamily="monospace"
          fontSize={9}
          fill={AMBER}
        >
          {m.bw} GB/s roof
        </motion.text>
        <text x={bX - 6} y={bY - 8} textAnchor="end" fontFamily="monospace" fontSize={9} fill={VIOLET}>
          {(m.peak / 1000).toFixed(1)} TFLOP/s peak
        </text>

        {/* kernel dots */}
        {KERNELS.map((k) => {
          const perf = eff(k, m) * roof(k.I, m);
          const cx = xPix(k.I);
          const cy = yPix(perf);
          const compute = isCompute(k.I, m);
          const color = compute ? TEAL : AMBER;
          const isSel = selected === k.id;
          return (
            <motion.g
              key={k.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setSelected(k.id)}
              onClick={() => setSelected(k.id)}
            >
              {/* generous hit target */}
              <motion.circle
                animate={{ cx, cy }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
                r={16}
                fill="transparent"
              />
              {isSel && (
                <>
                  <motion.line
                    animate={{ x1: cx, x2: cx, y2: cy }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
                    y1={PLOT_B}
                    stroke={`${color}66`}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <motion.line
                    animate={{ x2: cx, y1: cy, y2: cy }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
                    x1={PLOT_L}
                    stroke={`${color}66`}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                </>
              )}
              <motion.circle
                animate={{ cx, cy }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
                r={isSel ? 7 : 5}
                fill={color}
                stroke={BG}
                strokeWidth={1.5}
                filter={isSel ? "url(#rl-glow)" : undefined}
              />
              <motion.text
                animate={{ x: cx + k.ldx, y: cy + k.ldy }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
                textAnchor={k.anchor}
                fontFamily="monospace"
                fontSize={isSel ? 11 : 10}
                fontWeight={isSel ? 700 : 400}
                fill={isSel ? BRIGHT : `${MUTED}dd`}
              >
                {k.name}
                {isSel ? ` · ${Math.round(eff(k, m) * 100)}%` : ""}
              </motion.text>
            </motion.g>
          );
        })}

        {/* legend */}
        <g transform={`translate(${PLOT_L + 12}, ${PLOT_T + 12})`}>
          <rect x={0} y={0} width={168} height={46} rx={6} fill={`${BG}cc`} stroke={BORDER} />
          <rect x={10} y={11} width={12} height={4} rx={2} fill={AMBER} />
          <text x={28} y={16} fontFamily="monospace" fontSize={9} fill={MUTED}>
            memory-bound (bandwidth)
          </text>
          <rect x={10} y={29} width={12} height={4} rx={2} fill={VIOLET} />
          <text x={28} y={34} fontFamily="monospace" fontSize={9} fill={MUTED}>
            compute-bound (peak)
          </text>
        </g>
      </svg>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          machine
        </span>
        <CtrlButton
          onClick={() => toggleMachine("m4")}
          active={machineId === "m4"}
          color={CYAN_GLOW}
          label="Switch to Apple M4 Max"
        >
          M4 Max
        </CtrlButton>
        <CtrlButton
          onClick={() => toggleMachine("tr")}
          active={machineId === "tr"}
          color={VIOLET}
          label="Switch to Threadripper PRO 7995WX"
        >
          Threadripper 7995WX
        </CtrlButton>
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <CtrlButton onClick={togglePlay} active={playing} color={EMERALD} label={playing ? "Pause highlight cycle" : "Play highlight cycle"}>
          {playing ? "Pause" : "Play"}
        </CtrlButton>
        <CtrlButton onClick={cycle} color={TEAL} label="Highlight next kernel">
          <StepForward size={13} />
          Step kernel
        </CtrlButton>
        <CtrlButton onClick={reset} color={SLATE} label="Reset">
          <RotateCcw size={13} />
          Reset
        </CtrlButton>
      </div>

      {/* Status readout */}
      <div
        className="mt-3 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span> machine: {m.name} · {m.bw} GB/s ·{" "}
        {(m.peak / 1000).toFixed(1)} TFLOP/s peak · ridge {ridgeI.toFixed(1)} FLOP/byte
        {sel && (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: selBound === "compute-bound" ? TEAL : AMBER }}>
              {sel.name} — {selPct}% of peak · {selBound} · I={sel.I} FLOP/byte
            </span>
          </>
        )}
      </div>
    </section>
  );
}
