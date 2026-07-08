import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, CircleCheck, CircleDot, Circle, GitBranch, Layers, FlaskConical, Boxes,
} from "lucide-react";
import SectionShell from "@/components/section-shell";
import { SyncContainer } from "@/components/sync-elements";
import GlitchText from "@/components/glitch-text";
import GauntletViz from "@/components/viz/gauntlet-viz";
import { phases, epics, beadsStats } from "@/lib/content";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "FrankenSim's Gauntlet-gated roadmap (PV → P6) and its 244-issue project graph: 17 workstreams across the seven-layer kernel, four programs, and six research bets.",
};

const STATUS = {
  done: { color: "#10b981", label: "Proven", Icon: CircleCheck },
  active: { color: "#f59e0b", label: "In flight", Icon: CircleDot },
  planned: { color: "#64748b", label: "Planned", Icon: Circle },
} as const;

const GROUP_META: Record<string, { icon: React.ElementType; blurb: string }> = {
  "Kernel Stack": { icon: Layers, blurb: "The seven acyclic layers, L0 → L6." },
  "Programs": { icon: Boxes, blurb: "Cross-cutting efforts that touch every layer." },
  "Research Bets": { icon: FlaskConical, blurb: "The addendum's ambitious, individually-gated wagers." },
};

export default function RoadmapPage() {
  const groups = ["Kernel Stack", "Programs", "Research Bets"];

  return (
    <main id="main-content" className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden pt-36 pb-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-10%] right-[-5%] h-[40%] w-[40%] rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-5%] h-[40%] w-[45%] rounded-full bg-violet-600/10 blur-[110px]" />
        </div>
        <div className="mx-auto max-w-7xl px-6">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">The Roadmap</span>
          </div>
          <GlitchText trigger="hover" intensity="medium">
            <h1 className="text-[clamp(2.75rem,7vw,5rem)] font-black leading-[0.95] tracking-tight text-white">
              Gauntlet-gated <br className="hidden md:block" /> to <span className="text-gradient-sync">P6</span>.
            </h1>
          </GlitchText>
          <p className="mt-8 max-w-2xl text-lg md:text-xl font-medium leading-relaxed text-slate-400">
            The plan runs in phases, PV → P6. Each gate is a Gauntlet state, not a date;
            nothing Moonshot is allowed to gate anything Solid. The vertical skeleton, Bedrock,
            and Geometry are proven; the first optimization is landing now.
          </p>
        </div>
      </section>

      {/* PHASE TIMELINE */}
      <SectionShell
        id="phases"
        icon="clock"
        eyebrow="The Phase Ladder"
        title="Eight Gates"
        kicker="Each phase exits only when its Gauntlet tier goes green. Illustrative windows are shown; the gate is the state, not the week."
      >
        <ol className="relative space-y-4 border-l border-white/10 pl-6">
          {phases.map((p) => {
            const s = STATUS[p.status];
            const S = s.Icon;
            return (
              <li key={p.id} className="relative">
                <span
                  className="absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: "#04090d", border: `1px solid ${s.color}66` }}
                >
                  <S className="h-4 w-4" style={{ color: s.color }} />
                </span>
                <div
                  className="kinetic-card rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6"
                  style={p.status === "active" ? { borderColor: `${s.color}44`, boxShadow: `0 0 30px -12px ${s.color}` } : undefined}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-lg font-black" style={{ color: s.color }}>{p.id}</span>
                    <h3 className="text-lg font-black text-white">{p.name}</h3>
                    <span className="ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em]"
                      style={{ color: s.color, background: `${s.color}14`, border: `1px solid ${s.color}33` }}>
                      {s.label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600">{p.window}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400"><span className="text-slate-500">Scope: </span>{p.scope}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-cyan-300/80"><span className="text-slate-500">Exit: </span>{p.exit}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </SectionShell>

      {/* PROJECT GRAPH — beads */}
      <SectionShell
        id="graph"
        icon="gitCompare"
        eyebrow="The Project Graph"
        title="244 Issues, One DAG"
        kicker="The build is tracked as a dependency graph of beads. Roughly a third is already closed; the foundations are done, and the flywheel research bets are the frontier."
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {[
            { v: beadsStats.total, l: "Total issues" },
            { v: beadsStats.features, l: "Features" },
            { v: `${beadsStats.closedPct}%`, l: `Closed (${beadsStats.closed})` },
            { v: beadsStats.inProgress, l: "In progress" },
            { v: beadsStats.epics, l: "Epics / workstreams" },
            { v: beadsStats.milestones, l: "Milestones (PV → P6)" },
          ].map((s) => (
            <div key={s.l} className="glass-modern rounded-2xl p-5 text-left">
              <div className="text-3xl md:text-4xl font-black tracking-tighter text-cyan-400 tabular-nums">{s.v}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{s.l}</div>
            </div>
          ))}
        </div>

        {/* status bar */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <span>Status</span>
            <span>{beadsStats.total} beads</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/5">
            <div style={{ width: `${(beadsStats.closed / beadsStats.total) * 100}%`, background: "#10b981" }} title={`${beadsStats.closed} closed`} />
            <div style={{ width: `${(beadsStats.inProgress / beadsStats.total) * 100}%`, background: "#f59e0b" }} title={`${beadsStats.inProgress} in progress`} />
            <div style={{ width: `${(beadsStats.open / beadsStats.total) * 100}%`, background: "#1e2a33" }} title={`${beadsStats.open} open`} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#10b981" }} /> {beadsStats.closed} closed</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} /> {beadsStats.inProgress} in progress</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#1e2a33" }} /> {beadsStats.open} open</span>
            <span className="ml-auto flex items-center gap-3">
              <span>ambition: <span className="text-cyan-300">[S] {beadsStats.ambition.S}</span></span>
              <span className="text-lime-300">[F] {beadsStats.ambition.F}</span>
              <span className="text-amber-300">[M] {beadsStats.ambition.M}</span>
            </span>
          </div>
        </div>
      </SectionShell>

      {/* 17 WORKSTREAMS */}
      <SectionShell
        id="workstreams"
        icon="network"
        eyebrow="The Workstreams"
        title="Seventeen Epics"
        kicker="Every issue rolls up into one of seventeen epics: the seven-layer kernel, four cross-cutting programs, and six addendum research bets."
      >
        <div className="space-y-10">
          {groups.map((g) => {
            const meta = GROUP_META[g];
            const GIcon = meta.icon;
            const items = epics.filter((e) => e.group === g);
            return (
              <div key={g}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400">
                    <GIcon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">{g}</h3>
                  <span className="text-[11px] text-slate-600">{meta.blurb}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((e) => (
                    <div
                      key={e.title}
                      className="kinetic-card rounded-xl border p-4"
                      style={{ borderColor: `${e.color}2e`, background: `${e.color}0d` }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color, boxShadow: `0 0 8px ${e.color}` }} />
                        <span className="font-mono text-sm font-black" style={{ color: e.color }}>{e.title}</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{e.blurb}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SectionShell>

      {/* HOW WE VERIFY */}
      <SectionShell
        id="gauntlet"
        icon="shield"
        eyebrow="How We Verify"
        title="Run the Gauntlet"
        kicker="A phase gate is a Gauntlet state, not a date. Property laws, manufactured-solution order verification, benchmarks, metamorphic tests, chaos storms, and determinism audits, in that order."
      >
        <SyncContainer withPulse accentColor="#a3e635" className="p-2 md:p-4 bg-black/40 shadow-2xl">
          <GauntletViz />
        </SyncContainer>
      </SectionShell>

      {/* CTA */}
      <section className="relative py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <GlitchText trigger="hover" intensity="medium">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white">Read the kernel.</h2>
          </GlitchText>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-400 font-medium">
            The plan is enormous, but the spine is built. Browse all 100+ crates, or trace a request through the seven layers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/kernel" className="glow-cyan inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-black text-black transition-all hover:bg-cyan-400">
              <Boxes className="h-4 w-4" /> The Kernel
            </Link>
            <Link href="/architecture" className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-white/5 px-6 py-3 text-sm font-black text-white transition-all hover:bg-cyan-500/10">
              <GitBranch className="h-4 w-4 text-cyan-400" /> Architecture
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="/beads" className="inline-flex items-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/5 px-6 py-3 text-sm font-black text-white transition-all hover:bg-violet-500/10">
              <GitBranch className="h-4 w-4 text-violet-400" /> The Project Graph
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
