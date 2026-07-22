<div align="center">
  <img src="public/frankensim_illustration.webp" alt="FrankenSim" width="720">

# FrankenSim Website

[![Live](https://img.shields.io/badge/live-frankensim.org-06b6d4)](https://frankensim.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA)](https://react.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.3-F9F1E1)](https://bun.sh/)
[![WASM](https://img.shields.io/badge/lab-40%20live%20Rust%20kernels-654FF0)](https://frankensim.org/lab)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](#license)

**The marketing and documentation site for [FrankenSim](https://github.com/Dicklesworthstone/frankensim), a certified simulation and design kernel for Rust. Live at [frankensim.org](https://frankensim.org).**

</div>

```bash
git clone https://github.com/Dicklesworthstone/frankensim_website.git && cd frankensim_website && bun install && bun dev
```

## TL;DR

**The problem:** most project sites for deep systems are static marketing pages. They *claim* the system is fast, correct, and novel, but a reader leaves without ever seeing it do anything, and the impressive parts stay abstract.

**The solution:** this site *shows* FrankenSim instead of describing it. Forty of FrankenSim's real Rust numerical kernels are compiled to WebAssembly and run live in your browser, across two experiences: thirty quick demos in the Lab ([`/lab`](https://frankensim.org/lab), three tiers from numerical primitives to the deep upper stack) and ten certified end-to-end campaigns ([`/e2e`](https://frankensim.org/e2e), each composing crates that were never designed to meet into one pipeline that returns a proof, a frontier, a stop rule, or a credibility map). The ideas behind the project (evidence-carrying values, sheaf-cohomology watertightness, anytime-valid statistics) are taught through interactive visualizations; and the whole 109-crate architecture is browsable, not just asserted.

### Why this site is different

| Capability | What you get |
|---|---|
| **Live WASM kernels** | Thirty of FrankenSim's actual Rust kernels ([`/lab`](https://frankensim.org/lab)) compiled to WebAssembly and computing in your browser, in three tiers: foundations (topology optimizer, raymarched SDF, spectral waves, Lorenz, interval-certified Mandelbrot, randomized SVD, Orr–Sommerfeld) and the deep upper stack (Hodge decomposition, real Navier–Stokes, Gaussian-process BO, CutFEM). No mocks; the same bytes the native build runs. |
| **Certified E2E campaigns** | Ten end-to-end pipelines ([`/e2e`](https://frankensim.org/e2e)), each wiring crates that were never designed to meet (SOS × robust, tropical × VoI, LBM × archive, rep-neural × interval arithmetic, …) into a single certified result: an SOS-proven global optimum, a PSD-stable stiffness frontier, a proven flutter boundary, an anytime-valid stop, a CFD credibility map. Each runs its whole pipeline live in the browser. |
| **Interactive concept viz** | Twenty-plus bespoke visualizations for the hard ideas: Region/Chart routing, the three epistemic colors, `Evidence<T>`, sheaf gluing (H⁰) and obstruction (H¹), the two-lane executor, certified speculation, the Gauntlet. |
| **Real 3D** | Six of the Lab demos render in WebGL through Three.js with custom GLSL. |
| **Self-maintaining stats** | The crate count, line count, and test totals are computed from the FrankenSim source, not hand-typed. |
| **Native project graph** | The FrankenSim issue and dependency viewer is integrated on-brand at [`/beads`](https://frankensim.org/beads). |
| **Modern stack** | Next.js 16 (App Router, Turbopack), React 19, strict TypeScript, Tailwind v4, framer-motion, Three.js, Bun. |

## What FrankenSim is

[FrankenSim](https://github.com/Dicklesworthstone/frankensim) is a single, memory-safe Rust continuum for computational geometry, physics, optimization, and rendering. Most simulation stacks split physical units, numerical error, geometry validity, provenance, and reproducibility across incompatible tools; FrankenSim builds those concerns into one workspace, so derivatives, error bounds, budgets, provenance, and cancellation ride *inside* the values. Where it matters, it returns proofs, not just numbers.

- **109 `fs-*` crates** in one acyclic workspace across seven layers (L0 Substrate through L6 Helm).
- Deterministic numerics, certified intervals, exact geometric predicates, CutFEM-on-SDF, adjoint-native optimization, spectral path tracing, and a FrankenSQLite-backed design ledger.
- An epistemic type system: every value is verified, validated, or estimated, and composition is type-checked so an estimate can never launder into a certificate.

This repository is the **website** for that project, not the kernel itself.

## Quick example

```bash
bun install                              # install deps (Bun only)
bun dev                                  # dev server at http://localhost:3000
open http://localhost:3000/lab           # the 30 live WASM kernels (three tiers)
open http://localhost:3000/e2e           # the 10 certified end-to-end campaigns
open http://localhost:3000/epistemics    # the sheaf-cohomology story, visualized
bunx tsc --noEmit                        # strict typecheck
bun run build                            # production build
```

## Design philosophy

1. **Show, do not claim.** If a FrankenSim capability is central, it should run in the browser or be visualized, not merely asserted. The Lab compiles real kernels to WASM precisely so the demos cannot be faked.
2. **One source of truth.** All content lives in `lib/content.ts`; the hero stats and the crate atlas are computed from the Rust source by `scripts/compute-stats.mjs` and `scripts/generate-atlas.mjs`, so the site cannot drift from reality.
3. **Performance is a feature.** Heavy visualizations lazy-mount and pause off-screen; animations respect `prefers-reduced-motion`; the page stays smooth under twenty live demos.
4. **The brand is an instrument panel.** A near-black-teal canvas, cyan and violet accents, glass surfaces, and micro-labels: a laboratory of certified monsters, not a blog.

## Comparison

| Dimension | This site | Typical project microsite | Plain docs |
|---|---|---|---|
| Runs the real system in-browser | ✅ 40 Rust kernels via WASM (30 Lab + 10 E2E) | ❌ Screenshots or video | ❌ None |
| Interactive concept teaching | ✅ 20+ bespoke visualizations | ⚠️ Occasional | ❌ Prose only |
| Real-time 3D (WebGL) | ✅ 6 Three.js demos | ⚠️ Rare | ❌ None |
| Numbers verified from source | ✅ Computed by script | ⚠️ Hand-typed, drifts | ⚠️ Hand-typed |
| Motion accessibility | ✅ reduced-motion throughout | ⚠️ Inconsistent | n/a |

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  Content     lib/content.ts   (single source of truth)        │
│              scripts/compute-stats.mjs · scripts/generate-atlas.mjs
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js 16 App Router                                        │
│  app/{page,architecture,kernel,flagships,lab,e2e,epistemics, │
│       roadmap,glossary,getting-started}/page.tsx             │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Components                                                   │
│  components/viz/*             16 SVG/canvas concept viz       │
│  components/wasm/*            10 foundation Lab demos    (/lab)│
│  components/wasm/frontier/*   10 Three.js / WebGL demos  (/lab)│
│  components/wasm/deep/*       10 upper-stack kernel demos(/lab)│
│  components/wasm/campaign/*   10 certified campaigns     (/e2e)│
│  components/e2e-showcase.tsx  the /e2e editorial layout        │
│  lib/use-fs-wasm.ts          shared Web Worker → WASM kernels │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│  WASM engine   public/fs-wasm/   (fs_wasm_bg.wasm + glue)     │
│  built from the fs-wasm crate in the FrankenSim workspace     │
└──────────────────────────────────────────────────────────────┘
```

## Installation

### Local development (recommended)

```bash
git clone https://github.com/Dicklesworthstone/frankensim_website.git
cd frankensim_website
bun install
bun dev
```

### From an archive (no git clone)

```bash
curl -L https://github.com/Dicklesworthstone/frankensim_website/archive/refs/heads/main.tar.gz -o site.tar.gz
tar -xzf site.tar.gz && cd frankensim_website-main
bun install && bun dev
```

### Deploy (Vercel, prebuilt)

```bash
vercel build --prod && vercel deploy --prebuilt --prod
```

## Command reference

| Command | Purpose |
|---|---|
| `bun dev` | Start the dev server (Turbopack) at `:3000` |
| `bun run build` | Production build |
| `bun start` | Serve the production build |
| `bunx tsc --noEmit` | Strict typecheck |
| `bun lint` | ESLint |
| `bun scripts/compute-stats.mjs` | Recompute hero stats from the FrankenSim source (`FRANKENSIM_DIR`, default `~/projects/frankensim`) |
| `bun scripts/generate-atlas.mjs` | Regenerate the crate atlas from workspace metadata |

## Rebuilding the WASM engine

The Lab's kernels come from the `fs-wasm` crate in the [FrankenSim workspace](https://github.com/Dicklesworthstone/frankensim) (`crates/fs-wasm`). To rebuild the browser bindings after changing the Rust:

```bash
cd ~/projects/frankensim/crates/fs-wasm
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen <cargo-target>/wasm32-unknown-unknown/release/fs_wasm.wasm \
  --target web --out-dir ~/projects/frankensim_website/public/fs-wasm --no-typescript
```

The worker at `public/fs-wasm/worker.js` hosts the module; an `import * as` auto-exposes every kernel, so new exports need no worker change.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `bun: command not found` | Install Bun (`curl -fsSL https://bun.sh/install \| bash`), then verify with `bun --version`. |
| Used npm/yarn/pnpm and lockfiles conflict | This repo is Bun-only. Remove other lockfiles, keep `bun.lock`, and run `bun install`. |
| Lab demos do not compute | They require a browser with WebAssembly and Web Workers (any modern browser); the 3D demos also need WebGL2. |
| Type errors after a dependency bump | `bun install`, then `bunx tsc --noEmit`. |
| Phantom Next.js type errors | `rm -r .next/cache` and rebuild. |
| Hero stats look stale | Run `bun scripts/compute-stats.mjs` (needs a local FrankenSim checkout at `FRANKENSIM_DIR`). |

## Limitations

- This is the **website**, not the FrankenSim kernel. For the Rust workspace, see [Dicklesworthstone/frankensim](https://github.com/Dicklesworthstone/frankensim).
- The Lab runs a curated subset of kernels compiled to WASM; it is a live demonstration, not the full native workspace.
- The stats and atlas scripts require a local FrankenSim checkout to refresh; they do not run at deploy time.
- Content updates are code changes; there is no CMS.
- Bun only. No npm/yarn/pnpm workflow.

## FAQ

**Is this FrankenSim itself?** No. This is the website. The kernel is a separate Rust workspace.

**Are the Lab demos real or faked?** Real. Each is the actual `fs-*` Rust kernel compiled to WebAssembly (`crates/fs-wasm`) and run in a Web Worker, the same code the native build compiles.

**Where do I edit content?** `lib/content.ts` is the single source of truth for copy, navigation, the seven layers, the crate atlas, flagships, the comparison table, the glossary, and the FAQ.

**How are the crate, line, and test numbers kept accurate?** They are computed from the FrankenSim source by `scripts/compute-stats.mjs` and `scripts/generate-atlas.mjs`, not hand-typed.

**Can I use npm?** No. The project is intentionally Bun-only.

**How do I add a page?** Create `app/<route>/page.tsx` and add it to `navItems` in `lib/content.ts`.

## About Contributions

> *About Contributions:* Please don't take this the wrong way, but I do not accept outside contributions for any of my projects. I simply don't have the mental bandwidth to review anything, and it's my name on the thing, so I'm responsible for any problems it causes; thus, the risk-reward is highly asymmetric from my perspective. I'd also have to worry about other "stakeholders," which seems unwise for tools I mostly make for myself for free. Feel free to submit issues, and even PRs if you want to illustrate a proposed fix, but know I won't merge them directly. Instead, I'll have Claude or Codex review submissions via `gh` and independently decide whether and how to address them. Bug reports in particular are welcome. Sorry if this offends, but I want to avoid wasted time and hurt feelings. I understand this isn't in sync with the prevailing open-source ethos that seeks community contributions, but it's the only way I can move at this velocity and keep my sanity.

## License

MIT.
