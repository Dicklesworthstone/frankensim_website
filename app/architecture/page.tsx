import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Cpu, GitMerge, Network, LineChart, Package,
  Ruler, Dices, Gauge, GitCommit, Key, Layers as LayersIcon,
} from "lucide-react";

import SectionShell from "@/components/section-shell";
import GlitchText from "@/components/glitch-text";
import { SyncContainer } from "@/components/sync-elements";

// Client viz — imported directly. Each has "use client" internally, so a
// direct import into this server component SSRs + hydrates cleanly. (No
// next/dynamic { ssr:false }, which is illegal in a server component here.)
import SevenLayerStackViz from "@/components/viz/seven-layer-stack-viz";
import TwoLaneExecutorViz from "@/components/viz/two-lane-executor-viz";
import DeterminismViz from "@/components/viz/determinism-viz";
import RooflineViz from "@/components/viz/roofline-viz";
import RegionChartRouterViz from "@/components/viz/region-chart-router-viz";
import AdjointFlowViz from "@/components/viz/adjoint-flow-viz";

import {
  layers,
  crossCuttingCrates,
  principles,
  fiveExplicits,
  machines,
} from "@/lib/content";

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "Inside FrankenSim's continuum: one memory-safe Rust kernel organized as seven strictly-acyclic layers (L0 Substrate → L6 Helm), where derivatives, error bounds, budgets, provenance, and cancellation ride inside the values.",
  openGraph: {
    title: "Architecture | FrankenSim",
    description:
      "Seven strictly-acyclic layers, one deterministic Rust continuum. The FrankenSim stack in full.",
  },
};

/* ------------------------------------------------------------------ */
/*  The request lifecycle — how a call flows through the continuum.    */
/* ------------------------------------------------------------------ */

const DATAFLOW: { badge: string; name: string; color: string; action: string }[] = [
  { badge: "L6", name: "HELM", color: "#f97316", action: "lowers an agent’s FrankenScript program to a task DAG." },
  { badge: "L0", name: "SUBSTRATE", color: "#64748b", action: "schedules the DAG’s nodes as budgeted, cancellable kernel invocations across the two-lane executor." },
  { badge: "L2", name: "MORPH", color: "#10b981", action: "supplies geometry as charts of Regions, routed to whatever representation the task needs." },
  { badge: "L3", name: "FLUX", color: "#06b6d4", action: "turns charts into complexes, cochains, and solved fields, with adjoints and error estimates attached." },
  { badge: "L4", name: "ASCENT", color: "#3b82f6", action: "consumes objectives, gradients, and confidence sequences to propose new designs." },
  { badge: "L5", name: "LUMEN", color: "#a855f7", action: "renders anything on demand; the marketing shot and the physics are the same bytes." },
  { badge: "▤", name: "LEDGER", color: "#eab308", action: "receives every artifact and event, content-addressed and event-sourced, so a result always knows how it was made." },
];

const EXPLICIT_ICONS = {
  ruler: Ruler,
  dices: Dices,
  gauge: Gauge,
  gitCommit: GitCommit,
  key: Key,
} as const;

