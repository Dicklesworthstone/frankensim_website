"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, ArrowDown } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  The seven layers (L6 top → L0 bottom), strictly acyclic.          */
/* ------------------------------------------------------------------ */

interface LayerDef {
  id: string;
  code: string;
  name: string;
  color: string;
  tagline: string;
  responsibility: string;
  crates: string[];
}

const LAYERS: LayerDef[] = [
  { id: "L6", code: "HELM", name: "Orchestration & Ledger", color: "#f97316",
    tagline: "The one true interface",
    responsibility: "FrankenScript IR, sessions & capabilities, the Design Ledger, the plan-cost oracle, and the agent API.",
    crates: ["fs-ir", "fs-session", "fs-ledger", "fs-recompute", "fs-plan", "fs-roofline", "fs-vskeleton"] },
  { id: "L5", code: "LUMEN", name: "Rendering & Visualization", color: "#a855f7",
    tagline: "The marketing shot is the physics",
    responsibility: "Spectral path tracing, direct chart rendering, deterministic image plumbing, and differentiable rendering.",
    crates: ["fs-img"] },
  { id: "L4", code: "ASCENT", name: "Optimization & Uncertainty", color: "#3b82f6",
    tagline: "Design synthesis, certified",
    responsibility: "Shape / topology / global / derivative-free optimization, e-process racing, constraint calculus, SOS certificates.",
    crates: ["fs-opt", "fs-dfo", "fs-constraint", "fs-eproc"] },
  { id: "L3", code: "FLUX", name: "Physics Kernel", color: "#06b6d4",
    tagline: "Structure-preserving, adjoint-native",
    responsibility: "FEEC exterior calculus, CutFEM-on-SDF, structure-preserving integrators, matrix-free solvers, certified speculation.",
    crates: ["fs-feec", "fs-opdsl", "fs-solver", "fs-time", "fs-material", "fs-scenario", "fs-regime", "fs-ladder", "fs-iface", "fs-verify"] },
  { id: "L2", code: "MORPH", name: "Geometry Kernel", color: "#10b981",
    tagline: "Region + Chart, routed",
    responsibility: "The Region / Chart abstraction, the Rep Router, SDF / mesh / F-rep / NURBS / voxel charts, topology & manufacturability certificates.",
    crates: ["fs-geom", "fs-rep-sdf", "fs-rep-mesh", "fs-rep-frep", "fs-rep-nurbs", "fs-rep-voxel", "fs-xform", "fs-mesh", "fs-ga", "fs-query", "fs-topo", "fs-geocon", "fs-io"] },
  { id: "L1", code: "BEDROCK", name: "Numerical Foundations", color: "#f59e0b",
    tagline: "Certified means intervals",
    responsibility: "Dense / sparse / FFT linear algebra, certified interval & Taylor arithmetic, Chebyshev methods, QMC RNG, autodiff.",
    crates: ["fs-math", "fs-la", "fs-sparse", "fs-fft", "fs-ivl", "fs-cheb", "fs-rand", "fs-ad"] },
  { id: "L0", code: "SUBSTRATE", name: "Hardware & Execution", color: "#64748b",
    tagline: "≤ 200 µs latency-to-cancel",
    responsibility: "Machine topology & SIMD dispatch, aligned arenas, the two-lane cancellable executor, tile kernels, and the tile-kernel DSL.",
    crates: ["fs-substrate", "fs-simd", "fs-alloc", "fs-exec", "fs-soa", "fs-soa-derive", "fs-tilelang", "fs-tilelang-macros"] },
];

const CROSS = ["fs-qty", "fs-obs", "fs-evidence"];

/* ------------------------------------------------------------------ */

