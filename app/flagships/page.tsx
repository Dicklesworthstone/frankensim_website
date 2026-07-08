import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Plane, Building2, Droplets, Target, Sparkles, Rocket, Boxes,
  Camera, Layers, CheckCircle2, Github, type LucideIcon,
} from "lucide-react";

import GlitchText from "@/components/glitch-text";
import { SyncContainer } from "@/components/sync-elements";
import AdjointFlowViz from "@/components/viz/adjoint-flow-viz";
import EprocessRaceViz from "@/components/viz/eprocess-race-viz";
import BudgetLedgerViz from "@/components/viz/budget-ledger-viz";
import CutfemSdfViz from "@/components/viz/cutfem-sdf-viz";
import TopoptSdfViz from "@/components/viz/topopt-sdf-viz";
import { flagships, phases, siteConfig } from "@/lib/content";

export const metadata: Metadata = {
  title: "Flagships",
  description:
    "The three forcing functions that drive FrankenSim end-to-end: an ornithoid aircraft, a seismic-minimal frame, and a laminar-pour vessel. Plus the P2 marquee: topology optimization on a raw SDF with no mesh in the loop. Each returns a certified artifact rather than a bare number.",
};

/* ------------------------------------------------------------------ */
/*  Per-flagship presentation: icon, the phase that delivers it,       */
/*  and the interactive visualizations that carry its story.           */
/* ------------------------------------------------------------------ */

type VizEntry = { Viz: React.ComponentType; caption: string };

const FLAGSHIP_EXTRA: Record<
  string,
  { Icon: LucideIcon; phaseId: string; vizzes: VizEntry[] }
> = {
  aircraft: {
    Icon: Plane,
    phaseId: "P5",
    vizzes: [
      {
        Viz: AdjointFlowViz,
        caption:
          "The adjoint aero solve: solve the flow forward once, then a single adjoint solve returns the full gradient over every shape parameter, differentiating through the converged solution rather than the solver's iterations.",
      },
    ],
  },
  frame: {
    Icon: Building2,
    phaseId: "P4",
    vizzes: [
      {
        Viz: EprocessRaceViz,
        caption:
          "Anytime-valid fragility stopping: candidate frames race under a betting e-process, and the Kanai–Tajimi + MLMC campaign halts the instant the seismic evidence is decisive, with no fixed-horizon core-hours burned.",
      },
      {
        Viz: BudgetLedgerViz,
        caption:
          "The Error Ledger and Time Ledger attribute every digit of the fragility bound and every core-second back to the operator that produced it, so a tighter tolerance has a visible price.",
      },
    ],
  },
  vessel: {
    Icon: Droplets,
    phaseId: "P3",
    vizzes: [
      {
        Viz: CutfemSdfViz,
        caption:
          "The vessel is a level set, an SDF, so physics runs directly on it with zero body-fitted meshing (shown: cut cells with a ghost penalty and Nitsche BCs). The laminar pour itself is a free-surface LBM solve tuned to an Orr–Sommerfeld stability objective.",
      },
    ],
  },
};

function accentTitle(name: string, color: string) {
  const words = name.split(" ");
  const last = words.pop() ?? name;
  const head = words.join(" ");
  return (
    <>
      {head}
      {head ? " " : ""}
      <span style={{ color }}>{last}.</span>
    </>
  );
}

