"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { Cpu, Layers, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import GlitchText from "@/components/glitch-text";
import LazyViz from "@/components/lazy-viz";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useScrollIdleClass } from "@/lib/use-viz-anim";
import { e2eCampaigns, type E2eCampaign } from "@/lib/content";

// ── The ten certified end-to-end campaign demos ───────────────────────────
import ProofRobust from "@/components/wasm/campaign/proof-robust";
import MetamatFrontier from "@/components/wasm/campaign/metamat-frontier";
import FlutterBoundary from "@/components/wasm/campaign/flutter-boundary";
import ScheduleCriticalPath from "@/components/wasm/campaign/schedule-critical-path";
import TrussPath from "@/components/wasm/campaign/truss-path";
import SensorForge from "@/components/wasm/campaign/sensor-forge";
import NeuroShape from "@/components/wasm/campaign/neuro-shape";
import GrammarForge from "@/components/wasm/campaign/grammar-forge";
import AnytimeBo from "@/components/wasm/campaign/anytime-bo";
import FlowCert from "@/components/wasm/campaign/flow-cert";

const DEMOS: Record<string, ComponentType> = {
  proofrobust: ProofRobust,
  metamat: MetamatFrontier,
  flutter: FlutterBoundary,
  schedule: ScheduleCriticalPath,
  truss: TrussPath,
  sensor: SensorForge,
  neuro: NeuroShape,
  grammar: GrammarForge,
  anytimebo: AnytimeBo,
  flowcert: FlowCert,
};

