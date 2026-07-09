import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Plane, Building2, Droplets, Target, Sparkles, Rocket, Boxes,
  ShieldCheck, CheckCircle2, Github, type LucideIcon,
} from "lucide-react";

import GlitchText from "@/components/glitch-text";
import { SyncContainer } from "@/components/sync-elements";
import CutfemSdfViz from "@/components/viz/cutfem-sdf-viz";
import TopoptSdfViz from "@/components/viz/topopt-sdf-viz";
import OrnithoidPipeline from "@/components/wasm/flagship/ornithoid-pipeline";
import VesselPipeline from "@/components/wasm/flagship/vessel-pipeline";
import FramePipeline from "@/components/wasm/flagship/frame-pipeline";
import { flagships, phases, siteConfig, type Flagship } from "@/lib/content";

export const metadata: Metadata = {
  title: "Flagships",
  description:
    "The forcing functions that drive FrankenSim end to end, each now shipping as a certified five-stage campaign: an ornithoid aircraft, a seismic-minimal frame, and a laminar-pour vessel. Plus the P2 marquee: topology optimization on a raw SDF with no mesh in the loop. Each returns a certified artifact rather than a bare number.",
};

/* ------------------------------------------------------------------ */
/*  Per-flagship presentation: icon + the live end-to-end pipeline     */
/*  component (the real fs-*-e2e campaign compiled to WASM).           */
/* ------------------------------------------------------------------ */

const FLAGSHIP_EXTRA: Record<
  string,
  { Icon: LucideIcon; Pipeline: React.ComponentType }
> = {
  aircraft: { Icon: Plane, Pipeline: OrnithoidPipeline },
  frame: { Icon: Building2, Pipeline: FramePipeline },
  vessel: { Icon: Droplets, Pipeline: VesselPipeline },
};

const EMERALD_BORDER = "rgba(16,185,129,0.30)";
const EMERALD_BG = "rgba(16,185,129,0.07)";

function StatusChip({ status }: { status?: Flagship["status"] }) {
  const shipped = status === "shipped";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.28em]"
      style={
        shipped
          ? { borderColor: "rgba(16,185,129,0.45)", background: "rgba(16,185,129,0.12)", color: "#6ee7b7" }
          : { borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)", color: "#fcd34d" }
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: shipped ? "#10b981" : "#f59e0b" }}
      />
      {shipped ? "Shipped" : "Planned"}
    </span>
  );
}

function CrateChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="rounded-lg border px-2.5 py-1 font-mono text-[12px] font-semibold"
      style={{ borderColor: `${color}33`, background: `${color}0d`, color }}
    >
      {name}
    </span>
  );
}

