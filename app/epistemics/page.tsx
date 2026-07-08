import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowRight, ShieldCheck, FlaskConical, Sparkles, Fingerprint, Sigma,
  GitMerge, FileWarning, Waypoints, Ban, Ruler, Dices, Gauge, GitCommit, Key,
} from "lucide-react";

import SectionShell from "@/components/section-shell";
import GlitchText from "@/components/glitch-text";
import { SyncContainer } from "@/components/sync-elements";
import RustCodeBlock from "@/components/rust-code-block";
import ComparisonTable from "@/components/comparison-table";
import EpistemicColorsViz from "@/components/viz/epistemic-colors-viz";
import EvidenceValueViz from "@/components/viz/evidence-value-viz";
import CertifiedSpeculationViz from "@/components/viz/certified-speculation-viz";
import GauntletViz from "@/components/viz/gauntlet-viz";
import SheafWatertightnessViz from "@/components/viz/sheaf-watertightness-viz";
import EpistemicEngineViz from "@/components/viz/epistemic-engine-viz";
import GluingH0Viz from "@/components/viz/gluing-h0-viz";
import ObstructionH1Viz from "@/components/viz/obstruction-h1-viz";
import ConfidenceSequenceViz from "@/components/viz/confidence-sequence-viz";
import { principles, fiveExplicits, codeExampleEvidence, codeExampleError } from "@/lib/content";

export const metadata: Metadata = {
  title: "Epistemics",
  description:
    "FrankenSim is an epistemic engine for physical claims: it returns evidence, not bare numbers. The three colors, Evidence<T>, certified speculation, the Gauntlet, watertightness by cohomology, and refusals that teach, all toward justified belief at minimum cost.",
};

// The three epistemic colors — used consistently, prominently, throughout.
const VERIFIED = "#22d3ee"; // cyan
const VALIDATED = "#a3e635"; // lime
const ESTIMATED = "#fbbf24"; // amber

const COLOR_CARDS = [
  {
    color: VERIFIED,
    name: "verified",
    glyph: "▮",
    headline: "Proven, not promised.",
    body: "Bounds established by interval-certified numerics: outward-rounded intervals, exact geometric predicates, equilibrated-flux accept tests. The interval is guaranteed to contain the truth. This is the badge you can bet a bridge on.",
    origin: "fs-ivl · Newton–Krawczyk · Prager–Synge",
  },
  {
    color: VALIDATED,
    name: "validated",
    glyph: "▮",
    headline: "Reality signed off.",
    body: "Anchored to experimental data inside a stated regime: a Buckingham-π envelope where the measurement was actually taken. Trusted because it matched the world, but only where the world was asked.",
    origin: "fs-regime · benchmark anchors · fidelity ladder",
  },
  {
    color: ESTIMATED,
    name: "estimated",
    glyph: "▮",
    headline: "Useful, unproven.",
    body: "Best-effort: a surrogate, a coarse solve, an ML proposal. Frequently excellent, but it has shown no proof and matched no experiment. It must wear amber until something certifies or validates it.",
    origin: "surrogates · coarse solves · proposers",
  },
];

const COMPOSITION_RULES = [
  { a: VERIFIED, b: VERIFIED, out: VERIFIED, label: "verified ∘ verified", res: "verified" },
  { a: VERIFIED, b: VALIDATED, out: VALIDATED, label: "verified ∘ validated", res: "validated" },
  { a: VERIFIED, b: ESTIMATED, out: ESTIMATED, label: "verified ∘ estimated", res: "estimated" },
  { a: VALIDATED, b: ESTIMATED, out: ESTIMATED, label: "validated ∘ estimated", res: "estimated" },
];

const EVIDENCE_SLICES = [
  { name: "Numerical", color: VERIFIED, desc: "Discretization, rounding, and truncation error: the gap between the equation you solved and the one you meant. Bounded by interval and a-posteriori estimators." },
  { name: "Statistical", color: VALIDATED, desc: "Monte-Carlo and sampling variance carried as an anytime-valid confidence sequence, so peeking never inflates the claim." },
  { name: "Model-form", color: ESTIMATED, desc: "The uncertainty of the model itself: the physics you left out. The honest, humbling slice most tools pretend does not exist." },
  { name: "Sensitivity", color: "#a855f7", desc: "How the answer moves as inputs move, supplied for free by the adjoint hook riding inside the value." },
];