function CampaignSection({ c, index }: { c: E2eCampaign; index: number }) {
  const Demo = DEMOS[c.key];
  const num = String(index + 1).padStart(2, "0");
  const accent = c.accent;
  return (
    <section className="relative border-t border-white/5 py-20 md:py-28">
      {/* faint per-campaign glow, alternating side */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-[8%] h-[38%] w-[42%] rounded-full blur-[130px]"
          style={{
            background: `${accent}14`,
            left: index % 2 === 0 ? "-10%" : undefined,
            right: index % 2 === 0 ? undefined : "-10%",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        {/* header */}
        <div className="flex items-start gap-5 md:gap-7">
          <div
            className="mt-1 shrink-0 font-mono text-4xl font-black tabular-nums leading-none md:text-6xl"
            style={{ color: `${accent}55` }}
          >
            {num}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{ borderColor: `${accent}44`, color: `${accent}dd`, background: `${accent}0d` }}
              >
                <Cpu className="h-3 w-3" /> {c.crate}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                <Layers className="h-3 w-3" /> {c.layer}
              </span>
            </div>
            <h2 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight text-white md:text-5xl">
              {c.title}
            </h2>
            <p className="mt-3 text-base font-semibold md:text-lg" style={{ color: `${accent}` }}>
              {c.tagline}
            </p>
          </div>
        </div>

        {/* lede */}
        <p className="mt-8 max-w-3xl text-[15px] leading-relaxed text-slate-300 md:text-lg md:leading-relaxed">
          {c.lede}
        </p>

        {/* composed-from pillars */}
        <div className="mt-10">
          <div className="mb-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            <span className="h-px w-6" style={{ background: `${accent}66` }} />
            Composed from crates never designed to meet
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.pillars.map((p) => (
              <div
                key={p.crate}
                className="glass-modern rounded-xl border border-white/8 p-4"
              >
                <div className="font-mono text-[12px] font-bold" style={{ color: `${accent}` }}>
                  {p.crate}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{p.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* only-in-FrankenSim callout */}
        <div
          className="mt-8 rounded-2xl border p-5 md:p-6"
          style={{ borderColor: `${accent}33`, background: `${accent}0a` }}
        >
          <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: `${accent}dd` }}>
            <Sparkles className="h-3.5 w-3.5" /> Only in FrankenSim
          </div>
          <p className="text-[15px] leading-relaxed text-slate-200 md:text-base md:leading-relaxed">
            {c.impossible}
          </p>
        </div>

        {/* the live demo */}
        <div className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: accent }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
              </span>
              Computed live · this exact pipeline, in your browser
            </span>
          </div>
          <LazyViz minHeight={620}>
            <Demo />
          </LazyViz>
          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3"
            style={{ borderColor: `${accent}2e`, background: "rgba(4,9,13,0.5)" }}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
            <p className="font-mono text-[12px] leading-relaxed text-slate-300">
              <span className="font-bold" style={{ color: `${accent}` }}>Certified result: </span>
              {c.result}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function E2eShowcase() {
  const { ready, engine } = useFsWasm();
  useScrollIdleClass();

  return (
    <main id="main-content">
      {/* HERO */}
      <section className="relative overflow-hidden pt-36 pb-14">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-10%] left-[-5%] h-[46%] w-[46%] rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="absolute bottom-[-14%] right-[-6%] h-[42%] w-[46%] rounded-full bg-cyan-600/10 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-6xl px-6">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-emerald-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400/80">
              The Campaigns · Certified end-to-end
            </span>
          </div>
          <GlitchText trigger="hover" intensity="medium">
            <h1 className="text-[clamp(2.5rem,6.5vw,5rem)] font-black leading-[0.98] tracking-tight text-white">
              Not an answer. An <span className="text-gradient-sync">illuminated</span> one.
            </h1>
          </GlitchText>
          <p className="mt-8 max-w-3xl text-lg font-medium leading-relaxed text-slate-300 md:text-xl md:leading-relaxed">
            The Lab shows FrankenSim&apos;s kernels one at a time. These are the campaigns: ten
            end-to-end pipelines that wire crates which were never designed to meet into a single
            certified result. Each returns a proof, a frontier, a stop rule, or a credibility map,
            not a bare number, and each runs its whole pipeline live in your browser, compiled from
            the same Rust the native workspace builds.
          </p>

          <div
            className="mt-8 inline-flex items-center gap-3 rounded-full border px-4 py-2 font-mono text-[11px]"
            style={{
              borderColor: ready ? "rgba(16,185,129,0.35)" : "rgba(148,163,184,0.25)",
              background: ready ? "rgba(16,185,129,0.06)" : "rgba(148,163,184,0.04)",
            }}
          >
            <motion.span
              className="h-2 w-2 rounded-full"
              style={{ background: ready ? "#10b981" : "#fbbf24", boxShadow: ready ? "0 0 8px #10b981" : "none" }}
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            {ready ? (
              <span className="truncate text-emerald-300 max-w-[80vw] md:max-w-2xl">● ENGINE ONLINE · {engine}</span>
            ) : (
              <span className="text-amber-300">REANIMATING KERNELS…</span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-2 gap-y-2">
            {e2eCampaigns.map((c, i) => (
              <a
                key={c.key}
                href={`#${c.key}`}
                className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:border-white/20 hover:text-white"
              >
                <span style={{ color: `${c.accent}cc` }}>{String(i + 1).padStart(2, "0")}</span> {c.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CAMPAIGN SECTIONS */}
      {e2eCampaigns.map((c, i) => (
        <div key={c.key} id={c.key} className="scroll-mt-24">
          <CampaignSection c={c} index={i} />
        </div>
      ))}

      {/* OUTRO */}
      <section className="relative border-t border-white/5 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-sm leading-relaxed text-slate-500">
            Every campaign above executed its full certified pipeline in WebAssembly, the same bytes
            the native FrankenSim build runs. The engine source lives in{" "}
            <code className="text-emerald-300">crates/fs-wasm</code>, each campaign in its own{" "}
            <code className="text-emerald-300">fs-*-e2e</code> crate.
          </p>
          <a
            href="/lab"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
          >
            See the kernels one at a time in the Lab <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </main>
  );
}
