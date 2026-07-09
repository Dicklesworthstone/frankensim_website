"use client";

import { motion } from "framer-motion";
import { Cpu, Zap } from "lucide-react";
import GlitchText from "@/components/glitch-text";
import LazyViz from "@/components/lazy-viz";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useScrollIdleClass } from "@/lib/use-viz-anim";

// ── Tier I · Foundations ──────────────────────────────────────────────────
import HeatPde from "@/components/wasm/heat-pde";
import OrrSommerfeld from "@/components/wasm/orr-sommerfeld";
import Chebyshev from "@/components/wasm/chebyshev";
import TaylorBound from "@/components/wasm/taylor-bound";
import Autodiff from "@/components/wasm/autodiff";
import Rsvd from "@/components/wasm/rsvd";
import Fft from "@/components/wasm/fft";
import Eigenmodes from "@/components/wasm/eigenmodes";
import Qmc from "@/components/wasm/qmc";
import RobustHull from "@/components/wasm/robust-hull";

// ── Tier II · The Frontier (real-time 3D) ─────────────────────────────────
import Topopt from "@/components/wasm/frontier/topopt";
import SdfRaymarch from "@/components/wasm/frontier/sdf-raymarch";
import MarchingCubes from "@/components/wasm/frontier/marching-cubes";
import Lorenz from "@/components/wasm/frontier/lorenz";
import Wave2d from "@/components/wasm/frontier/wave2d";
import Fluid from "@/components/wasm/frontier/fluid";
import GrayScott from "@/components/wasm/frontier/gray-scott";
import Mandelbrot from "@/components/wasm/frontier/mandelbrot";
import GaMotor from "@/components/wasm/frontier/ga-motor";
import Symplectic from "@/components/wasm/frontier/symplectic";

// ── Tier III · The Deep Kernel (newly-unlocked upper stack) ───────────────
import HodgeDecomposition from "@/components/wasm/deep/hodge-decomposition";
import NavierStokesCavity from "@/components/wasm/deep/navier-stokes-cavity";
import GpRegression from "@/components/wasm/deep/gp-regression";
import CmaesTrace from "@/components/wasm/deep/cmaes-trace";
import OptimalTransport from "@/components/wasm/deep/optimal-transport";
import CyclicSymmetry from "@/components/wasm/deep/cyclic-symmetry";
import KrylovConvergence from "@/components/wasm/deep/krylov-convergence";
import CutfemQuadtree from "@/components/wasm/deep/cutfem-quadtree";
import FfdDeform from "@/components/wasm/deep/ffd-deform";
import BettiShapes from "@/components/wasm/deep/betti-shapes";

const FOUNDATIONS = [
  { key: "heat", Comp: HeatPde },
  { key: "orr", Comp: OrrSommerfeld },
  { key: "cheb", Comp: Chebyshev },
  { key: "taylor", Comp: TaylorBound },
  { key: "ad", Comp: Autodiff },
  { key: "rsvd", Comp: Rsvd },
  { key: "fft", Comp: Fft },
  { key: "eig", Comp: Eigenmodes },
  { key: "qmc", Comp: Qmc },
  { key: "hull", Comp: RobustHull },
];

const FRONTIER = [
  { key: "topopt", Comp: Topopt },
  { key: "sdf", Comp: SdfRaymarch },
  { key: "mc", Comp: MarchingCubes },
  { key: "lorenz", Comp: Lorenz },
  { key: "wave", Comp: Wave2d },
  { key: "fluid", Comp: Fluid },
  { key: "gray", Comp: GrayScott },
  { key: "mandel", Comp: Mandelbrot },
  { key: "ga", Comp: GaMotor },
  { key: "symp", Comp: Symplectic },
];

const DEEP = [
  { key: "hodge", Comp: HodgeDecomposition },
  { key: "ns", Comp: NavierStokesCavity },
  { key: "gp", Comp: GpRegression },
  { key: "cmaes", Comp: CmaesTrace },
  { key: "ot", Comp: OptimalTransport },
  { key: "cyclic", Comp: CyclicSymmetry },
  { key: "krylov", Comp: KrylovConvergence },
  { key: "cutfem", Comp: CutfemQuadtree },
  { key: "ffd", Comp: FfdDeform },
  { key: "betti", Comp: BettiShapes },
];

function TierHeader({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-12 max-w-3xl">
      <div className="inline-flex items-center gap-3 mb-4">
        <div className="h-px w-8" style={{ background: `${accent}66` }} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: `${accent}cc` }}>
          {eyebrow}
        </span>
      </div>
      <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white">{title}</h2>
      <p className="mt-4 text-base md:text-lg font-medium leading-relaxed text-slate-400">{children}</p>
    </div>
  );
}

