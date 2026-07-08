"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Github, ArrowRight, Rocket, Boxes, Shield, Layers, Grid3x3, Activity,
  Zap, LineChart, Cpu, GitCommit, Database, ShieldCheck, Sparkles, Terminal,
} from "lucide-react";
import { motion } from "framer-motion";

import SectionShell from "@/components/section-shell";
import StatsGrid from "@/components/stats-grid";
import GlowOrbits from "@/components/glow-orbits";
import FeatureCard from "@/components/feature-card";
import ComparisonTable from "@/components/comparison-table";
import RustCodeBlock from "@/components/rust-code-block";
import Timeline from "@/components/timeline";
import RobotMascot from "@/components/robot-mascot";
import FrankenEye from "@/components/franken-eye";
import GlitchText from "@/components/glitch-text";
import SevenLayerStackViz from "@/components/viz/seven-layer-stack-viz";
import LazyViz from "@/components/lazy-viz";
import { SyncContainer } from "@/components/sync-elements";
import { Magnetic, BorderBeam } from "@/components/motion-wrapper";
import { Tooltip } from "@/components/tooltip";
import {
  siteConfig, heroStats, features, codeExample, codeExampleStudy, changelog,
} from "@/lib/content";

/* ---- lazy viz (client-only) ---- */
const RegionChartRouterViz = dynamic(() => import("@/components/viz/region-chart-router-viz"), { ssr: false });
const EvidenceValueViz = dynamic(() => import("@/components/viz/evidence-value-viz"), { ssr: false });
const EpistemicColorsViz = dynamic(() => import("@/components/viz/epistemic-colors-viz"), { ssr: false });
const CutfemSdfViz = dynamic(() => import("@/components/viz/cutfem-sdf-viz"), { ssr: false });
const AdjointFlowViz = dynamic(() => import("@/components/viz/adjoint-flow-viz"), { ssr: false });
const CertifiedSpeculationViz = dynamic(() => import("@/components/viz/certified-speculation-viz"), { ssr: false });
const EprocessRaceViz = dynamic(() => import("@/components/viz/eprocess-race-viz"), { ssr: false });
const TopoptSdfViz = dynamic(() => import("@/components/viz/topopt-sdf-viz"), { ssr: false });
const TwoLaneExecutorViz = dynamic(() => import("@/components/viz/two-lane-executor-viz"), { ssr: false });
const DeterminismViz = dynamic(() => import("@/components/viz/determinism-viz"), { ssr: false });
const DesignLedgerViz = dynamic(() => import("@/components/viz/design-ledger-viz"), { ssr: false });
const GauntletViz = dynamic(() => import("@/components/viz/gauntlet-viz"), { ssr: false });

type Concept = {
  badge: string;
  icon: React.ElementType;
  accent: string;
  title: React.ReactNode;
  body: React.ReactNode;
  Viz: React.ComponentType;
};