export default function SevenLayerStackViz({ className }: { className?: string }) {
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const [openId, setOpenId] = useState<string>("L2");
  const [activeIdx, setActiveIdx] = useState<number | null>(null); // index in traced sweep
  const [phase, setPhase] = useState<"idle" | "down" | "up">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const trace = useCallback(() => {
    clearTimers();
    setPhase("down");
    setOpenId("");
    const step = reduced ? 0 : 230;
    // descend L6(idx0) → L0(idx6): lowering to a task DAG
    LAYERS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setActiveIdx(i), i * step));
    });
    // ascend L0 → L6: results + evidence bubble up
    const downEnd = LAYERS.length * step;
    timers.current.push(setTimeout(() => setPhase("up"), downEnd));
    LAYERS.forEach((_, i) => {
      const upIdx = LAYERS.length - 1 - i;
      timers.current.push(setTimeout(() => setActiveIdx(upIdx), downEnd + i * step));
    });
    timers.current.push(setTimeout(() => { setPhase("idle"); setActiveIdx(null); }, downEnd + LAYERS.length * step + 200));
  }, [clearTimers, reduced]);

  const reset = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setActiveIdx(null);
    setOpenId("L2");
  }, [clearTimers]);

  const statusText =
    phase === "down" ? "lowering FrankenScript → task DAG ▼"
    : phase === "up" ? "solving · evidence bubbling up ▲"
    : "click a layer to inspect · trace a request to see dataflow";

  return (
    <div className={cn("relative w-full rounded-2xl", className)} style={{ background: "#04090d" }}>
      {/* Control bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cyan-500/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: phase === "idle" ? "#06b6d4" : "#22d3ee", boxShadow: `0 0 8px ${phase === "idle" ? "#06b6d4" : "#22d3ee"}` }}
          />
          <span className="font-mono text-[11px] truncate text-cyan-300/80">{statusText}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={trace}
            aria-label="Trace a request through the stack"
            className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 px-2.5 py-1 font-mono text-[11px] text-cyan-300 transition-colors hover:bg-cyan-500/10"
          >
            <Play className="h-3 w-3" /> Trace
          </button>
          <button
            onClick={reset}
            aria-label="Reset"
            className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:bg-white/5"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
      </div>

      <div className="flex gap-2 p-3 md:p-4">
        {/* Cross-cutting spine */}
        <div className="hidden sm:flex w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] py-3">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
            fs-qty · fs-obs · fs-evidence
          </span>
        </div>

        {/* The stack */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {LAYERS.map((layer, i) => {
            const isOpen = openId === layer.id;
            const isActive = activeIdx === i;
            return (
              <div key={layer.id} className="relative">
                {/* dependency arrow between rows */}
                {i > 0 && (
                  <div className="pointer-events-none absolute -top-[9px] left-6 z-10 text-slate-700">
                    <ArrowDown className="h-3 w-3" />
                  </div>
                )}
                <motion.button
                  onClick={() => setOpenId(isOpen ? "" : layer.id)}
                  aria-expanded={isOpen}
                  aria-label={`${layer.id} ${layer.code} layer`}
                  className="relative block w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors"
                  style={{
                    borderColor: isActive ? layer.color : isOpen ? `${layer.color}66` : "rgba(255,255,255,0.07)",
                    background: isActive ? `${layer.color}22` : isOpen ? `${layer.color}12` : "rgba(255,255,255,0.015)",
                  }}
                  animate={{
                    boxShadow: isActive ? `0 0 26px -6px ${layer.color}` : "0 0 0px transparent",
                    scale: isActive ? 1.012 : 1,
                  }}
                  transition={{ duration: reduced ? 0 : 0.25 }}
                >
                  {/* active sweep beam */}
                  <AnimatePresence>
                    {isActive && !reduced && (
                      <motion.span
                        initial={{ x: "-30%", opacity: 0 }}
                        animate={{ x: "130%", opacity: [0, 1, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="pointer-events-none absolute inset-y-0 left-0 w-1/4"
                        style={{ background: `linear-gradient(90deg, transparent, ${layer.color}55, transparent)` }}
                      />
                    )}
                  </AnimatePresence>

                  <div className="relative flex items-center gap-3">
                    {/* id badge */}
                    <div
                      className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg font-mono text-[10px] font-black leading-none"
                      style={{ color: layer.color, background: `${layer.color}1a`, border: `1px solid ${layer.color}44` }}
                    >
                      <span className="text-[12px]">{layer.id}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: layer.color }}>
                          {layer.code}
                        </span>
                        <span className="truncate text-[13px] font-bold text-slate-200">{layer.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">{layer.tagline}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-600">{layer.crates.length} crate{layer.crates.length > 1 ? "s" : ""}</span>
                  </div>

                  {/* expanded detail */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduced ? 0 : 0.3, ease: [0.19, 1, 0.22, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="pt-3 pb-2 pl-12 pr-1 text-[12px] leading-relaxed text-slate-400">
                          {layer.responsibility}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pb-1 pl-12">
                          {layer.crates.map((c) => (
                            <span
                              key={c}
                              className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                              style={{ color: layer.color, background: `${layer.color}14`, border: `1px solid ${layer.color}2e` }}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            );
          })}

          {/* Franken constellation base */}
          <div className="mt-2 rounded-xl border border-dashed border-white/10 bg-white/[0.01] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
              ▽ Franken constellation — asupersync · FrankenSQLite · FrankenNumpy · FrankenTorch · FrankenScipy
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