function CertifiedLine({ text }: { text: string }) {
  return (
    <div
      className="mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3"
      style={{ borderColor: EMERALD_BORDER, background: EMERALD_BG }}
    >
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <p className="min-w-0 font-mono text-[12px] leading-relaxed text-slate-300">
        <span className="font-bold text-emerald-300">Certified: </span>
        {text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  One rich section per flagship                                      */
/* ------------------------------------------------------------------ */

function FlagshipSection({ f, index }: { f: Flagship; index: number }) {
  const { Icon, Pipeline } = FLAGSHIP_EXTRA[f.id];
  const color = f.color;
  const meta = [f.bead, f.layer].filter(Boolean).join(" · ");
  const imageLeft = index % 2 === 0; // image-left, image-right, image-left

  return (
    <section
      id={f.id}
      className="scroll-mt-24 relative overflow-hidden border-t border-white/5 py-20 md:py-28"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-[6%] h-[42%] w-[44%] rounded-full blur-[140px]"
          style={{ background: `${color}12`, left: imageLeft ? "-10%" : undefined, right: imageLeft ? undefined : "-10%" }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Two-column hero: the certified render + the flagship identity.
             Image side alternates per flagship; stacks image-on-top on mobile. ── */}
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          {/* The render — a framed, softly glowing gallery piece, aspect intact */}
          <figure className={`group relative m-0 min-w-0 ${imageLeft ? "" : "lg:order-2"}`}>
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-[2.25rem] blur-2xl transition-opacity duration-700 group-hover:opacity-90"
              style={{ background: `${color}22` }}
            />
            <div
              className="relative overflow-hidden rounded-3xl border shadow-2xl"
              style={{ borderColor: `${color}45`, background: "#070d13" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.image}
                alt={`${f.name}: ${f.tagline}`}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full max-w-full"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: `linear-gradient(158deg, ${color}22 0%, transparent 40%)` }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" aria-hidden="true" />
            </div>
          </figure>

          {/* The identity */}
          <div className={`min-w-0 ${imageLeft ? "" : "lg:order-1"}`}>
            <div className="mb-5 flex flex-wrap items-center gap-2.5">
              <StatusChip status={f.status} />
              {meta && (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-slate-300">
                  {meta}
                </span>
              )}
            </div>

            <div className="mb-4 flex items-center gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
                style={{ background: `${color}18`, borderColor: `${color}45`, color }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className="font-mono text-[10px] font-black uppercase tracking-[0.3em]"
                style={{ color: `${color}cc` }}
              >
                Flagship {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            <GlitchText trigger="hover" intensity="low">
              <h2 className="text-4xl font-black leading-[1.03] tracking-tight text-white md:text-5xl">
                {f.name}
              </h2>
            </GlitchText>

            <p className="mt-4 text-lg font-semibold md:text-xl" style={{ color }}>
              {f.tagline}
            </p>

            <p className="mt-6 text-[15px] leading-relaxed text-slate-300 md:text-base md:leading-relaxed">
              {f.lede ?? f.description}
            </p>
          </div>
        </div>

        {/* ── The certified campaign, stage by stage ── */}
        {f.stages && f.stages.length > 0 && (
          <>
            <div className="mt-16 mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              <span className="h-px w-6" style={{ background: `${color}66` }} />
              The certified campaign, stage by stage
            </div>

            <div className="relative mt-6">
              <div
                aria-hidden="true"
                className="absolute left-[21px] top-3 bottom-3 w-px"
                style={{ background: `linear-gradient(${color}55, ${color}0a)` }}
              />
              <ol className="space-y-9">
                {f.stages.map((s) => (
                  <li key={s.n} className="relative flex gap-5">
                    <div
                      className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-mono text-base font-black"
                      style={{ borderColor: `${color}55`, background: "#050b10", color }}
                    >
                      {s.n}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                        <h3 className="text-lg font-black tracking-tight text-white md:text-xl">{s.name}</h3>
                        <span className="font-mono text-[12px] font-bold" style={{ color }}>{s.crates}</span>
                      </div>
                      <p className="mt-3 text-[15px] leading-relaxed text-slate-400">{s.detail}</p>
                      <CertifiedLine text={s.metric} />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {/* ── Objective / methods / payoff (frame + vessel) ── */}
        {!f.stages && (
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="space-y-8">
              <div className="space-y-2.5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Objective</div>
                <div
                  className="flex items-center gap-3 rounded-xl border px-4 py-3 font-mono text-sm"
                  style={{ borderColor: `${color}40`, background: `${color}0d` }}
                >
                  <Target className="h-4 w-4 shrink-0" style={{ color }} />
                  <span className="min-w-0 break-words text-slate-200">{f.objective}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Methods</div>
                <div className="flex flex-wrap gap-2">
                  {f.methods.map((m) => (
                    <span
                      key={m}
                      className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="flex items-start gap-3 rounded-2xl border p-5 md:p-6"
              style={{ borderColor: `${color}33`, background: `${color}0a` }}
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color }} />
              <div className="min-w-0">
                <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color }}>
                  The payoff
                </div>
                <p className="text-[15px] leading-relaxed text-slate-300">{f.payoff}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Composed-from crate roll ── */}
        {f.composed && f.composed.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              <span className="h-px w-6" style={{ background: `${color}66` }} />
              Composed from
            </div>
            <div className="flex flex-wrap gap-2.5">
              {f.composed.map((c) => (
                <CrateChip key={c} name={c} color={color} />
              ))}
            </div>
          </div>
        )}

        {/* ── Finale: what the campaign proves (ornithoid) ── */}
        {f.finale && (
          <div
            className="mt-8 rounded-2xl border p-5 md:p-6"
            style={{ borderColor: EMERALD_BORDER, background: EMERALD_BG }}
          >
            <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" /> What it proves
            </div>
            <p className="text-[15px] leading-relaxed text-slate-200 md:text-base md:leading-relaxed">{f.finale}</p>
          </div>
        )}

        {/* ── The certified pipeline, live in the browser ── */}
        <div className="mt-12">
          <div className="mb-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: `${color}dd` }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
            </span>
            The certified pipeline, live in your browser
          </div>
          {/* The real fs-*-e2e campaign compiled to WASM. Rendered directly:
              it self-gates on scroll via useInView and brings its own frame. */}
          <div className="min-w-0">
            <Pipeline />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FlagshipsPage() {
  const marquee = phases.find((p) => p.id === "P2");

  return (
    <main id="main-content">
      {/* ================================================================
          HERO — no illustration, editorial lede on what a flagship is
          ================================================================ */}
      <section className="relative overflow-hidden pt-36 pb-16">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute top-[-10%] left-[-5%] h-[46%] w-[46%] rounded-full bg-blue-500/10 blur-[120px]" />
          <div className="absolute top-[6%] right-[-6%] h-[42%] w-[44%] rounded-full bg-cyan-600/10 blur-[120px]" />
          <div className="absolute bottom-[-14%] left-1/2 h-[36%] w-[40%] -translate-x-1/2 rounded-full bg-amber-500/[0.06] blur-[130px]" />
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-6 inline-flex items-center gap-3">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/80">
              The Forcing Functions
            </span>
          </div>

          <GlitchText trigger="hover" intensity="medium">
            <h1 className="text-[clamp(2.5rem,6.5vw,5rem)] font-black leading-[0.98] tracking-tight text-white">
              Three flagships, <span className="text-gradient-sync">driven end to end</span>.
            </h1>
          </GlitchText>

          <p className="mt-8 max-w-3xl text-lg font-medium leading-relaxed text-slate-300 md:text-xl md:leading-relaxed">
            A flagship is a forcing function: one demanding artifact that must drive the entire kernel from
            geometry through physics, optimization, and rendering, and come back carrying a certified
            artifact you can defend rather than a bare number. All three now ship as certified campaigns
            that run the whole pipeline end to end.
          </p>

          {/* Quick index */}
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {flagships.map((f) => {
              const Icon = FLAGSHIP_EXTRA[f.id].Icon;
              return (
                <a
                  key={f.id}
                  href={`#${f.id}`}
                  className="card card-hover group flex flex-col gap-3 rounded-2xl p-5"
                  style={{ borderColor: `${f.color}22` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${f.color}18`, color: f.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <StatusChip status={f.status} />
                  </div>
                  <div className="min-w-0">
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
          THE THREE FLAGSHIPS
          ================================================================ */}
      {flagships.map((f, i) => (
        <FlagshipSection key={f.id} f={f} index={i} />
      ))}

      {/* ================================================================
          THE MARQUEE — topology optimization on a raw SDF (P2)
          ================================================================ */}
      <section
        id="marquee"
        className="scroll-mt-24 relative overflow-hidden border-t border-white/5 py-20 md:py-28"
      >
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute top-1/4 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-cyan-500/[0.09] blur-[140px]" />
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-3">
              <div className="h-px w-8 bg-cyan-500/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/80">
                The Marquee {marquee ? `· ${marquee.id}` : ""}
              </span>
              <div className="h-px w-8 bg-cyan-500/40" />
            </div>
            <GlitchText trigger="hover" intensity="medium">
              <h2 className="text-3xl font-black leading-[1.05] tracking-tight text-white md:text-5xl">
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

          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <SyncContainer withPulse accentColor="#06b6d4" className="w-full max-w-full bg-black/40 p-2 shadow-2xl md:p-4">
                <TopoptSdfViz />
              </SyncContainer>
              <p className="px-1 text-sm leading-relaxed text-slate-500">
                The optimizer reshapes the boundary every iteration; compliance falls as the density field
                condenses into load-bearing structure.
              </p>
            </div>
            <div className="min-w-0 space-y-3">
              <SyncContainer withPulse accentColor="#22d3ee" className="w-full max-w-full bg-black/40 p-2 shadow-2xl md:p-4">
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
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/80">
                      Scope
                    </div>
                    <p className="text-sm leading-relaxed text-slate-400">{marquee.scope}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/80">
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
              className="btn-secondary group inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-white/5 px-6 py-3 text-sm font-bold text-slate-200 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white"
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
              className="btn-secondary group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-white/10 hover:text-white"
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