const CONCEPTS: Concept[] = [
  {
    badge: "L2 · Morph", icon: Boxes, accent: "#10b981",
    title: <>The <Tooltip term="Region">Region</Tooltip>, and its <Tooltip term="Chart">Charts</Tooltip></>,
    body: (
      <>
        <p>A <strong>Region</strong> is an abstract subset of space that is never stored directly. It is only ever presented by <strong>Charts</strong>: an SDF, a mesh, an F-rep tree, a NURBS patch, a voxel field. No representation is privileged, and charts of the same Region must provably agree.</p>
        <p>When one task holds a Region as an SDF and another needs a mesh, the <Tooltip term="Rep Router">Rep Router</Tooltip> solves a Pareto shortest-path problem over the graph of conversions, picking the cheapest chain that respects your error budget. Every hop emits a certificate.</p>
      </>
    ),
    Viz: RegionChartRouterViz,
  },
  {
    badge: "Evidence", icon: Shield, accent: "#06b6d4",
    title: <>The certificate rides <Tooltip term="Evidence<T>">inside the value</Tooltip></>,
    body: (
      <>
        <p>A FrankenSim result is never a bare number. Every value is an <strong>Evidence&lt;T&gt;</strong>: the number plus four uncertainty slices (numerical, statistical, model-form, and sensitivity) that compose conservatively, alongside a provenance hash and an adjoint hook.</p>
        <p>Because the bound travels with the value, composition can never quietly lose it. Where it matters, the answer comes back with its proof attached.</p>
      </>
    ),
    Viz: EvidenceValueViz,
  },
  {
    badge: "Epistemics", icon: Layers, accent: "#a3e635",
    title: <>Three colors, <Tooltip term="The Three Colors">no laundering</Tooltip></>,
    body: (
      <>
        <p>Every quantity is typed one of three colors: <strong style={{ color: "#22d3ee" }}>verified</strong> (interval-certified), <strong style={{ color: "#a3e635" }}>validated</strong> (anchored to experiment), or <strong style={{ color: "#fbbf24" }}>estimated</strong>. Composition is type-checked, so an estimate can never be laundered into a certificate.</p>
        <p>A validated value auto-demotes to estimated the instant it leaves its regime of validity. A false certificate is worse than an ordinary wrong answer: it is a wrong answer wearing a badge, and the type system exists to make that impossible.</p>
      </>
    ),
    Viz: EpistemicColorsViz,
  },
  {
    badge: "L3 · Flux", icon: Grid3x3, accent: "#22d3ee",
    title: <>FEM-grade physics on a <Tooltip term="CutFEM-on-SDF">raw SDF</Tooltip></>,
    body: (
      <>
        <p>The marquee bridge between geometry and physics: finite-element accuracy computed directly on a signed distance field. Cut cells get a ghost penalty and Nitsche boundary conditions; the interior integrates exactly.</p>
        <p>There is zero body-fitted meshing in the loop, so the optimizer can reshape the boundary every iteration without ever regenerating a mesh.</p>
      </>
    ),
    Viz: CutfemSdfViz,
  },
  {
    badge: "Adjoints", icon: Activity, accent: "#3b82f6",
    title: <>Differentiate <Tooltip term="Adjoint">through the solution</Tooltip></>,
    body: (
      <>
        <p>To get the gradient of an objective with respect to thousands of design parameters, FrankenSim solves the physics forward once, then solves a single adjoint problem via the implicit function theorem, not by unrolling solver iterations.</p>
        <p>The full gradient comes back at roughly the cost of one extra solve, regardless of parameter count. Gradient checks gate every merge, so the derivatives are always exact.</p>
      </>
    ),
    Viz: AdjointFlowViz,
  },
  {
    badge: "The Flywheel", icon: Zap, accent: "#a855f7",
    title: <><Tooltip term="Certified Speculation">Certified speculation</Tooltip></>,
    body: (
      <>
        <p>The single research bet. Cheap, possibly-wrong proposers (a surrogate, a coarse solve, an ML guess) fire candidate answers at high rate. A cheap certified verifier, an equilibrated-flux a-posteriori test, either stamps a candidate <strong style={{ color: "#22d3ee" }}>verified</strong> or fails closed.</p>
        <p>Machine learning proposes; certified numerics disposes. Most candidates are screened for pennies; only survivors pay for the expensive confirmation.</p>
      </>
    ),
    Viz: CertifiedSpeculationViz,
  },
  {
    badge: "L4 · Ascent", icon: LineChart, accent: "#a855f7",
    title: <>Race designs, stop when <Tooltip term="e-process">decisive</Tooltip></>,
    body: (
      <>
        <p>Candidate designs are evaluated concurrently, each accumulating an e-value, a betting martingale. Because e-processes are anytime-valid, you may peek continuously and stop the instant a leader crosses the threshold, with no p-hacking penalty.</p>
        <p>When a winner is declared, the losers are cancelled mid-solve, saving 2–5× the core-hours at identical statistical guarantees.</p>
      </>
    ),
    Viz: EprocessRaceViz,
  },
  {
    badge: "P2 · Marquee", icon: Sparkles, accent: "#06b6d4",
    title: <>Topology optimization, <Tooltip term="SIMP">no mesh in the loop</Tooltip></>,
    body: (
      <>
        <p>The forcing function for the whole geometry-physics bridge: a density field evolves to minimize compliance under a volume fraction, its physics computed by CutFEM directly on the level set.</p>
        <p>A grey blob resolves into a classic cantilever truss, and every iterate carries a composed error certificate, with the mesh-step counter pinned at zero.</p>
      </>
    ),
    Viz: TopoptSdfViz,
  },
  {
    badge: "L0 · Substrate", icon: Cpu, accent: "#14b8a6",
    title: <>Two lanes, <Tooltip term="Two-Lane Executor">≤ 200 µs to cancel</Tooltip></>,
    body: (
      <>
        <p>A latency lane handles orchestration, ledger I/O, and progress while a throughput lane runs a work-stealing pool whose units of work are <Tooltip term="Tile">tiles</Tooltip>. Conversational responses stay under 100 ms even under full load.</p>
        <p>Cancellation is a numerical primitive: a cancel token stops in-flight tiles within a bounded 200 µs, and speculative races kill their losers the moment a winner lands.</p>
      </>
    ),
    Viz: TwoLaneExecutorViz,
  },
  {
    badge: "Determinism", icon: GitCommit, accent: "#06b6d4",
    title: <>Bit-identical, <Tooltip term="Tile">every time</Tooltip></>,
    body: (
      <>
        <p>A naive parallel sum wobbles in its last bits depending on how threads happen to interleave. FrankenSim uses fixed-shape reduction trees, counter-based RNG keyed by logical identity, and compensated summation.</p>
        <p>The result is bit-identical across runs, thread counts, and (best-effort) instruction sets. Reproducibility falls out as a side effect; you never have to chase it.</p>
      </>
    ),
    Viz: DeterminismViz,
  },
  {
    badge: "L6 · Helm", icon: Database, accent: "#f97316",
    title: <>A campaign you can <Tooltip term="The Design Ledger">query</Tooltip></>,
    body: (
      <>
        <p>Every artifact is content-addressed and every operation is event-sourced with its <Tooltip term="The Five Explicits">Five Explicits</Tooltip>. Artifacts form a lineage DAG you can time-travel through, fork into parallel worlds, and interrogate with <code className="text-cyan-300">explain(artifact)</code>.</p>
        <p>The Design Ledger is what turns a six-month design campaign into a database you can query instead of a directory you fear.</p>
      </>
    ),
    Viz: DesignLedgerViz,
  },
  {
    badge: "The Gauntlet", icon: ShieldCheck, accent: "#a3e635",
    title: <>Nothing merges without <Tooltip term="The Gauntlet">proof</Tooltip></>,
    body: (
      <>
        <p>Six graded tiers gate every merge: property laws, manufactured-solution order verification, canonical benchmarks, metamorphic tests, chaos and cancellation storms, and cross-ISA determinism audits.</p>
        <p>If the observed convergence slope drifts more than 0.2 from theory, the build fails. Repository policy is code too: the layer direction and the Franken-only dependency rule are enforced mechanically.</p>
      </>
    ),
    Viz: GauntletViz,
  },
];