/* Small reusable micro-label eyebrow for the full-width custom sections. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="h-px w-8 bg-cyan-500/40" />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
        {children}
      </span>
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <main id="main-content">
      {/* ============================================================
          1. HERO — the signature stack, front and center
          ============================================================ */}
      <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute top-0 left-1/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[130px]" />
          <div className="absolute -bottom-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping" />
              Technical Architecture
            </div>

            <GlitchText trigger="hover" intensity="medium">
              <h1 className="mb-8 text-[clamp(2.75rem,7vw,5.5rem)] font-black leading-[0.9] tracking-tight text-white">
                Inside the <span className="text-gradient-sync">continuum</span>.
              </h1>
            </GlitchText>

            <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-slate-400 md:text-xl">
              One memory-safe Rust continuum for geometry, physics, optimization, and rendering,
              organized as seven strictly-acyclic layers, <span className="text-slate-200">L0 → L6</span>,
              where derivatives, error bounds, budgets, provenance, and cancellation ride inside the values.
            </p>
          </div>

          {/* The stack, live */}
          <div className="group relative mx-auto mt-14 max-w-5xl md:mt-20">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-cyan-500 to-violet-500 opacity-20 blur transition duration-1000 group-hover:opacity-40" />
            <SyncContainer withNodes={false} className="relative glass-modern overflow-hidden p-0 shadow-2xl">
              <SevenLayerStackViz />
            </SyncContainer>
          </div>
        </div>
      </section>

      {/* ============================================================
          2. THE DATAFLOW — how a request flows
          ============================================================ */}
      <SectionShell
        id="dataflow"
        icon="network"
        eyebrow="Request Lifecycle"
        title="The dataflow."
        kicker="A single request threads the whole continuum: lowered to a task DAG, scheduled, solved, and recorded, with evidence bubbling back up."
      >
        <div className="space-y-6">
          <p className="text-lg leading-relaxed text-slate-400">
            <span className="font-bold text-orange-300">HELM</span> lowers an agent&apos;s FrankenScript program
            to a task DAG; the DAG&apos;s nodes are budgeted, cancellable kernel invocations scheduled by{" "}
            <span className="font-bold text-slate-300">SUBSTRATE</span>;{" "}
            <span className="font-bold text-emerald-300">MORPH</span> supplies geometry as charts of Regions;{" "}
            <span className="font-bold text-cyan-300">FLUX</span> turns charts into complexes, cochains, and
            solved fields with adjoints and error estimates;{" "}
            <span className="font-bold text-blue-300">ASCENT</span> consumes objectives, gradients, and
            confidence sequences to propose new designs;{" "}
            <span className="font-bold text-violet-300">LUMEN</span> renders anything on demand; and every
            artifact and event lands in the <span className="font-bold text-yellow-300">Ledger</span>.
          </p>

          <div className="relative space-y-2">
            {DATAFLOW.map((stage, i) => (
              <div key={stage.name} className="relative">
                {i > 0 && (
                  <div className="pointer-events-none absolute -top-[7px] left-[26px] z-10 text-slate-700" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v9M2.5 6.5 6 10l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div
                  className="card card-hover flex items-center gap-4 overflow-hidden rounded-xl p-3.5"
                  style={{ borderColor: `${stage.color}33` }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-black"
                    style={{ color: stage.color, background: `${stage.color}1a`, border: `1px solid ${stage.color}44` }}
                  >
                    {stage.badge}
                  </div>
                  <div className="min-w-0">
                    <span
                      className="mr-2 font-mono text-[11px] font-black uppercase tracking-[0.2em]"
                      style={{ color: stage.color }}
                    >
                      {stage.name}
                    </span>
                    <span className="text-sm leading-relaxed text-slate-400">{stage.action}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-500">
            Nothing crosses a layer boundary implicitly. Budgets, seeds, units, versions, and capabilities
            travel with the call; adjoints and error slices travel with the result.
          </p>
        </div>
      </SectionShell>

      {/* ============================================================
          3. THE SEVEN LAYERS — the centerpiece
          ============================================================ */}
      <section
        data-section
        id="layers"
        aria-labelledby="layers-heading"
        className="relative mx-auto max-w-7xl px-6 py-16 md:py-32 lg:py-40"
      >
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <Eyebrow>The Stack</Eyebrow>
          </div>
          <GlitchText trigger="hover" intensity="low">
            <h2
              id="layers-heading"
              className="text-4xl font-black tracking-tight text-white md:text-6xl"
            >
              Seven strictly-acyclic <span className="text-cyan-400">layers</span>.
            </h2>
          </GlitchText>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-400">
            Dependencies only ever point downward, L6 → L0. Each layer is a named region of the workspace,
            colored on the spectrum, carrying its own crates; a mechanical <code className="font-mono text-cyan-400">xtask</code> check
            fails any build that would create a cycle.
          </p>
        </div>

        {/* Cross-cutting spine */}
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              The cross-cutting spine
            </div>
            <div className="mt-1 text-sm text-slate-400">
              Three crates are carried at <span className="text-slate-200">every layer</span>: quantities,
              observability, and evidence. Units, events, and certificates are never bolted on afterward.
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {crossCuttingCrates.map((c) => (
              <span
                key={c}
                className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 font-mono text-[11px] text-cyan-300"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* The layer panels (L6 → L0) */}
        <div className="space-y-3">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className="card kinetic-card group relative overflow-hidden rounded-2xl"
              style={{ borderLeft: `3px solid ${layer.color}` }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `radial-gradient(600px circle at 0% 0%, ${layer.color}0d, transparent 70%)` }}
                aria-hidden="true"
              />
              <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-start md:p-7">
                {/* Identity column */}
                <div className="flex items-center gap-4 md:w-60 md:shrink-0">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-black leading-none"
                    style={{ color: layer.color, background: `${layer.color}1a`, border: `1px solid ${layer.color}44` }}
                  >
                    {layer.id}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-mono text-[11px] font-black uppercase tracking-[0.2em]"
                      style={{ color: layer.color }}
                    >
                      {layer.code}
                    </div>
                    <div className="text-base font-bold text-slate-200">{layer.name}</div>
                    <div className="text-[12px] leading-snug text-slate-500">{layer.tagline}</div>
                  </div>
                </div>

                {/* Content column */}
                <div className="min-w-0 flex-1 space-y-4">
                  <p className="text-sm leading-relaxed text-slate-400">{layer.responsibility}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {layer.crates.map((c) => (
                      <span
                        key={c}
                        className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                        style={{ color: layer.color, background: `${layer.color}14`, border: `1px solid ${layer.color}2e` }}
                      >
                        {c}
                      </span>
                    ))}
                    <span className="ml-1 self-center font-mono text-[10px] text-slate-600">
                      {layer.crates.length} crate{layer.crates.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Franken constellation base */}
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-5 py-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
              ▽ Franken constellation (the only runtime deps, locked by hash): asupersync · FrankenSQLite · FrankenNumpy · FrankenTorch · FrankenScipy · FrankenPandas · FrankenNetworkx
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
          4. THE SUBSTRATE, UP CLOSE — L0
          ============================================================ */}
      <SectionShell
        id="substrate"
        icon="cpu"
        eyebrow="L0 · Substrate"
        title="The substrate, up close."
        kicker="Everything above L0 borrows its two guarantees: a bounded latency-to-cancel and bit-identical arithmetic, no matter how many cores you throw at it."
      >
        <div className="space-y-8">
          <SyncContainer withPulse accentColor="#64748b" className="p-1 bg-black/40 shadow-2xl md:p-2">
            <TwoLaneExecutorViz />
          </SyncContainer>

          <p className="leading-relaxed text-slate-400">
            The executor runs <span className="font-semibold text-slate-200">two lanes</span>: a latency lane for
            async orchestration, ledger I/O, and progress, running alongside a throughput lane, a work-stealing
            fork-join pool whose unit of work is a cache-aligned <span className="text-slate-200">tile</span>.
            A cancel request never waits behind a long compute: the design target is a bounded{" "}
            <span className="font-mono text-cyan-400">latency-to-cancel of ≤ 200 µs</span>, and speculative races
            kill their losers mid-solve.
          </p>

          <SyncContainer withPulse accentColor="#06b6d4" className="p-1 bg-black/40 shadow-2xl md:p-2">
            <DeterminismViz />
          </SyncContainer>

          <p className="leading-relaxed text-slate-400">
            Determinism is a property of the reductions themselves, not a debug mode.{" "}
            <span className="font-semibold text-slate-200">Fixed-shape reduction trees</span>, counter-based RNG
            keyed by logical identity, and compensated summation make results{" "}
            <span className="text-slate-200">bit-identical across thread counts and (best-effort) ISAs</span>.
            The same study replays byte-for-byte on one core or ninety-six.
          </p>
        </div>
      </SectionShell>

      {/* ============================================================
          5. ROOFLINE-HONEST — performance as a fraction of a roof
          ============================================================ */}
      <SectionShell
        id="roofline"
        icon="lineChart"
        eyebrow="Performance"
        title="Roofline-honest."
        kicker="Every kernel ships its arithmetic-intensity analysis against measured machine peak. A performance claim is a fraction of a roof, never a bare number; the targets are stated so they can be failed."
      >
        <div className="space-y-8">
          <SyncContainer withPulse accentColor="#06b6d4" className="p-1 bg-black/40 shadow-2xl md:p-2">
            <RooflineViz />
          </SyncContainer>

          <div className="grid gap-4 sm:grid-cols-2">
            {machines.map((m, i) => (
              <div
                key={m.name}
                className="card card-hover rounded-2xl p-6"
                style={{ borderTop: `2px solid ${i === 0 ? "#06b6d4" : "#a855f7"}` }}
              >
                <div className="text-base font-bold text-slate-100">{m.name}</div>
                <div className="mt-2 font-mono text-[12px] leading-relaxed text-slate-500">{m.detail}</div>
                <div
                  className="mt-4 inline-flex items-center gap-2 rounded-lg px-2.5 py-1 font-mono text-[12px] font-bold"
                  style={{
                    color: i === 0 ? "#22d3ee" : "#c084fc",
                    background: i === 0 ? "#06b6d41a" : "#a855f71a",
                    border: `1px solid ${i === 0 ? "#06b6d444" : "#a855f744"}`,
                  }}
                >
                  <Gauge className="h-3.5 w-3.5" />
                  {m.perCore}
                </div>
              </div>
            ))}
          </div>

          <p className="leading-relaxed text-slate-400">
            The two reference machines are deliberately opposite. The M4 Max pairs modest core counts with a
            huge unified bandwidth; the 96-core Threadripper starves each of its many cores. Bandwidth-per-core
            <span className="text-slate-200"> inverts by roughly 10×</span> between them, so a kernel that is
            compute-bound on one is memory-bound on the other. The roofline registry stores both roofs, and the
            harness measures against real peak on each, refusing to let a folklore number stand in for a proof.
          </p>
        </div>
      </SectionShell>

      {/* ============================================================
          6. GEOMETRY ↔ PHYSICS — the bridge
          ============================================================ */}
      <SectionShell
        id="bridge"
        icon="gitMerge"
        eyebrow="The Bridge"
        title="Geometry ↔ physics."
        kicker="The hardest seam in simulation is the one between the shape and the field. FrankenSim routes representations and differentiates through the solution so that seam becomes a typed, certified value."
      >
        <div className="space-y-8">
          <SyncContainer withPulse accentColor="#10b981" className="p-1 bg-black/40 shadow-2xl md:p-2">
            <RegionChartRouterViz />
          </SyncContainer>

          <p className="leading-relaxed text-slate-400">
            A <span className="font-semibold text-emerald-300">Region</span> is an abstract subset of space,
            never stored directly; it is only ever presented by <span className="font-semibold text-emerald-300">Charts</span>:
            SDF grids, half-edge meshes, F-rep trees, NURBS patches, voxel fields. When a task needs a different
            representation, the <span className="text-slate-200">Rep Router</span> solves a Pareto shortest-path
            problem over the graph of chart-to-chart conversions, picking the cheapest chain that respects your
            error budget, and every conversion emits a certificate.
          </p>

          <SyncContainer withPulse accentColor="#3b82f6" className="p-1 bg-black/40 shadow-2xl md:p-2">
            <AdjointFlowViz />
          </SyncContainer>

          <p className="leading-relaxed text-slate-400">
            Gradients are <span className="font-semibold text-blue-300">adjoint-native</span>: FrankenSim
            differentiates through the converged solution via the implicit function theorem, not by unrolling
            solver iterations. Sensitivities are exact and cheap, the same matrix-free apply serves the forward
            and adjoint passes, and a <span className="text-slate-200">gradient check gates every merge</span>.
            Differentiability is a build requirement, not an afterthought.
          </p>
        </div>
      </SectionShell>

      {/* ============================================================
          7. THE DECALOGUE — ten non-negotiable principles
          ============================================================ */}
      <section
        data-section
        id="decalogue"
        aria-labelledby="decalogue-heading"
        className="relative mx-auto max-w-7xl px-6 py-16 md:py-32 lg:py-40"
      >
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <Eyebrow>Non-Negotiables</Eyebrow>
          </div>
          <GlitchText trigger="hover" intensity="low">
            <h2
              id="decalogue-heading"
              className="text-4xl font-black tracking-tight text-white md:text-6xl"
            >
              The <span className="text-cyan-400">Decalogue</span>.
            </h2>
          </GlitchText>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-400">
            Ten commitments the architecture is built to keep. Every crate, every merge gate, and every refusal
            traces back to one of them.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {principles.map((p) => (
            <div
              key={p.id}
              className="card kinetic-card group relative overflow-hidden rounded-2xl p-6"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 font-mono text-sm font-black text-cyan-300">
                  {p.id}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-100">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================
          8. THE FIVE EXPLICITS — never implicit, ever
          ============================================================ */}
      <section
        data-section
        id="explicits"
        aria-labelledby="explicits-heading"
        className="relative mx-auto max-w-7xl px-6 py-16 md:py-32 lg:py-40"
      >
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <Eyebrow>Agent-First Ergonomics</Eyebrow>
          </div>
          <GlitchText trigger="hover" intensity="low">
            <h2
              id="explicits-heading"
              className="text-4xl font-black tracking-tight text-white md:text-6xl"
            >
              The Five <span className="text-cyan-400">Explicits</span>.
            </h2>
          </GlitchText>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-400">
            The five things a FrankenScript program can never leave unsaid. This is what makes the whole system
            safe for an agent swarm to drive: <span className="text-slate-200">never implicit, ever</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {fiveExplicits.map((e) => {
            const Icon = EXPLICIT_ICONS[e.icon as keyof typeof EXPLICIT_ICONS] ?? Key;
            return (
              <div
                key={e.key}
                className="card kinetic-card group flex flex-col rounded-2xl p-6"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 transition-colors group-hover:border-cyan-500/40">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black text-slate-100">{e.key}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{e.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          9. CLOSING CTA
          ============================================================ */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/20 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-900/60 bg-gradient-to-br from-cyan-950/80 to-cyan-900/50 text-cyan-400 shadow-lg shadow-cyan-900/10">
              <LayersIcon className="h-6 w-6" />
            </div>
          </div>

          <GlitchText trigger="hover" intensity="medium">
            <h2 className="text-4xl font-black tracking-tight text-white md:text-6xl">
              Seven layers. <span className="text-cyan-400">100+ crates</span>.
            </h2>
          </GlitchText>

          <p className="mx-auto mt-6 max-w-xl text-lg font-medium leading-relaxed text-slate-400 md:text-xl">
            You have seen the shape of the continuum. Now walk the crate inventory, or trace the phases that
            build it, each one Gauntlet-gated before it ships.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/kernel"
              className="glow-cyan group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-8 py-4 text-base font-black text-black shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-400 hover:to-cyan-300 active:scale-95"
            >
              <Package className="h-5 w-5" />
              Browse all 100+ crates
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/roadmap"
              className="btn-secondary group inline-flex items-center gap-2.5 rounded-2xl border border-cyan-500/20 bg-white/5 px-8 py-4 text-base font-black text-white transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 active:scale-95"
            >
              <LineChart className="h-5 w-5 text-cyan-400" />
              See the roadmap
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