export default function WasmLab() {
  const { ready, engine } = useFsWasm();

  // Drop backdrop-filter blur on all glass surfaces while actively scrolling
  // (restored on scroll-idle) — kills ~28 per-frame compositor re-rasterizations
  // with no change to the at-rest look. See globals.css `.is-scrolling`.
  useScrollIdleClass();

  return (
    <main id="main-content">
      {/* HERO */}
      <section className="relative overflow-hidden pt-36 pb-16">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-10%] left-[-5%] h-[45%] w-[45%] rounded-full bg-cyan-500/10 blur-[110px]" />
          <div className="absolute bottom-[-10%] right-[-5%] h-[40%] w-[45%] rounded-full bg-violet-600/10 blur-[110px]" />
        </div>
        <div className="mx-auto max-w-7xl px-6">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">The Lab · Live WASM</span>
          </div>
          <GlitchText trigger="hover" intensity="medium">
            <h1 className="text-[clamp(2.75rem,7vw,5.5rem)] font-black leading-[0.95] tracking-tight text-white">
              Real kernels, <span className="text-gradient-sync">live</span>.
            </h1>
          </GlitchText>
          <p className="mt-8 max-w-2xl text-lg md:text-xl font-medium leading-relaxed text-slate-400">
            Thirty of FrankenSim&apos;s actual Rust kernels, the very same code the native
            workspace compiles, cross-compiled to WebAssembly and computing in your browser,
            right now. No mocks, no pre-baked data, no server. Certified error bounds, exact
            autodiff, a topology optimizer, raymarched signed-distance surfaces, a Lorenz
            attractor, and the deep stack itself: Hodge decomposition, real Navier–Stokes,
            Gaussian-process Bayesian optimization, CutFEM on a signed-distance boundary. Every
            pixel is real math. For the certified end-to-end pipelines that compose these kernels,
            see the{" "}
            <a href="/e2e" className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-200">
              E2E campaigns
            </a>
            .
          </p>

          {/* engine chip */}
          <div
            className="mt-8 inline-flex items-center gap-3 rounded-full border px-4 py-2 font-mono text-[11px]"
            style={{
              borderColor: ready ? "rgba(34,211,238,0.35)" : "rgba(148,163,184,0.25)",
              background: ready ? "rgba(34,211,238,0.06)" : "rgba(148,163,184,0.04)",
            }}
          >
            <motion.span
              className="h-2 w-2 rounded-full"
              style={{ background: ready ? "#22d3ee" : "#fbbf24", boxShadow: ready ? "0 0 8px #22d3ee" : "none" }}
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            {ready ? (
              <span className="text-cyan-300 truncate max-w-[80vw] md:max-w-2xl">● ENGINE ONLINE · {engine}</span>
            ) : (
              <span className="text-amber-300">REANIMATING KERNELS…</span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Cpu className="h-3 w-3 text-cyan-400" /> fs-sparse · fs-cheb · fs-ivl · fs-ad · fs-fft · fs-la · fs-ga · fs-feec · fs-flux · fs-bo · fs-cutfem · fs-solver · fs-dfo · fs-symmetry · fs-xform · fs-math</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="h-3 w-3 text-violet-400" /> off-main-thread web worker</span>
          </div>
        </div>
      </section>

      {/* TIER I — FOUNDATIONS */}
      <section className="relative pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <TierHeader eyebrow="Tier I · Foundations" title={<>The <span className="text-cyan-400">bedrock</span>, computing.</>} accent="#06b6d4">
            The numerical primitives every certified simulation stands on: sparse solves, spectral
            methods, certified intervals, exact autodiff. Each one is a real kernel, not a chart.
          </TierHeader>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {FOUNDATIONS.map(({ key, Comp }) => (
              <LazyViz key={key} minHeight={520}>
                <Comp />
              </LazyViz>
            ))}
          </div>
        </div>
      </section>

      {/* TIER II — THE FRONTIER */}
      <section className="relative pb-32 border-t border-white/5 pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[10%] right-[-8%] h-[40%] w-[45%] rounded-full bg-violet-600/10 blur-[130px]" />
        </div>
        <div className="mx-auto max-w-7xl px-6">
          <TierHeader eyebrow="Tier II · The Frontier" title={<>The whole kernel, <span className="text-gradient-sync">in three dimensions</span>.</>} accent="#a855f7">
            Where the primitives become physics you can see: a topology optimizer forging a truss,
            signed-distance geometry raymarched on your GPU, spectral waves, deterministic chaos,
            reaction–diffusion, and fluids, each one driven frame by frame by the real kernels.
          </TierHeader>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {FRONTIER.map(({ key, Comp }) => (
              <LazyViz key={key} minHeight={560}>
                <Comp />
              </LazyViz>
            ))}
          </div>
        </div>
      </section>

      {/* TIER III — THE DEEP KERNEL */}
      <section className="relative pb-32 border-t border-white/5 pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[6%] left-[-8%] h-[42%] w-[48%] rounded-full bg-cyan-500/10 blur-[130px]" />
        </div>
        <div className="mx-auto max-w-7xl px-6">
          <TierHeader eyebrow="Tier III · The Deep Kernel" title={<>The <span className="text-gradient-sync">upper stack</span>, unlocked.</>} accent="#22d3ee">
            The heavy machinery, reached by compiling FrankenSim&apos;s own async runtime to the
            browser: exact discrete de Rham (Hodge decomposition and Betti numbers), real
            incompressible Navier–Stokes, Gaussian-process Bayesian optimization, CMA-ES, optimal
            transport, Krylov solvers, cyclic-symmetry, CutFEM on a signed-distance boundary, and
            free-form deformation. Kernels no browser has run before.
          </TierHeader>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {DEEP.map(({ key, Comp }) => (
              <LazyViz key={key} minHeight={560}>
                <Comp />
              </LazyViz>
            ))}
          </div>

          <p className="mx-auto mt-16 max-w-2xl text-center text-sm text-slate-500">
            Every frame across all three tiers was produced by FrankenSim&apos;s real Rust kernels
            compiled to WebAssembly, the same bytes the native build runs. Source lives in{" "}
            <code className="text-cyan-300">crates/fs-wasm</code>. For the certified end-to-end
            pipelines that compose these kernels, see the{" "}
            <a href="/e2e" className="text-emerald-300 hover:text-emerald-200">E2E campaigns</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