const GAUNTLET_TIERS = [
  { id: "G0", color: VERIFIED, name: "Property & algebraic laws", desc: "Adjointness, symmetry, conservation, d∘d = 0: the invariants a correct kernel can never violate." },
  { id: "G1", color: VERIFIED, name: "Manufactured solutions & order", desc: "The build fails if the observed convergence slope drifts more than 0.2 from the theoretical order. Silent accuracy loss is a red build.", flagship: true },
  { id: "G2", color: VALIDATED, name: "Canonical benchmarks", desc: "Lid-driven cavity, Taylor–Green, NAFEMS: the problems the field already agreed on the answers to." },
  { id: "G3", color: VALIDATED, name: "Metamorphic tests", desc: "Relations that must hold even when the exact answer is unknown: refine, rotate, rescale, and check the invariant." },
  { id: "G4", color: ESTIMATED, name: "Chaos & cancellation storms", desc: "Inject cancellation mid-solve, starve budgets, race speculators. Correctness must survive the storm; resources must never leak." },
  { id: "G5", color: ESTIMATED, name: "Determinism & cross-ISA", desc: "Bit-identical across runs, thread counts, and instruction sets. Any divergence is a diff, not a shrug." },
];

const explicitIcons: Record<string, LucideIcon> = {
  ruler: Ruler, dices: Dices, gauge: Gauge, gitCommit: GitCommit, key: Key,
};