export default function FlagshipsPage() {
  const marquee = phases.find((p) => p.id === "P2");

  return (
    <main id="main-content">
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute top-[-8%] left-[8%] h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[120px]" />
          <div className="absolute top-[10%] right-[6%] h-[380px] w-[380px] rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-amber-500/[0.07] blur-[130px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-3">
              <div className="h-px w-8 bg-cyan-500/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
                The Forcing Functions
              </span>
              <div className="h-px w-8 bg-cyan-500/40" />
            </div>

            <GlitchText trigger="hover" intensity="medium">
              <h1 className="mb-6 text-5xl font-black tracking-tighter text-white md:text-7xl">
                Three <span className="text-cyan-400">north stars</span>.
              </h1>
            </GlitchText>

            <p className="mx-auto max-w-2xl text-xl font-medium leading-relaxed text-slate-400">
              FrankenSim is driven by three flagship pipelines plus a marquee demo. Each is a
              forcing function that must work end-to-end, and each produces a{" "}
              <span className="text-slate-200">certified artifact</span> rather than a bare number.
            </p>
          </div>

          {/* Illustration banner */}
          <div className="group relative mx-auto mt-16 max-w-5xl">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-blue-500 via-cyan-500 to-amber-500 opacity-20 blur transition duration-1000 group-hover:opacity-35" />
            <SyncContainer withNodes={false} className="relative overflow-hidden glass-modern p-0 shadow-2xl">
              <Image
                src="/frankensim_illustration.webp"
                alt="The FrankenSim continuum: geometry, physics, optimization, and rendering fused into one memory-safe Rust kernel."
                width={1280}
                height={853}
                priority
                className="h-auto w-full rounded-2xl"
              />
            </SyncContainer>
          </div>

          {/* Quick index */}
          <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-3">
            {flagships.map((f) => {
              const Icon = FLAGSHIP_EXTRA[f.id].Icon;
              return (
                <a
                  key={f.id}
                  href={`#${f.id}`}
                  className="group flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04]"
                  style={{ borderColor: `${f.color}22` }}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${f.color}18`, color: f.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white">{f.name}</div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-500">{f.tagline}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================
          THE THREE FLAGSHIPS — full alternating sections
          ================================================================ */}
      {flagships.map((f, i) => {
        const { Icon, phaseId, vizzes } = FLAGSHIP_EXTRA[f.id];
        const phase = phases.find((p) => p.id === phaseId);
        const flip = i % 2 === 1;
        const statusLabel =
          phase?.status === "done" ? "Proven" : phase?.status === "active" ? "Landing now" : "Planned";

        return (
          <section
            key={f.id}
            id={f.id}
            className="relative overflow-hidden border-t border-white/5 py-20 md:py-32"
          >
            <div className="absolute inset-0 z-0" aria-hidden="true">
              <div
                className={`absolute top-1/3 h-[420px] w-[420px] rounded-full blur-[140px] ${flip ? "right-[-6%]" : "left-[-6%]"}`}
                style={{ backgroundColor: `${f.color}14` }}
              />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl px-6">
              <div
                className={`flex flex-col items-start gap-12 lg:gap-20 ${flip ? "lg:flex-row-reverse" : "lg:flex-row"}`}
              >
                {/* Copy column */}
                <div className="flex-1 w-full min-w-0 space-y-7">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl border"
                      style={{
                        backgroundColor: `${f.color}12`,
                        borderColor: `${f.color}40`,
                        color: f.color,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className="text-[10px] font-black uppercase tracking-[0.3em]"
                      style={{ color: f.color }}
                    >
                      Flagship 0{i + 1}
                    </span>
                  </div>

                  <GlitchText trigger="hover" intensity="low">
                    <h2 className="text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
                      {accentTitle(f.name, f.color)}
                    </h2>
                  </GlitchText>

                  <p className="text-lg font-semibold text-slate-300">{f.tagline}</p>
                  <p className="text-lg leading-relaxed text-slate-400">{f.description}</p>

                  {/* Objective — a formula-ish chip */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                      Objective
                    </div>
                    <div
                      className="inline-flex items-center gap-3 rounded-xl border px-4 py-3 font-mono text-sm"
                      style={{ borderColor: `${f.color}40`, backgroundColor: `${f.color}0d` }}
                    >
                      <Target className="h-4 w-4 shrink-0" style={{ color: f.color }} />
                      <span className="text-slate-200">{f.objective}</span>
                    </div>
                  </div>

                  {/* Methods — chips */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                      Methods
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {f.methods.map((m) => (
                        <span
                          key={m}
                          className="rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Payoff */}
                  <div
                    className="flex items-start gap-3 rounded-2xl border p-5"
                    style={{ borderColor: `${f.color}33`, backgroundColor: `${f.color}0a` }}
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: f.color }} />
                    <div>
                      <div
                        className="mb-1 text-[10px] font-black uppercase tracking-[0.3em]"
                        style={{ color: f.color }}
                      >
                        The Payoff
                      </div>
                      <p className="leading-relaxed text-slate-300">{f.payoff}</p>
                    </div>
                  </div>

                  {/* Phase tie-in */}
                  {phase && (
                    <div className="flex items-center gap-3 pt-1 text-sm text-slate-500">
                      <Layers className="h-4 w-4 text-slate-600" />
                      <span>
                        Delivered by{" "}
                        <span className="font-bold text-slate-300">
                          {phase.id} · {phase.name}
                        </span>{" "}
                        <span className="text-slate-600">({phase.window})</span>
                      </span>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
                        style={{ borderColor: `${f.color}40`, color: f.color }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Viz column */}
                <div className="w-full flex-1 min-w-0 space-y-8 lg:max-w-2xl">
                  {vizzes.map(({ Viz, caption }, vi) => (
                    <div key={vi} className="space-y-3">
                      <SyncContainer
                        withPulse
                        accentColor={f.color}
                        className="bg-black/40 p-2 shadow-2xl md:p-4"
                      >
                        <Viz />
                      </SyncContainer>
                      <p className="px-1 text-sm leading-relaxed text-slate-500">{caption}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* ================================================================
          VESSEL CALLOUT — the marketing shot IS the physics
          ================================================================ */}
      <section className="relative overflow-hidden border-t border-white/5 py-20 md:py-28">
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/10 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-400">
              <Camera className="h-6 w-6" />
            </div>
          </div>
          <GlitchText trigger="hover" intensity="medium">
            <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">
              The marketing shot <span className="text-cyan-400">is</span> the physics.
            </h2>
          </GlitchText>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            For the Spout That Never Dribbles, the hero render is not a separate art asset. Lumen&apos;s
            differentiable renderer draws the certified vessel from the{" "}
            <span className="text-slate-200">same bytes</span> the Orr–Sommerfeld stability objective and
            the free-surface LBM pour were computed on. The image you would put on the box is a
            differentiable function of the design, so you can optimize what the product looks like and
            what it does at once, and never ship a picture the physics disagrees with.
          </p>
        </div>
      </section>

      {/* ================================================================
          THE MARQUEE — topology optimization on a raw SDF (P2)
          ================================================================ */}
      <section
        id="marquee"
        className="relative overflow-hidden border-t border-white/5 py-20 md:py-32"
      >
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute top-1/4 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-cyan-500/[0.09] blur-[140px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center gap-3">
              <div className="h-px w-8 bg-cyan-500/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
                The Marquee {marquee ? `· ${marquee.id}` : ""}
              </span>
              <div className="h-px w-8 bg-cyan-500/40" />
            </div>
            <GlitchText trigger="hover" intensity="medium">
              <h2 className="text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">
                Topology optimization on a raw SDF, <span className="text-cyan-400">no mesh in the loop</span>.
              </h2>
            </GlitchText>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
              The forcing function for the whole geometry-physics bridge. A SIMP density field evolves to
              minimize compliance under a volume fraction, its physics computed by CutFEM directly on the
              level set. A grey blob resolves into a classic cantilever truss, and every iterate carries a
              composed error certificate, with the mesh-step counter pinned at zero.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-6xl gap-8 lg:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <SyncContainer withPulse accentColor="#06b6d4" className="bg-black/40 p-2 shadow-2xl md:p-4">
                <TopoptSdfViz />
              </SyncContainer>
              <p className="px-1 text-sm leading-relaxed text-slate-500">
                The optimizer reshapes the boundary every iteration; compliance falls as the density field
                condenses into load-bearing structure.
              </p>
            </div>
            <div className="min-w-0 space-y-3">
              <SyncContainer withPulse accentColor="#22d3ee" className="bg-black/40 p-2 shadow-2xl md:p-4">
                <CutfemSdfViz />
              </SyncContainer>
              <p className="px-1 text-sm leading-relaxed text-slate-500">
                Underneath, CutFEM-on-SDF supplies FEM-grade physics on the moving level set: the cut cells
                are certified, so the optimizer never has to wait on a remesh.
              </p>
            </div>
          </div>

          {marquee && (
            <div className="mx-auto mt-12 max-w-4xl">
              <div className="grid gap-4 rounded-2xl border border-cyan-500/15 bg-white/[0.02] p-6 md:grid-cols-2 md:p-8">
                <div className="flex items-start gap-3">
                  <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
                  <div>
                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
                      Scope
                    </div>
                    <p className="text-sm leading-relaxed text-slate-400">{marquee.scope}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
                  <div>
                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
                      Exit Gate
                    </div>
                    <p className="text-sm leading-relaxed text-slate-400">{marquee.exit}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================
          CTA
          ================================================================ */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/20 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-3xl px-6 text-center">
          <GlitchText trigger="hover" intensity="medium">
            <h2 className="text-4xl font-black tracking-tighter text-white md:text-5xl">
              From forcing function to <span className="text-cyan-400">kernel</span>.
            </h2>
          </GlitchText>
          <p className="mx-auto mt-6 max-w-xl text-lg font-medium leading-relaxed text-slate-400">
            Every flagship bottoms out in the same seven-layer continuum. See how the kernel is built, or
            clone it and run the vertical skeleton yourself.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/architecture"
              className="group inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-white/5 px-6 py-3 text-sm font-bold text-slate-200 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white"
            >
              <Boxes className="h-4 w-4 text-cyan-400" />
              Explore the Architecture
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/getting-started"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-400 hover:to-cyan-300"
            >
              <Rocket className="h-4 w-4" />
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href={siteConfig.github}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-white/10 hover:text-white"
            >
              <Github className="h-4 w-4" />
              Source
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
