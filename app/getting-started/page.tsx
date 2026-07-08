import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, ChevronDown, CheckCircle2, Github, Boxes, BookOpen,
  Terminal, GitBranch, Hammer, FlaskConical, Play, ShieldCheck,
} from "lucide-react";

import SectionShell from "@/components/section-shell";
import GlitchText from "@/components/glitch-text";
import { SyncContainer } from "@/components/sync-elements";
import RustCodeBlock from "@/components/rust-code-block";
import { faq, codeExample, codeExampleStudy, fiveExplicits, siteConfig } from "@/lib/content";

export const metadata: Metadata = {
  title: "Get Started",
  description:
    "FrankenSim is a large, working Rust workspace: 93 crates, ~150K lines, 1,300+ tests, though not yet a packaged simulator. No stable public API, no CLI, no crates.io release. Build it from source, run the vertical-skeleton demo, and read the plan.",
};

/* ------------------------------------------------------------------ */
/*  Prerequisites                                                      */
/* ------------------------------------------------------------------ */

const PREREQS: { title: string; detail: string }[] = [
  {
    title: "Rust 2024 edition",
    detail: "The workspace targets the 2024 edition across all 93 crates.",
  },
  {
    title: "A pinned nightly toolchain",
    detail: "rust-toolchain.toml pins the exact nightly, so rustup installs it automatically on first build.",
  },
  {
    title: "git",
    detail: "To clone the repository and stay in sync with the plan.",
  },
];

/* ------------------------------------------------------------------ */
/*  Build steps — description + terminal command                       */
/* ------------------------------------------------------------------ */

const STEPS: {
  n: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  command: string;
}[] = [
  {
    n: "01",
    Icon: GitBranch,
    title: "Clone the continuum",
    body: "One acyclic workspace, seven layers from L0 Substrate to L6 Helm. Everything lives in a single repository.",
    command: "git clone https://github.com/Dicklesworthstone/frankensim",
  },
  {
    n: "02",
    Icon: Terminal,
    title: "Enter the workspace",
    body: "The root Cargo.toml defines the whole constellation; rust-toolchain.toml pins the toolchain the moment you cd in.",
    command: "cd frankensim",
  },
  {
    n: "03",
    Icon: Hammer,
    title: "Build every crate",
    body: "Compiles the full workspace. The first build is the long one; it pulls the pinned nightly and warms the cache.",
    command: "cargo build --workspace",
  },
  {
    n: "04",
    Icon: FlaskConical,
    title: "Run the test suite",
    body: "1,300+ inline tests plus 150+ conformance suites. This is the fastest way to confirm your machine reproduces the reference behavior.",
    command: "cargo test --workspace",
  },
  {
    n: "05",
    Icon: Play,
    title: "Run the vertical skeleton",
    body: "fs-vskeleton is the end-to-end demonstrator: a tiny 2D SDF → PDE → objective → adjoint → optimize → ledger → replay. The whole continuum in one binary.",
    command: "cargo run -p fs-vskeleton",
  },
  {
    n: "06",
    Icon: ShieldCheck,
    title: "Check repository policy",
    body: "xtask enforces the rules as code: the acyclic layer direction, Franken-only dependencies, contract presence, and unsafe-capsule registration.",
    command: "cargo run -p xtask -- check",
  },
];

