# Changelog

All notable changes to the Asupersync Website are documented in this file,
organized by capability area rather than raw diff order.

This project has no tags or GitHub Releases. History is organized by commit
date, newest first. Every entry links to the live commit on GitHub.

Repository: <https://github.com/Dicklesworthstone/asupersync_website>

---

## 2026-03-16 -- Fix framer-motion MotionValue corruption in custom cursor

[`9d7517a`](https://github.com/Dicklesworthstone/asupersync_website/commit/9d7517a99c3c95d5ccb051cda2d190145d487ecf)

### Cursor rendering

The `DataDebris` particle effect passed the shared `mouseX`/`mouseY`
MotionValues into each particle via `style={{ x, y }}` while simultaneously
running `animate={{ x: [...], y: [...] }}` keyframes on those same values.
Because framer-motion writes keyframe output back into any MotionValue
supplied through `style`, five particles were continuously overwriting the
cursor position with near-zero drift offsets. The result: the custom cursor
flew off-screen whenever the pointer entered a `<pre>` or `<code>` block.

Fix: wrap all particles in a single `motion.div` positioned by the shared
MotionValues. Individual particles now animate their own local offsets
independently, leaving the shared values untouched.

### React 19 lint compliance

Removed the `isMounted` state pattern (`useEffect(() => { setIsMounted(true) }, [])`)
that triggered `react-hooks/set-state-in-effect`. The guard was introduced
in the previous SSR-fix commit but turned out to be unnecessary -- the
cursor already gates its rendering on `isVisible`, which is only set by
mouse events (client-side only). Three other sites in the FrankenSuite
family never needed it either.

**Affected file:** `components/custom-cursor.tsx` (+3, -10)

---

## 2026-02-26 -- Fix SSR hydration, mobile responsiveness, and keyboard accessibility

[`0ff2adc`](https://github.com/Dicklesworthstone/asupersync_website/commit/0ff2adcf78ba271f3b0efd57d590497350c147e2)

Five viz/UI components received targeted fixes. All changes are behavioral
corrections, not new features.

### Server-side rendering

- **custom-cursor.tsx**: Added `isMounted` gate so the component returns
  `null` during SSR. The cursor depends on `mousemove` and `matchMedia`,
  which produce different output on server vs client, causing React
  hydration warnings. (Later removed in `9d7517a` -- see above.)

### Keyboard accessibility

- **cancel-protocol-viz.tsx**: Added `focus-visible` ring styles
  (`focus-visible:ring-2 focus-visible:ring-orange-400` / `ring-slate-400`)
  to Trigger Cancel and Reset buttons.
- **tokio-comparison-viz.tsx**: Added `focus-visible` ring styles
  (`ring-blue-400` on Reset, `ring-red-500` on Cancel) so keyboard users
  can identify which control has focus.

### Mobile and responsive layout

- **calm-theorem-viz.tsx**: Added mobile-visible horizontal red bar lock
  barriers (`block sm:hidden`) that preserve the coordination-cost visual
  metaphor when the desktop vertical barriers are hidden on small screens.
- **spork-otp-viz.tsx**: Replaced `flex-col`/`flex-row` responsive layout
  with a single horizontal flex using `overflow-x-auto`, preventing the
  message transit UI from collapsing into an unreadable vertical stack on
  narrow viewports. Added `min-width` constraints on client column
  (100px), transit lane (160px), and server column (100px). Removed a
  conditional `<br>` in "Client Hangs Forever" that caused mid-word
  wrapping.

### Design-system consistency

- **cancel-protocol-viz.tsx**: Replaced inline `style={{ background }}` on
  the budget bar and comparison panel with Tailwind `bg-slate-900/40` to
  match the site design system and avoid CSS specificity conflicts.

---

## 2026-02-26 -- Add GitHub social preview image

[`7ef4f2d`](https://github.com/Dicklesworthstone/asupersync_website/commit/7ef4f2d413d3342bc91bed520564365654b7e284)

### Social / Open Graph

Added `gh_og_share_image.jpg` (1280x640), generated from the hero
illustration with a bottom gradient bar overlaying repository description
text. This is the image GitHub shows when the repository URL is shared on
social platforms.

---

## 2026-02-26 -- Publish README, hero illustration, and project operations artifacts

[`308cc9b`](https://github.com/Dicklesworthstone/asupersync_website/commit/308cc9b5765b6a8471cacc31f180b753926f165a)

### Documentation

- Added a comprehensive README covering quick setup (one-liner clone),
  architecture diagram, command reference (Bun scripts, `br` issue
  tracking, UBS scanning), environment configuration, troubleshooting
  guide, limitations, FAQ, and contribution policy.
- Applied a manual de-slopify pass to strip formulaic LLM prose patterns
  and em-dash overuse while preserving technical accuracy.

### Visual assets

- Added `asupersync_website_illustration.webp` (~353 KB) as the hero
  illustration. Converted from a ~2.0 MB PNG source; only the optimized
  WebP is committed.

### Project operations

- Added `AGENTS.md` with repo-specific operating constraints and
  multi-agent workflow expectations.
- Committed `.beads/` directory (config.yaml, issues.jsonl, metadata.json)
  to synchronize local `beads_rust` (`br`) issue tracker state with
  repository history.

---

## 2026-02-26 -- Add full application source for interactive Asupersync documentation website

[`e839741`](https://github.com/Dicklesworthstone/asupersync_website/commit/e83974125e59cf6de40b6082f48b37bac46dbba5)

The main product commit: the entire Next.js App Router application,
component library, visualization suite, content model, and static spec-doc
corpus. 106 files, approximately 27,600 lines of new TypeScript, CSS,
and Markdown.

### Interactive visualization suite (30 modules)

All visualizations live under `components/viz/` and are loaded via
`next/dynamic` with `{ ssr: false }` to keep the server render fast.

**Cancellation and budget mechanics** -- five demos covering the core
cancel-correct protocol that distinguishes Asupersync from conventional
runtimes:

- `cancel-protocol-viz` -- animated multi-phase cancellation sequence with
  budget tracking and a side-by-side Tokio comparison panel
- `cancel-state-machine-viz` -- state-machine diagram with live
  transitions between Running, CancelRequested, Draining, and Completed
- `cancel-fuel-viz` -- fuel-budget allocation and depletion visualizer
- `cancellation-injection-viz` -- fault-injection demo showing how
  cancellation propagates through nested task trees
- `budget-algebra-viz` -- compositional algebra of budget splits across
  region hierarchies

**Scheduling and concurrency** -- three demos:

- `scheduler-lanes-viz` -- multi-lane work-stealing scheduler with
  real-time lane utilization bars
- `exp3-scheduler-viz` -- adversarial bandit (Exp3) lane selection
  visualizer
- `dpor-pruning-viz` -- DPOR (dynamic partial-order reduction) search-tree
  pruning animation

**Effects and formal semantics** -- five demos:

- `two-phase-effect-viz` -- two-phase commit/rollback effect lifecycle
- `two-phase-effects-viz` -- multi-effect orchestration variant
- `small-step-semantics-viz` -- formal small-step operational semantics
  stepper
- `obligation-flow-viz` -- obligation tracking across async boundaries
- `region-tree-viz` -- hierarchical region/scope tree with
  cancel-propagation highlighting

**Coordination and comparison** -- four demos:

- `calm-theorem-viz` -- CALM theorem (consistency as logical monotonicity)
  with lock-barrier visual metaphor
- `spork-otp-viz` -- Spork/OTP message-passing protocol with
  client-server transit animation
- `tokio-comparison-viz` -- head-to-head Asupersync vs Tokio cancel
  behavior comparison
- `saga-compensation-viz` -- saga pattern with forward/compensating
  transaction flow

**Security and capability model** -- three demos:

- `capability-security-viz` -- tiered capability hierarchy (FiberCap
  through SupervisorCap)
- `macaroon-capability-viz` -- macaroon-style bearer token demo with
  caveat attenuation
- `macaroon-caveat-viz` -- deep-dive into caveat chain construction and
  verification

**Observability, testing, and diagnostics** -- six demos:

- `eprocess-monitor-viz` -- Erlang-style process monitor dashboard
- `oracle-dashboard-viz` -- test oracle status panel
- `test-oracles-viz` -- oracle-based correctness checking visualizer
- `lyapunov-potential-viz` -- Lyapunov stability potential function graph
- `conformal-calibration-viz` -- conformal prediction calibration curve
- `spectral-deadlock-viz` -- spectral-analysis deadlock detection

**Encoding, replay, and tracing** -- three demos:

- `fountain-code-viz` -- RaptorQ/fountain-code encoding simulation
- `foata-fingerprint-viz` -- Foata normal-form trace fingerprinting
- `trace-replay-stability-viz` -- deterministic trace replay with
  stability scoring

**Sandbox** -- one demo:

- `lab-runtime-viz` -- open-ended runtime experimentation sandbox

### Site pages and routing (6 user-facing routes)

| Route | Purpose |
|---|---|
| `/` | Home -- feature cards, problem scenarios, stats grid, development timeline, agent flywheel animation |
| `/showcase` | Interactive demos -- hosts all 30 visualization components |
| `/architecture` | Technical deep-dive into runtime internals with embedded viz demos |
| `/glossary` | Searchable term explorer (TanStack Table + Virtual) |
| `/getting-started` | Setup and onboarding guide |
| `/spec-explorer` | In-site spec document browser (TanStack Query + Table + Form + Virtual) |

Infrastructure routes: `layout.tsx`, `globals.css`, `global-error.tsx`,
`not-found.tsx`, `robots.ts`, `sitemap.ts`, `icon.tsx`,
`opengraph-image.tsx`, `twitter-image.tsx`.

### UI component library (25 modules)

**Layout and chrome**: `client-shell`, `site-header`, `site-footer`,
`section-shell`, `scroll-to-top`, `bottom-sheet`

**Motion and visual effects**: `motion-wrapper`, `motion/index`,
`glow-orbits`, `custom-cursor`, `sync-elements`

**Content blocks**: `feature-card`, `comparison-table`, `stats-grid`,
`timeline`, `problem-scenario`, `rust-code-block`, `agent-flywheel`

**Typography effects**: `glitch-text`, `decoding-text`, `animated-number`

**Utility**: `error-boundary`, `tooltip`, `robot-mascot`

**Spec Explorer subsystem**: `spec-explorer/spec-search`,
`spec-explorer/spec-viewer`, `spec-explorer/spec-viewer-loader`

### Content model and application state

- `lib/content.ts` -- single-source typed data for site config, nav items,
  feature definitions, glossary terms, FAQ entries, flywheel steps, problem
  scenarios, stats, and timeline milestones (~780 lines)
- `lib/spec-docs.ts` -- spec document index with metadata for 26 markdown
  files: titles, descriptions, categories, and file paths (~244 lines)
- `lib/site-state.tsx` -- React context and hooks for runtime UI behavior,
  interaction controls, and cursor state
- `lib/utils.ts` -- shared utility functions (className merging via
  clsx + tailwind-merge)

### Custom hooks

- `use-body-scroll-lock.ts` -- prevents background scroll when
  modals/bottom sheets are open
- `use-haptic-feedback.ts` -- triggers device haptic feedback on supported
  platforms
- `use-intersection-observer.ts` -- Intersection Observer wrapper for lazy
  loading and scroll-triggered animations

### Spec document corpus (26 markdown files)

Searchable specification documents under `public/spec-docs/`, consumed by
the Spec Explorer via `lib/spec-docs.ts`:

**Formal semantics and core design**: `asupersync_v4_formal_semantics.md`

**Security**: `THREAT_MODEL.md`, `security_threat_model.md`

**Cancellation**: `cancellation-testing.md`

**Scheduling**: `scheduler_arena_plan.md`, `calm_analysis.md`

**Spork subsystem**: `spork_operational_semantics.md`,
`spork_deterministic_ordering.md`, `spork_glossary_invariants.md`

**RaptorQ fountain codes** (7 documents): `raptorq_baseline_bench_profile.md`,
`raptorq_controlled_rollout_policy.md`,
`raptorq_expected_loss_decision_contract.md`,
`raptorq_optimization_decision_records.md`,
`raptorq_post_closure_opportunity_backlog.md`,
`raptorq_program_closure_signoff_packet.md`,
`raptorq_rfc6330_clause_matrix.md`, `raptorq_unit_test_matrix.md`

**Integration and API**: `integration.md`, `macro-dsl.md`, `api_audit.md`

**Debugging and observability**: `replay-debugging.md`,
`deadline-monitoring.md`

**Runtime internals**: `runtime_state_contention_inventory.md`,
`benchmarking.md`

**Migration**: `bead-harmonization-migration.md`

**Comparison**: `otp_comparison.md`

### TanStack integration

The Spec Explorer and Glossary pages use four TanStack libraries together:

- **@tanstack/react-query** -- cached document fetching for spec markdown
- **@tanstack/react-table** -- column-based filtering and sorting for
  glossary and comparison tables
- **@tanstack/react-form** -- controlled search input state
- **@tanstack/react-virtual** -- virtualized rendering for large document
  and term lists

### Type definitions

- `types/global.d.ts` -- global TypeScript ambient declarations

---

## 2026-02-26 -- Bootstrap Bun/Next.js toolchain and repository hygiene

[`fc9686e`](https://github.com/Dicklesworthstone/asupersync_website/commit/fc9686ea1a828fd020d66433f464d27ddd47973f)

Initial commit. Establishes the build toolchain, dependency manifest, and
repository ignore policy before any source code lands. Intentionally kept
separate from product code so history is easy to bisect.

### Build toolchain

- **Runtime**: Bun 1.3.3 (pinned via `packageManager` field; engine
  constraint `>=1.3.0`; npm/yarn/pnpm explicitly blocked via
  `engines.npm` sentinel)
- **Framework**: Next.js 16.1.6 with Turbopack dev server
  (`next dev --turbopack`)
- **Language**: TypeScript 5, strict mode enabled in `tsconfig.json`
- **Styling**: Tailwind CSS 4 via PostCSS (`@tailwindcss/postcss`)
- **Linting**: ESLint 9 with `eslint-config-next` 16.1.6
  (Core Web Vitals + TypeScript rules)

### Dependencies (pinned in package.json)

| Package | Version | Role |
|---|---|---|
| `next` | 16.1.6 | App framework |
| `react` / `react-dom` | 19.2.4 | UI runtime |
| `framer-motion` | ^12.33.0 | Animation / MotionValues |
| `@tanstack/react-query` | ^5.90.21 | Async data fetching |
| `@tanstack/react-table` | ^8.21.3 | Headless table state |
| `@tanstack/react-form` | ^1.28.3 | Form state management |
| `@tanstack/react-virtual` | ^3.13.19 | Virtualized list rendering |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.4.0 | Conditional class merging |
| `dompurify` | ^3.3.1 | HTML sanitization |
| `lucide-react` | ^0.563.0 | Icon set |
| `marked` | ^17.0.3 | Markdown-to-HTML rendering |
| `tailwindcss` | ^4 | Utility-first CSS |
| `typescript` | ^5 | Type system |

### Repository hygiene

- `.gitignore` tuned for Next.js + Bun: ignores `.next/`, `out/`,
  `node_modules/`, `*.tsbuildinfo`, `.env*` variants, `.vercel/`, SQLite
  dev-state files, macOS sidecar files (`.DS_Store`, `._*`), and local
  scratch scripts
- `next.config.ts`: WebP image format preference, gzip/brotli
  compression, `x-powered-by` header removed, React strict mode enabled
- `bun.lock` committed for reproducible installs
- Config files: `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`,
  `next-env.d.ts`