export default function HomePage() {
  return (
    <main id="main-content">
      {/* ================================================================
          1. HERO
          ================================================================ */}
      <section className="relative flex flex-col items-center pt-28 pb-20 md:pb-28 overflow-hidden text-left">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[90px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[110px]" />
          <GlowOrbits />
        </div>

        <div className="relative z-10 mx-auto max-w-screen-2xl px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-w-0">
            {/* Left: copy */}
            <div className="relative flex flex-col items-start min-w-0 w-full max-w-full">
              <div className="hidden lg:block absolute -top-4 right-2 z-20" aria-hidden="true">
                <FrankenEye className="scale-110" />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-[10px] font-black uppercase tracking-[0.28em] sm:tracking-[0.3em] text-cyan-400 mb-7 md:mb-8 max-w-full"
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500 animate-ping" />
                <span className="truncate">v0.0.1 · 100+ crates · pure Rust</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="text-[clamp(2.5rem,9vw,6rem)] font-black tracking-tight leading-[0.95] sm:leading-[0.9] text-white mb-6 md:mb-8 max-w-full text-balance"
              >
                Simulation<br className="hidden sm:block" /> that returns{" "}
                <span className="text-gradient-sync">proofs</span>.
              </motion.h1>

              <p className="text-base sm:text-lg md:text-xl text-slate-400 font-medium leading-relaxed max-w-2xl mb-8 md:mb-10">
                FrankenSim is a single, memory-safe Rust continuum for geometry, physics,
                optimization, and rendering. Derivatives, error bounds, budgets,
                provenance, and cancellation ride <span className="text-slate-200">inside the values</span>.
              </p>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                <Magnetic strength={0.1}>
                  <Link
                    href="/flagships"
                    data-magnetic="true"
                    className="relative w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl bg-cyan-500 text-black font-black text-base hover:bg-white transition-all flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(34,211,238,0.3)] active:scale-95"
                  >
                    <Rocket className="relative h-5 w-5 shrink-0" />
                    <span className="relative">See the Flagships</span>
                  </Link>
                </Magnetic>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
                  <Magnetic strength={0.1}>
                    <Link
                      href="/kernel"
                      data-magnetic="true"
                      className="w-full px-4 py-3.5 sm:px-6 sm:py-4 rounded-2xl bg-white/5 border border-cyan-500/20 text-white font-bold text-sm sm:text-base hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Boxes className="h-5 w-5 shrink-0 text-cyan-400" />
                      <span className="whitespace-nowrap"><span className="hidden lg:inline">Explore the </span>Kernel</span>
                    </Link>
                  </Magnetic>
                  <Magnetic strength={0.1}>
                    <a
                      href={siteConfig.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-magnetic="true"
                      className="w-full px-4 py-3.5 sm:px-6 sm:py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm sm:text-base hover:bg-white/10 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Github className="h-5 w-5 shrink-0" />
                      Source
                    </a>
                  </Magnetic>
                </div>
              </div>
            </div>

            {/* Right: the seven-layer stack, live */}
            <div className="relative w-full group min-w-0 max-w-full mt-4 lg:mt-0">
              <div className="absolute -top-6 right-1 md:top-[-48px] md:right-[4%] z-20 w-14 h-20 sm:w-16 sm:h-24 md:w-24 md:h-36 animate-float pointer-events-none">
                <RobotMascot />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-[2rem] blur opacity-25 group-hover:opacity-45 transition duration-1000" />
              <SyncContainer withNodes={false} className="relative glass-modern p-0 overflow-hidden shadow-2xl w-full min-w-0">
                <BorderBeam />
                <SevenLayerStackViz />
              </SyncContainer>
              <div className="absolute -bottom-6 left-4 md:-bottom-8 md:left-6 z-30 glass-modern p-4 md:p-5 rounded-2xl border border-cyan-500/20 shadow-2xl animate-float flex">
                <div className="flex flex-col text-left">
                  <span className="text-2xl md:text-4xl font-black text-cyan-400 tabular-nums tracking-tighter">L0–L6</span>
                  <span className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">One acyclic workspace</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hero stats */}
      <div className="max-w-7xl mx-auto px-6 mb-20 md:mb-28 mt-4 md:mt-0">
        <StatsGrid stats={heroStats} />
      </div>

      {/* ================================================================
          2. THE CONTINUUM — concept walkthrough
          ================================================================ */}
      <section className="relative py-20 md:py-32 overflow-hidden border-y border-white/5 bg-white/[0.01]">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-cyan-950/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center mb-16 md:mb-24">
            <div className="inline-flex items-center gap-3 mb-6 justify-center">
              <div className="h-px w-8 bg-cyan-500/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">The Continuum</span>
              <div className="h-px w-8 bg-cyan-500/40" />
            </div>
            <GlitchText trigger="hover" intensity="medium">
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6">
                The archipelago collapses <br className="hidden md:block" /> into a{" "}
                <span className="text-cyan-400">continuum</span>.
              </h2>
            </GlitchText>
            <p className="text-lg md:text-xl text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed">
              Geometry, physics, optimization, and rendering usually live in six incompatible tools,
              and the seams between them are where correctness drowns. FrankenSim makes derivatives,
              error bounds, budgets, provenance, and cancellation first-class values that travel together.
            </p>
          </div>

          <div className="space-y-20 sm:space-y-28 lg:space-y-40">
            {CONCEPTS.map((c, i) => {
              const Icon = c.icon;
              const Viz = c.Viz;
              const flip = i % 2 === 1;
              return (
                <div
                  key={i}
                  className={`flex flex-col ${flip ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-10 lg:gap-20`}
                >
                  <div className="flex-1 w-full min-w-0 space-y-6 text-left">
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border"
                      style={{ color: c.accent, borderColor: `${c.accent}55`, backgroundColor: `${c.accent}12` }}
                    >
                      <Icon className="h-3 w-3 shrink-0" /> {c.badge}
                    </div>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight">{c.title}</h3>
                    <div className="text-base sm:text-lg text-slate-400 leading-relaxed space-y-4">{c.body}</div>
                  </div>
                  <div className="flex-1 w-full min-w-0 max-w-2xl">
                    <LazyViz minHeight={480}>
                      <SyncContainer withPulse accentColor={c.accent} className="p-2 md:p-4 bg-black/40 shadow-2xl">
                        <Viz />
                      </SyncContainer>
                    </LazyViz>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================
          3. BUILT DIFFERENT — feature cards
          ================================================================ */}
      <SectionShell
        id="features"
        icon="sparkles"
        eyebrow="Why FrankenSim"
        title="Built Different"
        kicker="A ground-up continuum rather than a faster solver bolted onto old plumbing: the value that flows through the system already carries its own proof, budget, and provenance."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </SectionShell>

      {/* ================================================================
          4. HOW IT COMPARES
          ================================================================ */}
      <SectionShell
        id="comparison"
        icon="gitCompare"
        eyebrow="The Archipelago"
        title="Against the Incumbents"
        kicker="The incumbents assume a human absorbs the seams between solvers. FrankenSim makes composition itself a first-class certified operation: the one thing they cannot retrofit."
      >
        <ComparisonTable />
      </SectionShell>

      {/* ================================================================
          5. THE CODE
          ================================================================ */}
      <SectionShell
        id="code"
        icon="terminal"
        eyebrow="The Interface"
        title="One True Interface"
        kicker="Agents and humans drive FrankenSim through FrankenScript, a typed IR where units, seeds, and budgets are stated inline, and every refusal teaches."
      >
        <div className="space-y-6">
          <SyncContainer withPulse accentColor="#06b6d4" className="p-1 md:p-2 bg-black/40">
            <RustCodeBlock code={codeExampleStudy} title="studies/spout-laminar-v3.fscript" />
          </SyncContainer>
          <SyncContainer withPulse accentColor="#a855f7" className="p-1 md:p-2 bg-black/40">
            <RustCodeBlock code={codeExample} title="examples/laplacian.rs" />
          </SyncContainer>
        </div>
      </SectionShell>

      {/* ================================================================
          6. ROADMAP TEASER
          ================================================================ */}
      <SectionShell
        id="build-log"
        icon="clock"
        eyebrow="The Build Log"
        title="Gauntlet-Gated"
        kicker="Each phase gate is a Gauntlet state, not a date. The vertical skeleton, Bedrock, and Geometry are proven; the first optimization is landing now."
      >
        <Timeline items={changelog.slice(0, 4)} />
        <div className="mt-10 flex justify-center">
          <Link
            href="/roadmap"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-300 transition-all hover:border-cyan-500/30 hover:bg-white/10 hover:text-white"
          >
            See the full roadmap &amp; project graph
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </SectionShell>

      {/* ================================================================
          7. GET STARTED CTA
          ================================================================ */}
      <section className="relative overflow-hidden py-28 md:py-36">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/20 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-900/60 bg-gradient-to-br from-cyan-950/80 to-cyan-900/50 text-cyan-400 shadow-lg shadow-cyan-900/10">
              <Terminal className="h-6 w-6" />
            </div>
          </div>

          <GlitchText trigger="hover" intensity="medium">
            <h2 className="font-bold tracking-tighter text-white text-4xl md:text-6xl">Clone the continuum.</h2>
          </GlitchText>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400 md:text-xl font-medium">
            FrankenSim is a large, working Rust workspace: 100+ crates, 160K+ lines, 1,300+ tests.
            There is no crates.io release yet; build it from source and read the plan.
          </p>

          <div className="mx-auto mt-10 max-w-md">
            <div className="glow-cyan overflow-hidden rounded-2xl border border-cyan-500/20 bg-black/60 shadow-xl shadow-cyan-950/30">
              <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-cyan-500/60" />
                </div>
                <span className="text-xs text-slate-600 font-bold uppercase tracking-widest">terminal</span>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center gap-3 font-mono text-sm">
                  <span className="select-none text-cyan-500 font-bold">$</span>
                  <code className="text-slate-200 font-bold tracking-tight">git clone github.com/Dicklesworthstone/frankensim</code>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Shield className="h-3 w-3 text-cyan-400" />
              MIT License &middot; Pure Safe Rust
            </div>
            <Link
              href="/getting-started"
              data-magnetic="true"
              className="glow-cyan group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-500 px-8 py-4 text-base font-bold text-black shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-400 hover:to-cyan-300"
            >
              <Rocket className="h-5 w-5" />
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