export default function GettingStartedPage() {
  return (
    <main id="main-content">
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute top-0 left-1/4 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[110px]" />
          <div className="absolute bottom-[-10%] right-1/4 h-[360px] w-[360px] rounded-full bg-violet-600/10 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="mb-8 inline-flex items-center gap-3">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Get Started
            </span>
            <div className="h-px w-8 bg-cyan-500/40" />
          </div>

          <GlitchText trigger="hover" intensity="medium">
            <h1 className="mb-6 text-5xl font-black tracking-tighter text-white md:text-7xl">
              Clone the <span className="text-cyan-400">continuum</span>.
            </h1>
          </GlitchText>

          <p className="mx-auto max-w-2xl text-xl font-medium leading-relaxed text-slate-400">
            An honest status: FrankenSim is a large, working Rust workspace of{" "}
            <span className="text-slate-200">93 crates, ~150K lines, 1,300+ tests</span>, but it is not yet a
            packaged simulator. There is no stable public API, no CLI, and no crates.io release. You build it
            from source and read the plan.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {[
              { label: "93 crates" },
              { label: "~150K lines of Rust" },
              { label: "1,300+ inline tests" },
              { label: "Pure, memory-safe Rust" },
            ].map((chip) => (
              <span
                key={chip.label}
                className="rounded-full border border-cyan-500/15 bg-white/[0.03] px-4 py-1.5 text-xs font-bold text-slate-300"
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          PREREQUISITES
          ================================================================ */}
      <SectionShell
        id="prerequisites"
        icon="package"
        eyebrow="Before You Build"
        title="Prerequisites"
        kicker="A short list. The toolchain pins itself; you supply Rust and git."
      >
        <div className="space-y-4">
          {PREREQS.map((p) => (
            <div
              key={p.title}
              className="flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
              <div>
                <div className="font-black text-white">{p.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{p.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      {/* ================================================================
          BUILD STEPS
          ================================================================ */}
      <section id="build" className="relative mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="mb-14 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-3">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Build From Source
            </span>
          </div>
          <GlitchText trigger="hover" intensity="low">
            <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">
              Six commands to a live <span className="text-cyan-400">skeleton</span>.
            </h2>
          </GlitchText>
          <p className="mt-5 text-lg leading-relaxed text-slate-400">
            Clone, build, test, and run the vertical skeleton end-to-end, then let xtask check that the
            repository&apos;s own rules still hold.
          </p>
        </div>

        <div className="space-y-6">
          {STEPS.map((s) => {
            const Icon = s.Icon;
            return (
              <div
                key={s.n}
                className="grid items-center gap-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6 md:grid-cols-[1fr_1.15fr] md:p-8"
              >
                {/* Description */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-mono text-2xl font-black text-cyan-500/40">{s.n}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-400">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.body}</p>
                  </div>
                </div>

                {/* Terminal command */}
                <div className="overflow-hidden rounded-xl border border-cyan-500/15 bg-black/60 shadow-lg shadow-cyan-950/20">
                  <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                      <div className="h-2.5 w-2.5 rounded-full bg-cyan-500/50" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">
                      terminal
                    </span>
                  </div>
                  <div className="overflow-x-auto px-5 py-4">
                    <div className="flex items-center gap-3 font-mono text-sm">
                      <span className="select-none font-bold text-cyan-500">$</span>
                      <code className="whitespace-nowrap font-bold tracking-tight text-slate-200">
                        {s.command}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================================================================
          THE INTERFACE
          ================================================================ */}
      <SectionShell
        id="interface"
        icon="braces"
        eyebrow="The Interface"
        title="One True Interface"
        kicker={
          <>
            Agents and humans drive FrankenSim through FrankenScript, a typed, versioned IR with isomorphic
            s-expression and JSON syntaxes, where the Five Explicits are never left implicit.
          </>
        }
      >
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              FrankenScript: a study
            </div>
            <SyncContainer withPulse accentColor="#06b6d4" className="bg-black/40 p-1 md:p-2">
              <RustCodeBlock code={codeExampleStudy} title="studies/spout-laminar-v3.fscript" />
            </SyncContainer>
            <p className="text-sm leading-relaxed text-slate-400">
              A FrankenScript program states its seed, versions, and budgets inline; the lowering trace is
              inspectable, and when a request is infeasible the error is structured and carries ranked fixes.
              A refusal that teaches is worth ten silent successes.
            </p>
          </div>

          {/* The Five Explicits */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 md:p-8">
            <div className="mb-5 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              The Five Explicits: never implicit, ever
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fiveExplicits.map((e) => (
                <div key={e.key} className="rounded-xl border border-white/5 bg-black/30 p-4">
                  <div className="mb-1.5 font-black text-cyan-300">{e.key}</div>
                  <p className="text-xs leading-relaxed text-slate-400">{e.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              And the Rust underneath
            </div>
            <SyncContainer withPulse accentColor="#a855f7" className="bg-black/40 p-1 md:p-2">
              <RustCodeBlock code={codeExample} title="examples/laplacian.rs" />
            </SyncContainer>
            <p className="text-sm leading-relaxed text-slate-400">
              Below the IR, the crates are ordinary safe Rust you can call directly. Sparse assembly is
              fixed-shape and order-independent, so a SpMV is bit-identical on 1 core or 96.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* ================================================================
          FAQ
          ================================================================ */}
      <SectionShell
        id="faq"
        icon="fileText"
        eyebrow="FAQ"
        title="Common Questions"
        kicker="What FrankenSim is, what it is not yet, and how it was built."
      >
        <div className="space-y-4">
          {faq.map((item) => (
            <details
              key={item.question}
              className="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 font-bold text-white transition-colors hover:text-cyan-400 md:px-8">
                <span>{item.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-open:rotate-180 group-hover:text-cyan-400" />
              </summary>
              <div className="px-6 pb-6 leading-relaxed text-slate-400 md:px-8">{item.answer}</div>
            </details>
          ))}
        </div>
      </SectionShell>

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
              Read the plan, then <span className="text-cyan-400">build</span>.
            </h2>
          </GlitchText>
          <p className="mx-auto mt-6 max-w-xl text-lg font-medium leading-relaxed text-slate-400">
            The source is the fastest way to understand the continuum. Start with the architecture, then see
            the flagships that force every layer to work end-to-end.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={siteConfig.github}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-400 hover:to-cyan-300"
            >
              <Github className="h-4 w-4" />
              View on GitHub
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link
              href="/architecture"
              className="group inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-white/5 px-6 py-3 text-sm font-bold text-slate-200 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white"
            >
              <BookOpen className="h-4 w-4 text-cyan-400" />
              Read the Architecture
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/flagships"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-white/10 hover:text-white"
            >
              <Boxes className="h-4 w-4" />
              See the Flagships
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
