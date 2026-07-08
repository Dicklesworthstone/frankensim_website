import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Boxes, GitBranch, ShieldCheck } from "lucide-react";
import SectionShell from "@/components/section-shell";
import GlitchText from "@/components/glitch-text";
import { SyncContainer } from "@/components/sync-elements";
import { layers, crates, crossCuttingCrates } from "@/lib/content";

export const metadata: Metadata = {
  title: "The Kernel — FrankenSim",
  description:
    "The FrankenSim kernel: a hundred-plus pure-Rust crates in one acyclic workspace across seven layers, L0 Substrate → L6 Helm. The complete crate atlas, every crate with its layer and responsibility, plus the repository policy that xtask enforces as code.",
  openGraph: {
    title: "The Kernel — FrankenSim",
    description:
      "A hundred-plus crates, one acyclic Rust workspace. The FrankenSim crate atlas across seven layers.",
  },
};

// Group the full crate inventory by layer (L6 → L0), then cross-cutting.
const layerGroups = layers.map((layer) => ({
  ...layer,
  members: crates.filter((crate) => crate.layer === layer.id),
}));

const crossCutting = crates.filter((crate) => crate.layer === "UTIL");

const CROSS_CUTTING_COLOR = "#22d3ee";

const kernelStats = [
  { value: "104", label: "Rust crates" },
  { value: "7", label: "acyclic layers" },
  { value: "~160K", label: "lines of Rust" },
  { value: "1,300+", label: "inline tests" },
  { value: "52", label: "CONTRACT.md contracts" },
  { value: "0", label: "non-Franken runtime deps" },
];