export default function EpistemicsPage() {
  return (
    <main id="main-content">
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[560px] h-[560px] bg-cyan-500/10 rounded-full blur-[130px]" />
          <div className="absolute top-40 left-1/4 w-[320px] h-[320px] bg-lime-400/5 rounded-full blur-[110px]" />
          <div className="absolute top-40 right-1/4 w-[320px] h-[320px] bg-amber-400/5 rounded-full blur-[110px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              The Epistemic Engine
            </span>
            <div className="h-px w-8 bg-cyan-500/40" />
          </div>

          <GlitchText trigger="hover" intensity="medium">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-[0.95]">
              Answers that carry their own{" "}
              <span className="text-cyan-400">proof</span>.
            </h1>
          </GlitchText>

          <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            Every incumbent sells compute that emits numbers. FrankenSim sells the
            thing the numbers were always a proxy for: <span className="text-slate-200 font-semibold">justified
            belief at minimum cost</span>. A result is a claim that arrives with its
            warrant attached, not a bare float.
          </p>

          {/* The three colors, established immediately as the visual spine */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {[
              { c: VERIFIED, t: "verified" },
              { c: VALIDATED, t: "validated" },
              { c: ESTIMATED, t: "estimated" },
            ].map((chip) => (
              <span
                key={chip.t}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest"
                style={{ borderColor: `${chip.c}40`, color: chip.c, backgroundColor: `${chip.c}12` }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.c }} />
                {chip.t}
              </span>
            ))}
          </div>

          {/* The load-bearing thesis */}
          <blockquote className="mt-14 mx-auto max-w-2xl border-l-2 border-cyan-500/40 pl-6 text-left">
            <p className="text-lg md:text-xl font-semibold text-white leading-snug">
              &ldquo;A false certificate is worse than an ordinary wrong answer: a
              wrong answer wearing a badge.&rdquo;
            </p>
            <p className="mt-3 text-sm text-slate-500">
              The entire type system exists to make that sentence impossible to
              violate by accident.
            </p>
          </blockquote>
        </div>
      </section>

      {/* ================================================================
          THE ENGINE, END TO END
          ================================================================ */}
      <SectionShell
        id="engine"
        icon="activity"
        eyebrow="The Whole Machine"
        title="How a Claim Is Made"
        kicker="Before the parts, the whole. A physical question enters on the left and a certified claim leaves on the right. Cheap proposers guess, one certified test decides, the survivor accretes its evidence, claims compose, and local certificates glue into a global one. Watch a single claim run from question to proof."
      >
        <div className="space-y-8">
          <SyncContainer withPulse={true} accentColor={VERIFIED} className="p-1 md:p-2 bg-black/40">
            <EpistemicEngineViz />
          </SyncContainer>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 md:p-8">
            <p className="text-lg md:text-xl font-black text-white leading-snug mb-4">
              The expensive step runs <span className="text-cyan-400">once</span>, on the one candidate that earned it.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Most proposals are screened for pennies and discarded. Only a candidate that passes the certified
              accept test pays for the confirmation solve, so the engine spends its budget where belief is
              actually being bought. Every stage downstream inherits the color it earned upstream: an estimate
              that was never certified cannot leave the machine wearing a badge.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          THE THREE COLORS
          ================================================================ */}
      <SectionShell
        id="three-colors"
        icon="layers"
        eyebrow="The Type System"
        title="Three Colors of Truth"
        kicker="Every quantity FrankenSim produces is stained one of three colors. The color is part of the type, not a comment. It is checked at every composition and impossible to upgrade by wishful thinking."
      >
        <div className="space-y-8">
          <SyncContainer withPulse={true} accentColor={VERIFIED} className="p-1 md:p-2 bg-black/40">
            <EpistemicColorsViz />
          </SyncContainer>

          {/* Three color-coded cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {COLOR_CARDS.map((card) => (
              <div
                key={card.name}
                className="relative rounded-2xl border bg-white/[0.02] p-6 overflow-hidden"
                style={{ borderColor: `${card.color}33` }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: card.color }}
                />
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: card.color }}
                  />
                  <span
                    className="font-mono text-sm font-black uppercase tracking-widest"
                    style={{ color: card.color }}
                  >
                    {card.name}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mb-2">{card.headline}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{card.body}</p>
                <p className="text-[11px] font-mono text-slate-600 uppercase tracking-wider">
                  {card.origin}
                </p>
              </div>
            ))}
          </div>

          {/* The composition rule — weakest wins */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 md:p-8">
            <h3 className="text-base font-black text-white mb-2">
              The composition rule: <span className="text-cyan-400">the weakest link wins</span>.
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Color composes like a lattice meet. Feed an estimate into a proof and you
              get an estimate, never the reverse. There is no operator anywhere in the
              100+ crates that returns a color stronger than its weakest input. That is how
              FrankenSim makes <span className="text-white font-semibold">laundering an estimate into a
              certificate</span> a type error rather than a temptation.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {COMPOSITION_RULES.map((rule) => (
                <div
                  key={rule.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/30 px-4 py-3 font-mono text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: rule.a }} />
                    <span className="text-slate-600">∘</span>
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: rule.b }} />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-700 shrink-0" />
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: rule.out }} />
                    <span style={{ color: rule.out }}>{rule.res}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-lime-400/20 bg-lime-400/[0.04] px-4 py-3">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" style={{ color: VALIDATED }} />
              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="font-semibold text-lime-300">Auto-demotion.</span> A{" "}
                <span style={{ color: VALIDATED }}>validated</span> value silently reverts to{" "}
                <span style={{ color: ESTIMATED }}>estimated</span> the instant it is evaluated
                outside the regime it was validated in. The badge is bound to its envelope; step
                past the boundary and the badge falls off by itself.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          EVIDENCE INSIDE THE VALUE
          ================================================================ */}
      <SectionShell
        id="evidence"
        icon="shield"
        eyebrow="The Wrapper"
        title="Evidence Inside the Value"
        kicker="The color is the headline; the evidence is the dossier. Every result is an Evidence<T>: a value plus four uncertainty slices, a provenance hash, and an adjoint hook, all composed conservatively. Certified<T> is its refinement, reachable only through proof."
      >
        <div className="space-y-8">
          <SyncContainer withPulse={true} accentColor={VERIFIED} className="p-1 md:p-2 bg-black/40">
            <EvidenceValueViz />
          </SyncContainer>

          <div className="grid gap-4 sm:grid-cols-2">
            {EVIDENCE_SLICES.map((slice) => (
              <div
                key={slice.name}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-sm font-black text-white">{slice.name} uncertainty</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{slice.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-4">
              <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
              <div>
                <div className="text-sm font-bold text-white">Provenance hash</div>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  A content address of exactly how the value was made. explain(artifact) can
                  always reconstruct the derivation; the result knows its own history.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-4">
              <Sigma className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
              <div>
                <div className="text-sm font-bold text-white">Adjoint hook</div>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  A gradient rides inside the value, computed through the implicit function
                  theorem, so sensitivity is a property of the answer, not a second pipeline.
                </p>
              </div>
            </div>
          </div>

          <SyncContainer withPulse={true} accentColor={VERIFIED} className="p-1 md:p-2 bg-black/40">
            <RustCodeBlock code={codeExampleEvidence} title="evidence.rs" />
          </SyncContainer>
        </div>
      </SectionShell>

      {/* ================================================================
          CERTIFIED SPECULATION
          ================================================================ */}
      <SectionShell
        id="certified-speculation"
        icon="zap"
        eyebrow="The Flywheel"
        title="Certified Speculation"
        kicker="How do you get the speed of a guess and the trust of a proof? You let anything propose, and let only mathematics accept."
      >
        <div className="space-y-8">
          <SyncContainer withPulse={true} accentColor={VALIDATED} className="p-1 md:p-2 bg-black/40">
            <CertifiedSpeculationViz />
          </SyncContainer>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 md:p-8">
            <p className="text-lg md:text-xl font-black text-white leading-snug mb-4">
              Machine learning proposes; <span className="text-lime-300">certified numerics disposes</span>.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              A surrogate, a coarse solver, or an untrusted ML model produces a candidate in
              microseconds. It arrives <span style={{ color: ESTIMATED }}>estimated</span> and unloved.
              Then a cheap, independent verifier (an equilibrated-flux <span className="text-white font-semibold">Prager–Synge</span>{" "}
              a-posteriori accept test) checks whether the candidate actually satisfies the
              governing equations to tolerance. If it passes, it is stamped{" "}
              <span style={{ color: VERIFIED }}>verified</span>. If it does not, it is rejected.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-4" style={{ borderColor: `${ESTIMATED}33` }}>
                <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: ESTIMATED }}>Propose</div>
                <p className="text-xs text-slate-500 leading-relaxed">Untrusted, fast, plural: ML, surrogates, coarse solves. Race them all.</p>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: `${VERIFIED}33` }}>
                <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: VERIFIED }}>Verify</div>
                <p className="text-xs text-slate-500 leading-relaxed">One cheap certified test decides. The verifier is the only thing that must be right.</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest mb-1 text-slate-300">
                  <Ban className="h-3.5 w-3.5" /> Fail closed
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">No accept, no answer. A rejected speculation never leaks out wearing a badge.</p>
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          ANYTIME-VALID STATISTICS
          ================================================================ */}
      <SectionShell
        id="anytime-valid"
        icon="lineChart"
        eyebrow="Peek-Safe Statistics"
        title="Stop the Instant It's Decisive"
        kicker="The statistical slice of every Evidence<T> is an anytime-valid confidence sequence, not a one-shot interval. You may look after every sample and stop the moment the band clears the threshold, and the coverage guarantee still holds. That is what lets the e-process racer cancel its losers mid-solve without ever p-hacking the result."
      >
        <div className="space-y-8">
          <SyncContainer withPulse={true} accentColor={VERIFIED} className="p-1 md:p-2 bg-black/40">
            <ConfidenceSequenceViz />
          </SyncContainer>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sigma className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-black text-white">Valid at every n, not one</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                A classical confidence interval is only honest at the single sample size you committed to in
                advance. Peek repeatedly and stop when it looks good, and its true error rate balloons. A
                confidence sequence is a band valid simultaneously at all sample sizes, so continuous monitoring
                is free. The estimate can be watched, not just reported.
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="h-4 w-4 text-lime-300" />
                <h3 className="text-sm font-black text-white">Racing without regret</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Candidate designs each accumulate an e-value, a betting martingale. Because e-processes are
                anytime-valid, a leader can be declared and the losers cancelled the instant the evidence is
                decisive, saving core-hours at identical statistical guarantees. Optional stopping stops being a
                sin and becomes the whole point.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          THE GAUNTLET
          ================================================================ */}
      <SectionShell
        id="gauntlet"
        icon="bug"
        eyebrow="Correctness Program"
        title="The Gauntlet"
        kicker="Certificates are only as good as the thing that issues them. The Gauntlet is six graded tiers that every merge must survive, and the discipline of certifying the certifiers so the judge is never above the law."
      >
        <div className="space-y-8">
          <SyncContainer withPulse={true} accentColor={VERIFIED} className="p-1 md:p-2 bg-black/40">
            <GauntletViz />
          </SyncContainer>

          <div className="grid gap-3 sm:grid-cols-2">
            {GAUNTLET_TIERS.map((tier) => (
              <div
                key={tier.id}
                className="flex items-start gap-4 rounded-2xl border bg-white/[0.02] p-5"
                style={{ borderColor: tier.flagship ? `${tier.color}44` : "rgba(255,255,255,0.05)" }}
              >
                <span
                  className="mt-0.5 shrink-0 font-mono text-lg font-black"
                  style={{ color: tier.color }}
                >
                  {tier.id}
                </span>
                <div>
                  <div className="text-sm font-black text-white flex items-center gap-2">
                    {tier.name}
                    {tier.flagship && (
                      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-cyan-400">
                        Fails the build
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">{tier.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] px-5 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
            <p className="text-sm text-slate-400 leading-relaxed">
              <span className="font-semibold text-violet-300">Certifying the certifiers.</span> Every
              verifier and error estimator is itself tested against manufactured solutions with known
              bounds; a certificate is trusted only after the thing issuing it has passed its own
              Gauntlet. The Goodhart guard treats each optimizer endpoint as an adversarial example and
              re-checks it out of band, because a measure that becomes a target stops being a good measure.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          WATERTIGHT BY COHOMOLOGY
          ================================================================ */}
      <SectionShell
        id="watertight"
        icon="gitMerge"
        eyebrow="The Sheaf View"
        title="Local Truth, Glued"
        kicker="A global certified claim is stitched from local ones. The language for when local pieces agree, when they glue into a whole, and when they cannot, is sheaf cohomology. H⁰ is the global consensus that survives; H¹ is the obstruction that names exactly why a seam leaks. Watertightness stops being something you eyeball and becomes an algebraic fact you can check."
      >
        <div className="space-y-14">
          {/* H0 — gluing */}
          <div className="space-y-5">
            <div>
              <span className="font-mono text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                H⁰ · the global section
              </span>
              <h3 className="mt-2 text-xl md:text-2xl font-black text-white">
                Local claims glue when they agree on every overlap
              </h3>
              <p className="mt-2 max-w-3xl text-sm text-slate-400 leading-relaxed">
                Cover a region with overlapping charts, each carrying its own local certified value. Together
                they form a presheaf. They glue into a single global section, an element of H⁰, exactly when
                every pair agrees on the overlap they share. Nudge one chart out of agreement and the global
                section ceases to exist: the seam leaks. The color of the whole is the meet of the parts, so a
                global certificate is only ever as strong as its weakest chart.
              </p>
            </div>
            <SyncContainer withPulse={true} accentColor={VERIFIED} className="p-1 md:p-2 bg-black/40">
              <GluingH0Viz />
            </SyncContainer>
          </div>

          {/* H1 — obstruction */}
          <div className="space-y-5">
            <div>
              <span className="font-mono text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                H¹ · the obstruction
              </span>
              <h3 className="mt-2 text-xl md:text-2xl font-black text-white">
                When pairwise agreement still isn&apos;t enough
              </h3>
              <p className="mt-2 max-w-3xl text-sm text-slate-400 leading-relaxed">
                Sometimes every pair of charts is locally consistent and the pieces still refuse to glue.
                Transport a value around a loop of overlapping patches and it can return changed; the leftover
                is a cocycle, a class in H¹. Some obstructions are coboundaries, artifacts of how the patches
                were labelled, which a re-gauge drains to zero: pure bookkeeping, mechanically auto-fixable.
                Others are harmonic, a genuine topological disagreement whose holonomy is invariant no matter
                how you relabel. The math sorts the fixable from the fundamental for you.
              </p>
            </div>
            <SyncContainer withPulse={true} accentColor={ESTIMATED} className="p-1 md:p-2 bg-black/40">
              <ObstructionH1Viz />
            </SyncContainer>
          </div>

          {/* Concrete — watertight surface */}
          <div className="space-y-5">
            <div>
              <span className="font-mono text-xs font-black uppercase tracking-[0.2em] text-lime-300">
                The concrete case
              </span>
              <h3 className="mt-2 text-xl md:text-2xl font-black text-white">
                A surface that seals is a theorem, not a render
              </h3>
              <p className="mt-2 max-w-3xl text-sm text-slate-400 leading-relaxed">
                Take the same machinery to geometry. Model a surface as a cellular sheaf: each patch holds
                local data, each shared edge holds a compatibility constraint. Watertightness is precisely the
                vanishing of the interface cocycle. A seal becomes something you prove, and a leak names its own
                location.
              </p>
            </div>
            <SyncContainer withPulse={true} accentColor={VALIDATED} className="p-1 md:p-2 bg-black/40">
              <SheafWatertightnessViz />
            </SyncContainer>
          </div>

          {/* payoff cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Waypoints className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-black text-white">
                  Watertight <span className="font-mono text-cyan-400">≡ H¹ = 0</span>
                </h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Watertightness is the vanishing of the first cohomology; the interface cocycle is zero. No gaps,
                no double walls, no self-lies. A seal is a theorem you check, not a rendering you squint at.
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-3">
                <GitMerge className="h-4 w-4 text-lime-300" />
                <h3 className="text-sm font-black text-white">Conflicts classify themselves</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                When a merge fails, the cocycle tells you which kind of failure it is. A{" "}
                <span className="text-lime-300">coboundary</span> conflict is a bookkeeping mismatch,
                mechanically auto-fixable. A <span className="text-amber-300">harmonic</span> conflict is
                structural: a topological disagreement no retopo can paper over.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          A REFUSAL THAT TEACHES
          ================================================================ */}
      <SectionShell
        id="refusal"
        icon="fileText"
        eyebrow="Structured Errors"
        title="A Refusal That Teaches"
        kicker="The most epistemically honest thing a system can do is decline, and the most useful thing it can do while declining is explain. When a request is infeasible, FrankenSim returns a structured, ranked set of ways forward instead of a stack trace."
      >
        <div className="space-y-8">
          <SyncContainer withPulse={true} accentColor={ESTIMATED} className="p-1 md:p-2 bg-black/40">
            <RustCodeBlock code={codeExampleError} title="refusal.json" />
          </SyncContainer>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <FileWarning className="h-5 w-5 text-amber-300" />
              <p className="text-lg md:text-xl font-black text-white leading-snug">
                &ldquo;A refusal that teaches is worth ten silent successes.&rdquo;
              </p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              A <span className="font-mono text-amber-300">BudgetInfeasible</span> is a conversation, not a
              dead end. It states exactly what the plan needed, exactly what it was given, and a ranked
              list of concrete fixes, each with an estimated wall-clock cost and its impact on the quantity of
              interest. An agent swarm reads this and re-plans; a human reads it and understands the trade in
              seconds. The system refuses to guess, and refuses to hide why.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          THE DECALOGUE + FIVE EXPLICITS
          ================================================================ */}
      <SectionShell
        id="backbone"
        icon="blocks"
        eyebrow="The Backbone"
        title="Principles the Epistemics Rest On"
        kicker="None of the above is a bolt-on. The three colors, the evidence, and the refusals all fall out of ten non-negotiable principles and five things that are never, ever left implicit."
      >
        <div className="space-y-10">
          {/* The Decalogue */}
          <div>
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-8 bg-cyan-500/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
                The Decalogue
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {principles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-sm font-black text-cyan-500/70">
                    {p.id}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-white">{p.title}</div>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The Five Explicits */}
          <div>
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-8 bg-violet-500/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400/80">
                The Five Explicits
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {fiveExplicits.map((ex) => {
                const Icon = explicitIcons[ex.icon] ?? Key;
                return (
                  <div
                    key={ex.key}
                    className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300 mb-3">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-black text-white mb-1">{ex.key}</div>
                    <p className="text-xs text-slate-500 leading-relaxed">{ex.body}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What no incumbent can retrofit */}
          <div>
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-8 bg-cyan-500/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
                What No Incumbent Can Retrofit
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-3xl">
              You cannot add evidence to a value that was never designed to carry it. Composition, error
              bounds, provenance, and the three colors are load-bearing structure, not a reporting layer.
              That is exactly why they cannot be sprinkled onto a stack of six tools that only speak floats
              to each other.
            </p>
            <ComparisonTable />
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          CLOSING CTA
          ================================================================ */}
      <section className="relative mx-auto max-w-4xl px-6 py-20 md:py-28 text-center">
        <GlitchText trigger="hover" intensity="low">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
            The kernel is where the <span className="text-cyan-400">proofs</span> live.
          </h2>
        </GlitchText>
        <p className="text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
          See how seven acyclic layers turn these epistemics into running Rust, or watch them earn their
          keep in the three flagship pipelines.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/architecture"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 px-6 py-3 text-sm font-bold text-black hover:bg-cyan-400 transition-all active:scale-95"
          >
            Explore the Architecture
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/flagships"
            className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-300 hover:border-cyan-500/30 hover:text-white transition-all"
          >
            <Sparkles className="h-4 w-4" />
            See the Flagships
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