export default function KernelPage() {
  return (
    <main id="main-content">
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-[520px] h-[520px] bg-cyan-500/10 rounded-full blur-[130px]" />
          <div className="absolute top-24 right-1/4 w-[360px] h-[360px] bg-violet-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              The Workspace
            </span>
            <div className="h-px w-8 bg-cyan-500/40" />
          </div>

          <GlitchText trigger="hover" intensity="medium">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6">
              A hundred-plus crates,{" "}
              <span className="text-cyan-400">one workspace</span>.
            </h1>
          </GlitchText>

          <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            One acyclic Rust workspace, roughly 160K lines, depending on the
            Franken constellation and nothing else. Every layer points strictly
            downward, and <span className="text-white">unsafe</span> is confined
            to audited leaf capsules under 300 lines, each sealed behind a safe
            façade and registered with the policy checker.
          </p>
        </div>

        {/* Stat strip */}
        <div className="relative z-10 mx-auto max-w-5xl px-6 mt-14">
          <SyncContainer withNodes={false} className="glass-modern p-2">
            <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y divide-white/5 md:divide-y-0 md:divide-x md:divide-white/5">
              {kernelStats.map((stat) => (
                <div key={stat.label} className="flex flex-col items-center px-4 py-5 text-center">
                  <dt className="order-2 mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    {stat.label}
                  </dt>
                  <dd className="order-1 font-mono text-2xl md:text-3xl font-black text-cyan-400">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </SyncContainer>
        </div>
      </section>

      {/* ================================================================
          THE CRATE ATLAS
          ================================================================ */}
      <section
        data-section
        id="crate-atlas"
        aria-labelledby="crate-atlas-heading"
        className="relative mx-auto max-w-7xl px-6 py-16 md:py-24 lg:py-32"
      >
        <div className="max-w-3xl mb-14 md:mb-20">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              The Crate Atlas
            </span>
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div
              data-magnetic="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-cyan-400"
            >
              <Boxes className="h-5 w-5" />
            </div>
            <GlitchText trigger="hover" intensity="low">
              <h2
                id="crate-atlas-heading"
                className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight"
              >
                Every crate, by <span className="text-cyan-400">layer</span>.
              </h2>
            </GlitchText>
          </div>
          <p className="text-lg text-slate-400 font-medium leading-relaxed">
            The complete inventory, grouped by the seven strictly-acyclic layers.
            A layer may depend only on the layers beneath it: L6 Helm sees
            everything, L0 Substrate sees nothing but the machine. Each group is
            color-coded by its layer along the spectrum.
          </p>
        </div>

        <div className="space-y-16 md:space-y-20">
          {layerGroups.map((group) => (
            <div key={group.id} className="scroll-mt-24" id={group.id.toLowerCase()}>
              {/* Layer header */}
              <div className="flex flex-wrap items-center gap-4 border-b border-white/5 pb-5 mb-8">
                <div
                  className="flex h-11 items-center gap-3 rounded-xl border px-4 font-mono font-black"
                  style={{
                    backgroundColor: `${group.color}12`,
                    borderColor: `${group.color}40`,
                    color: group.color,
                  }}
                >
                  <span className="text-sm">{group.id}</span>
                  <span className="text-[11px] tracking-[0.3em]">{group.code}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white leading-tight">{group.name}</h3>
                  <p className="text-sm text-slate-400">{group.tagline}</p>
                </div>
                <span className="ml-auto text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
                  {group.members.length} {group.members.length === 1 ? "crate" : "crates"}
                </span>
              </div>

              {/* Crate cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.members.map((crate) => (
                  <div
                    key={crate.name}
                    className="card kinetic-card group/crate rounded-2xl p-5"
                    style={{ borderLeft: `2px solid ${group.color}40` }}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <code className="font-mono text-sm font-black" style={{ color: group.color }}>
                        {crate.name}
                      </code>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{crate.blurb}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Cross-cutting group */}
          <div className="scroll-mt-24" id="cross-cutting">
            <div className="flex flex-wrap items-center gap-4 border-b border-white/5 pb-5 mb-8">
              <div
                className="flex h-11 items-center gap-3 rounded-xl border px-4 font-mono font-black"
                style={{
                  backgroundColor: `${CROSS_CUTTING_COLOR}12`,
                  borderColor: `${CROSS_CUTTING_COLOR}40`,
                  color: CROSS_CUTTING_COLOR,
                }}
              >
                <span className="text-sm">∀</span>
                <span className="text-[11px] tracking-[0.3em]">CROSS-CUTTING</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white leading-tight">Owned by no single layer</h3>
                <p className="text-sm text-slate-400">Quantities, evidence, macros, governance &amp; benchmarks</p>
              </div>
              <span className="ml-auto text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
                {crossCutting.length} crates
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {crossCutting.map((crate) => (
                <div
                  key={crate.name}
                  className="card kinetic-card rounded-2xl p-5"
                  style={{ borderLeft: `2px solid ${CROSS_CUTTING_COLOR}40` }}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CROSS_CUTTING_COLOR }}
                    />
                    <code className="font-mono text-sm font-black" style={{ color: CROSS_CUTTING_COLOR }}>
                      {crate.name}
                    </code>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{crate.blurb}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03] p-6 md:p-8">
              <p className="text-slate-300 leading-relaxed">
                <code className="font-mono text-cyan-400">fs-qty</code>,{" "}
                <code className="font-mono text-cyan-400">fs-obs</code>, and{" "}
                <code className="font-mono text-cyan-400">fs-evidence</code> are the
                load-bearing three of this cross-cutting set: threaded through{" "}
                <span className="text-white">all seven</span> layers rather than owned
                by any single one. Dimensional quantities are compile-time typed
                everywhere, every operation emits into one shared observability spine,
                and <span className="text-white">Evidence&lt;T&gt;</span>, a value plus
                its four uncertainty slices, is the currency that crosses every layer
                boundary. The rest of the set carries the same discipline sideways: the
                derive macros, the governance and benchmark corpus, the regulatory
                crosswalk. That is what keeps units, provenance, and error bounds from
                being re-invented six incompatible times.
              </p>
              <p className="mt-4 text-[13px] font-mono text-slate-500">
                {crossCuttingCrates.join(" · ")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          REPOSITORY POLICY IS CODE
          ================================================================ */}
      <SectionShell
        id="policy"
        icon="shield"
        eyebrow="Enforcement"
        title="Repository policy is code."
        kicker="The workspace's invariants are checked mechanically on every build, not left to a style guide anyone can forget."
      >
        <div className="space-y-6">
          <p className="text-slate-400 leading-relaxed">
            A dedicated <code className="font-mono text-cyan-400">xtask</code> binary
            is the workspace&apos;s conscience. It refuses to let the constellation
            drift: the acyclic layer direction, the dependency allow-list, the
            presence of conformance contracts, and the registration of every
            unsafe capsule are all facts it can prove or fail on before a merge,
            not after an incident.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: GitBranch,
                title: "Acyclic layer direction",
                desc: "The L0 → L6 dependency graph is walked and asserted acyclic. A crate that reaches sideways or upward (L2 pulling on L4) is a build failure, not a code-review note.",
                color: "#3b82f6",
              },
              {
                icon: ShieldCheck,
                title: "Franken-only dependencies",
                desc: "Every runtime dependency is checked against the Franken constellation allow-list. A stray crates.io import never makes it past the gate.",
                color: "#a855f7",
              },
              {
                icon: Boxes,
                title: "Contract presence",
                desc: "Each crate that owes a conformance contract must ship its CONTRACT.md, 52 in all. A missing or stale contract fails the run.",
                color: "#10b981",
              },
              {
                icon: ShieldCheck,
                title: "Unsafe-capsule registration",
                desc: "Every unsafe block lives in a registered leaf capsule under 300 lines behind a safe façade. Unregistered unsafe is rejected at the door.",
                color: "#f97316",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="card card-hover rounded-2xl p-6"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
                  style={{ backgroundColor: `${item.color}15`, color: item.color }}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-500 leading-relaxed">
            The same discipline the Gauntlet applies to numerics, <code className="font-mono text-slate-400">xtask</code>{" "}
            applies to structure: the shape of the workspace is a checkable
            proposition, so the hundred-plus crates stay one continuum instead of
            drifting into a hundred-plus projects.
          </p>
        </div>
      </SectionShell>

      {/* CTA */}
      <div className="mx-auto max-w-7xl px-6 pb-24 flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/architecture"
          className="btn-secondary group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-300 hover:border-cyan-500/30 hover:text-white transition-all"
        >
          See the layers in motion
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/roadmap"
          className="group inline-flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-3 text-sm font-bold text-black hover:bg-cyan-400 transition-all active:scale-95"
        >
          Follow the roadmap
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </main>
  );
}
