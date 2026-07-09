// ============================================================================
//  FrankenSim — Single source of truth for all site content.
//  A pure-Rust continuum for computational geometry, physics, optimization,
//  and rendering — with evidence carried inside every value.
// ============================================================================

export const siteConfig = {
  name: "FrankenSim",
  title: "FrankenSim: The Certified Simulation & Design Kernel for Rust",
  description:
    "A single, memory-safe Rust continuum for computational geometry, physics, optimization, and rendering, with derivatives, error bounds, budgets, provenance, and cancellation riding inside the values. Where it matters, the answer arrives with a proof.",
  url: "https://frankensim.org",
  github: "https://github.com/Dicklesworthstone/frankensim",
  beads: "https://frankensim.org/beads/",
  social: {
    github: "https://github.com/Dicklesworthstone/frankensim",
    x: "https://x.com/doodlestein",
    authorGithub: "https://github.com/Dicklesworthstone",
  },
};

export const navItems = [
  { href: "/", label: "Home" },
  { href: "/architecture", label: "Architecture" },
  { href: "/kernel", label: "Kernel" },
  { href: "/flagships", label: "Flagships" },
  { href: "/lab", label: "Lab" },
  { href: "/e2e", label: "E2E" },
  { href: "/epistemics", label: "Epistemics" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/glossary", label: "Glossary" },
];

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export interface Stat { label: string; value: string; helper?: string; }
export interface Feature { title: string; description: string; icon: string; category?: string; }
export interface ComparisonRow {
  feature: string;
  frankensim: string;
  comsol: string;
  openfoam: string;
  scipy: string;
}
export interface ChangelogEntry { period: string; title: string; items: string[]; }
export interface GlossaryTerm { term: string; short: string; long: string; }
export interface FaqItem { question: string; answer: string; }

export interface Layer {
  id: string;          // "L0"
  code: string;        // "SUBSTRATE"
  name: string;        // "Substrate"
  color: string;       // hex
  tagline: string;
  responsibility: string;
  crates: string[];    // crate names in this layer
}

export interface Crate { name: string; layer: string; blurb: string; }

export interface Principle { id: string; title: string; body: string; }

export interface Phase {
  id: string;          // "P0"
  name: string;
  window: string;      // "Weeks 0–6"
  status: "done" | "active" | "planned";
  scope: string;
  exit: string;
}

export interface Flagship {
  id: string;
  name: string;
  tagline: string;
  color: string;
  icon: string;
  description: string;
  objective: string;
  methods: string[];
  payoff: string;
}

// ---------------------------------------------------------------------------
//  Hero stats
// ---------------------------------------------------------------------------

export const heroStats: Stat[] = [
  { label: "Kernel Layers", value: "7", helper: "L0 Substrate → L6 Helm" },
  { label: "Rust Crates", value: "104", helper: "one acyclic workspace" },
  { label: "Lines of Rust", value: "171K", helper: "pure, memory-safe, Franken-only deps" },
  { label: "Inline Tests", value: "1458", helper: "+ 175 conformance suites" },
];

// ---------------------------------------------------------------------------
//  The Decalogue — ten non-negotiable principles
// ---------------------------------------------------------------------------

export const principles: Principle[] = [
  { id: "P1", title: "Pure, memory-safe Rust", body: "One language, Franken-constellation dependencies only. Unsafe lives only in audited leaf capsules under 300 lines, each behind a safe façade." },
  { id: "P2", title: "Determinism is a feature", body: "Bit-identical across runs, thread counts, and (best-effort) ISAs, delivered by fixed-shape reduction trees, counter-based RNG keyed by logical identity, and compensated summation." },
  { id: "P3", title: "Differentiable or certifiable", body: "Every operator is differentiable, certifiable, or ideally both. Gradients are checked at the merge gate; error bounds are first-class." },
  { id: "P4", title: "Budgets first", body: "Every operation takes an accuracy / time / memory budget. The Error Ledger and Time Ledger compose them end-to-end and attribute every digit and every second." },
  { id: "P5", title: "Structure over brute force", body: "Exact discrete de Rham (d∘d = 0), symplectic integrators, power-conserving ports. Preserve the math instead of resolving it away." },
  { id: "P6", title: "Matrix-free & roofline-honest", body: "Kernels ship their arithmetic-intensity analysis against machine peak. No dense assembly where a matrix-free apply will do." },
  { id: "P7", title: "Cancellation-correct compute", body: "Cancellation is a numerical primitive. Bounded latency-to-cancel of ≤ 200 µs; speculative races kill their losers mid-solve." },
  { id: "P8", title: "One data model", body: "Complexes and cochains, everywhere. Geometry, fields, and operators share a single typed algebra instead of six incompatible schemas." },
  { id: "P9", title: "Provenance-complete", body: "Content-addressed artifacts, event-sourced operations, and explain(artifact): a result always knows how it was made." },
  { id: "P10", title: "Agent-first ergonomics", body: "The Five Explicits (units, seeds, budgets, versions, and capabilities) are never implicit, ever. Built for the swarm, compatible with humans." },
];

// The Five Explicits
export const fiveExplicits = [
  { key: "Units", icon: "ruler", body: "Dimensional quantities are compile-time typed. A meter never silently becomes a second." },
  { key: "Seeds", icon: "dices", body: "Counter-based RNG keyed by logical identity. Every random draw is reproducible by construction." },
  { key: "Budgets", icon: "gauge", body: "Accuracy, time, and memory ceilings travel with every call and compose across the whole plan." },
  { key: "Versions", icon: "gitCommit", body: "The constellation is locked by hash. The kernels that produced a result are always recoverable." },
  { key: "Capabilities", icon: "key", body: "The Cx context grants exactly what an operation may touch: arena, cancel token, ledger, budget." },
];

// ---------------------------------------------------------------------------
//  The seven layers (L0 → L6), strictly acyclic
// ---------------------------------------------------------------------------

export const layers: Layer[] = [
  {
    id: "L6", code: "HELM", name: "Helm", color: "#f97316",
    tagline: "Orchestration, ledger & agent interface",
    responsibility: "FrankenScript IR, sessions & capabilities, the Design Ledger, the plan-cost oracle, reports, and the agent API. The one true interface.",
    crates: ["fs-bisect", "fs-checker", "fs-frame", "fs-ir", "fs-ledger", "fs-marquee", "fs-package", "fs-plan", "fs-recompute", "fs-report", "fs-roofline", "fs-session", "fs-spececo", "fs-vskeleton", "fs-wasm"],
  },
  {
    id: "L5", code: "LUMEN", name: "Lumen", color: "#a855f7",
    tagline: "Rendering & visualization",
    responsibility: "Spectral path tracing, direct chart rendering, deterministic image plumbing, and differentiable rendering where the marketing shot and the physics are the same bytes.",
    crates: ["fs-img", "fs-render", "fs-viz"],
  },
  {
    id: "L4", code: "ASCENT", name: "Ascent", color: "#3b82f6",
    tagline: "Optimization & uncertainty",
    responsibility: "Shape / topology / global / derivative-free optimization over manifold variables, e-process racing, constraint calculus, and SOS certificates.",
    crates: ["fs-archive", "fs-ascent", "fs-assimilate", "fs-bo", "fs-constraint", "fs-dfo", "fs-dimine", "fs-eproc", "fs-fab", "fs-geocon", "fs-opt", "fs-robust", "fs-sos", "fs-surrogate", "fs-toleralloc", "fs-topols", "fs-topopt", "fs-truss", "fs-uq", "fs-voi"],
  },
  {
    id: "L3", code: "FLUX", name: "Flux", color: "#06b6d4",
    tagline: "Physics kernel",
    responsibility: "Exterior-calculus FEEC, CutFEM-on-SDF, structure-preserving integrators, constitutive laws, matrix-free solvers with adjoints, and certified speculation.",
    crates: ["fs-adjoint", "fs-bem", "fs-contract", "fs-couple", "fs-cutfem", "fs-dd", "fs-dwr", "fs-feec", "fs-flux", "fs-iface", "fs-iga", "fs-ladder", "fs-lbm", "fs-material", "fs-opdsl", "fs-probe", "fs-regime", "fs-scenario", "fs-solid", "fs-solver", "fs-time", "fs-verify", "fs-vpm"],
  },
  {
    id: "L2", code: "MORPH", name: "Morph", color: "#10b981",
    tagline: "Geometry kernel & representations",
    responsibility: "The Region / Chart abstraction, the Rep Router, SDF / mesh / F-rep / NURBS / voxel charts, geometric algebra, uniform queries, topology & manufacturability certificates.",
    crates: ["fs-asbuilt", "fs-conform", "fs-fmm", "fs-ga", "fs-geom", "fs-io", "fs-mesh", "fs-query", "fs-rep-frep", "fs-rep-mesh", "fs-rep-neural", "fs-rep-nurbs", "fs-rep-sdf", "fs-rep-voxel", "fs-shapeprog", "fs-topo", "fs-xform"],
  },
  {
    id: "L1", code: "BEDROCK", name: "Bedrock", color: "#f59e0b",
    tagline: "Numerical foundations",
    responsibility: "Deterministic dense / sparse / FFT linear algebra, certified interval & Taylor arithmetic with exact predicates, Chebyshev spectral methods, QMC RNG, and autodiff.",
    crates: ["fs-ad", "fs-cheb", "fs-fft", "fs-ivl", "fs-la", "fs-rand", "fs-sparse", "fs-spectral", "fs-symmetry", "fs-tropical"],
  },
  {
    id: "L0", code: "SUBSTRATE", name: "Substrate", color: "#64748b",
    tagline: "Hardware, execution & determinism",
    responsibility: "Machine topology & SIMD dispatch, aligned arenas, the two-lane cancellable executor, tile kernels, structure-of-arrays, and the safe tile-kernel DSL.",
    crates: ["fs-alloc", "fs-exec", "fs-math", "fs-simd", "fs-soa", "fs-substrate", "fs-tilelang"],
  },
];

// Cross-cutting crates present at every layer
export const crossCuttingCrates = ["fs-qty", "fs-obs", "fs-evidence"];

// ---------------------------------------------------------------------------
//  The full crate inventory
// ---------------------------------------------------------------------------

export const crates: Crate[] = [
  // Cross-cutting (present workspace-wide)
  { name: "fs-benchmark", layer: "UTIL", blurb: "The wedge-vertical benchmark & trace corpus (addendum Proposal 7): a single versioned, deterministic artifact." },
  { name: "fs-crosswalk", layer: "UTIL", blurb: "Regulatory vocabulary crosswalk (addendum Proposal 12): a machine-readable mapping of evidence-package fields onto the regulator's existing language." },
  { name: "fs-evidence", layer: "UTIL", blurb: "Evidence<T> / Certified<T>: a value plus four uncertainty slices, composed conservatively, with model cards, the three colors, and falsifiers." },
  { name: "fs-govern", layer: "UTIL", blurb: "Addendum governance as machine-readable data: the design principles (P1-P8), the governance rules." },
  { name: "fs-obs", layer: "UTIL", blurb: "Structured event schema, emitters, and content hashing: the shared observability spine." },
  { name: "fs-qty", layer: "UTIL", blurb: "Compile-time dimensional quantities Qty<M,KG,S,K,A>, SI parsing, and dimension checks." },
  { name: "fs-soa-derive", layer: "UTIL", blurb: "The #[derive(Soa)] procedural macro." },
  { name: "fs-tilelang-macros", layer: "UTIL", blurb: "The kernel! macro implementation for fs-tilelang." },
  { name: "fs-wedge", layer: "UTIL", blurb: "Go-to-market wedge selection as data (addendum Proposal 7): the conjugate-heat-transfer beachhead scored on four criteria." },
  // L0 SUBSTRATE
  { name: "fs-alloc", layer: "L0", blurb: "128-byte aligned allocation, cache padding, scoped arenas, arena pools, and hugepage policy." },
  { name: "fs-exec", layer: "L0", blurb: "The Cx context, two-lane executor, cancellation gates, tile kernels, deterministic reductions, speculative races, and resumable solvers." },
  { name: "fs-math", layer: "L0", blurb: "Deterministic elementary functions with declared ULP budgets, complex arithmetic, error-free transforms, and double-double." },
  { name: "fs-simd", layer: "L0", blurb: "Scalar baseline plus registered NEON / AVX-512 unsafe capsules behind safe façades and alignment contracts." },
  { name: "fs-soa", layer: "L0", blurb: "Structure-of-arrays runtime: 128-byte-aligned per-field buffers, SIMD across elements, zero-copy views. No unsafe." },
  { name: "fs-substrate", layer: "L0", blurb: "Machine capability probes, fingerprints, topology maps, dispatch tiers, and Morton / tile IDs." },
  { name: "fs-tilelang", layer: "L0", blurb: "A safe tile-kernel DSL: one body lowers to scalar and lane-shaped variants (bitwise-equal) with roofline metadata and auto-generated determinism twins." },
  // L1 BEDROCK
  { name: "fs-ad", layer: "L1", blurb: "Forward-mode duals, the Real trait, gradient checks, implicit-function adjoint hooks, and revolve checkpointing." },
  { name: "fs-cheb", layer: "L1", blurb: "Adaptive 1D Chebyshev, Lobatto points, differentiation matrices, and Orr–Sommerfeld growth rates." },
  { name: "fs-fft", layer: "L1", blurb: "Complex and real FFTs, DCT-II/III, Stockham structure, and transform conformance." },
  { name: "fs-ivl", layer: "L1", blurb: "What the word Certified means: outward-rounded intervals, affine arithmetic, Taylor models, Newton / Krawczyk, and exact geometric predicates." },
  { name: "fs-la", layer: "L1", blurb: "Dense BLIS-style GEMM, batched small-dense, factorizations, mixed precision, eigensolvers, and randomized NLA." },
  { name: "fs-rand", layer: "L1", blurb: "Counter-based Philox streams keyed by logical identity, Sobol / Owen QMC, lattice rules, and distributions." },
  { name: "fs-sparse", layer: "L1", blurb: "COO / CSR / BSR / SELL formats, deterministic assembly, SpMV / SpMM, Chebyshev smoothers, ILU0, PCG, and smoothed-aggregation AMG." },
  { name: "fs-spectral", layer: "L1", blurb: "Spectral health monitoring (addendum Proposal 5): track the sheaf-Laplacian lambda-gap as a runtime health metric with hysteresis." },
  { name: "fs-symmetry", layer: "L1", blurb: "Symmetry harvesting (addendum Proposal 13): detect cyclic symmetry with a certified asymmetry residual." },
  { name: "fs-tropical", layer: "L1", blurb: "Tropical (max-plus) critical-path analytics (fs-tropical): task-DAG timing in the max-plus semiring." },
  // L2 MORPH
  { name: "fs-asbuilt", layer: "L2", blurb: "As-built ingestion: reality as another chart (addendum Proposal 11)." },
  { name: "fs-conform", layer: "L2", blurb: "Restriction-map plugin conformance SDK (addendum Proposal 7): third-party chart-to-chart converters are certified into tiers." },
  { name: "fs-fmm", layer: "L2", blurb: "Kernel-independent black-box FMM: Chebyshev interpolation operators on octrees (P2M/M2M/M2L/L2L/L2P), direct near field." },
  { name: "fs-ga", layer: "L2", blurb: "Geometric algebra: PGA Cl(3,0,1) motors / screws and CGA Cl(4,1), with const-evaluated multiplication tables." },
  { name: "fs-geom", layer: "L2", blurb: "The Region / Chart abstraction, chart-agreement as a checkable proposition, the Rep Router, and sheaf certificates." },
  { name: "fs-io", layer: "L2", blurb: "Import / export with quarantine: dirty geometry lands as Quarantined and only promotes to Evidence after repair + validity." },
  { name: "fs-mesh", layer: "L2", blurb: "Incremental Delaunay / tet scaffolding, exact audits, quality refinement, metric fields, and remeshing." },
  { name: "fs-query", layer: "L2", blurb: "Uniform geometry queries across chart types: closest point, sphere-trace raycast, offsets, certified clearance, and curvature." },
  { name: "fs-rep-frep", layer: "L2", blurb: "CSG / F-rep builders, differentiable R-function Booleans, and interval / Lipschitz / gradient evaluators." },
  { name: "fs-rep-mesh", layer: "L2", blurb: "Half-edge surfaces, oriented tet complexes, soup repair, generalized winding numbers, dual contouring, and quality." },
  { name: "fs-rep-neural", layer: "L2", blurb: "Neural implicit charts (fs-rep-neural): small coordinate MLPs as shapes (DeepSDF-style) with SPECTRAL-NORM/Lipschitz-constrained layers." },
  { name: "fs-rep-nurbs", layer: "L2", blurb: "Rational B-spline charts with exact knot insertion & degree elevation (i128 rationals), trimmed patches, and certified closest-point." },
  { name: "fs-rep-sdf", layer: "L2", blurb: "Dense tiled SDF grids, the FrankenVDB sparse tree, adaptive octree SDF, narrow-band, and SDF charts." },
  { name: "fs-rep-voxel", layer: "L2", blurb: "Occupancy / multi-material voxel charts on VDB, exact Euclidean distance transforms, point clouds, and lattice graphs." },
  { name: "fs-shapeprog", layer: "L2", blurb: "Generative geometry program synthesis (fs-shapeprog): a typed constructive-geometry DSL with SDF semantics." },
  { name: "fs-topo", layer: "L2", blurb: "Validity & topology certificates: manifoldness, self-intersection proofs (exact orient3d), and cubical Betti numbers." },
  { name: "fs-xform", layer: "L2", blurb: "FFD lattices, RBF morphs, level-set velocity bands, SIMP density fields, composed parameterizations, and foldover detection." },
  // L3 FLUX
  { name: "fs-adjoint", layer: "L3", blurb: "Gradient truth: IFT discrete adjoints through solvers, time-dependent adjoints under revolve checkpointing, Hadamard shape gradients." },
  { name: "fs-bem", layer: "L3", blurb: "Laplace BEM panel methods: 3D exterior potential flow with FMM-accelerated GMRES, 2D Hess-Smith airfoils with Kutta condition and adjoint gradients." },
  { name: "fs-contract", layer: "L3", blurb: "Assume-guarantee component contracts (addendum Proposal E): certified design motifs." },
  { name: "fs-couple", layer: "L3", blurb: "Multiphysics composition through port-Hamiltonian Dirac structures (fs-couple): partitioned coupling that is PASSIVE BY CONSTRUCTION." },
  { name: "fs-cutfem", layer: "L3", blurb: "CutFEM on SDFs: certified cut-cell classification, cut quadrature with error control, ghost-penalty stabilization, aggregation fallback." },
  { name: "fs-dd", layer: "L3", blurb: "Domain decomposition: BDDC substructuring with corners-primal coarse spaces, sheaf-harmonic edge enrichment (Bet 11's second consumer)." },
  { name: "fs-dwr", layer: "L3", blurb: "Dual-weighted-residual goal-oriented adaptivity: enriched-adjoint DWR estimates, Doerfler marking, octree h-refinement loops." },
  { name: "fs-feec", layer: "L3", blurb: "Exterior-calculus core: cochains on complexes, exact integer incidence d, Hodge stars / Whitney masses, and grad→curl→div identities to machine precision." },
  { name: "fs-flux", layer: "L3", blurb: "Incompressible Navier-Stokes, FEEC-native: H(div)-conforming RT0 velocities (exactly divergence-free, pressure-robust), interior-penalty viscous DG." },
  { name: "fs-iface", layer: "L3", blurb: "Interface types and a coupling-graph checker: Arnold's FEEC periodic table as a type lattice; illegal couplings become compile-time rejections." },
  { name: "fs-iga", layer: "L3", blurb: "Isogeometric analysis (fs-iga): Galerkin directly on B-spline spaces." },
  { name: "fs-ladder", layer: "L3", blurb: "The fidelity-ladder registry: ordered rungs per kernel (correlation → RANS → LES) with typed prolongation / restriction." },
  { name: "fs-lbm", layer: "L3", blurb: "Lattice Boltzmann core (fs-lbm): a D2Q9 BGK stream-and-collide solver with Guo body forcing and halfway bounce-back walls." },
  { name: "fs-material", layer: "L3", blurb: "Constitutive-law kernel: elastic, hyperelastic, J2 plasticity, Mander concrete / Menegotto–Pinto steel, with consistent tangents." },
  { name: "fs-opdsl", layer: "L3", blurb: "A typed operator IR: one symbolic definition yields residual, JVP, VJP / adjoint, DWR indicators, and MMS studies. A kernel-generating algebra." },
  { name: "fs-probe", layer: "L3", blurb: "Discrepancy probes + budget pie (addendum Proposal 3): runs adjacent-rung model-form probes over the fidelity-ladder registry." },
  { name: "fs-regime", layer: "L3", blurb: "Physics-regime & nondimensionalization: which solver is even valid here? Buckingham-π groups, scaling maps, and alternatives-ranked refusals." },
  { name: "fs-scenario", layer: "L3", blurb: "A boundary-condition & load-case algebra: what is being done to it? as a typed, dimensioned value with frames and stochastic ensembles." },
  { name: "fs-solid", layer: "L3", blurb: "Elasticity core: small-strain and finite-strain hyperelasticity (via fs-material), locking-free B-bar, body-fitted and CutFEM frontends." },
  { name: "fs-solver", layer: "L3", blurb: "Matrix-free Krylov (CG / MINRES / GMRES) plus p-multigrid: resumable, cancellable, deterministic, and adjoint-equipped by construction." },
  { name: "fs-time", layer: "L3", blurb: "Structure-preserving integrators: symplectic Verlet, Lie-group SE(3) / SO(3), generalized-α, IMEX / exponential, with adjoints." },
  { name: "fs-verify", layer: "L3", blurb: "The certified-speculation verifier: an equilibrated-flux (Prager–Synge) a-posteriori accept test that stamps candidates verified or fails closed." },
  { name: "fs-vpm", layer: "L3", blurb: "Vortex particle method (fs-vpm): 2-D inviscid vortex dynamics by direct desingularized Biot-Savart induction and RK4 advection." },
  // L4 ASCENT
  { name: "fs-archive", layer: "L4", blurb: "Quality-diversity archives (fs-archive): MAP-Elites and CVT illumination archives that ILLUMINATE a behavior space." },
  { name: "fs-ascent", layer: "L4", blurb: "The gradient-based optimizer stack: L-BFGS with strong-Wolfe search, trust-region Newton-Krylov (Steihaug)." },
  { name: "fs-assimilate", layer: "L4", blurb: "Data assimilation: validation as a living belief (addendum Proposal 11)." },
  { name: "fs-bo", layer: "L4", blurb: "Bayesian optimization: Matern-family Gaussian processes with QMC-multistart hyperparameter fitting, EI/q-EI acquisitions, and deterministic BO loops." },
  { name: "fs-constraint", layer: "L4", blurb: "A constraint calculus with semantics: Hard / Soft / Chance / Robust / Certification / Fabrication kinds, evidence-typed violations, and minimal unsat cores." },
  { name: "fs-dfo", layer: "L4", blurb: "Derivative-free engines: CMA-ES as a natural-gradient flow, BIPOP restarts, and Nelder–Mead, all deterministic from seed and cross-ISA golden-hashed." },
  { name: "fs-dimine", layer: "L4", blurb: "Dimensional knowledge mining (addendum Proposal 9): fit closed-form power-law scaling laws over a certified corpus in dimensionless-group." },
  { name: "fs-eproc", layer: "L4", blurb: "Betting e-processes, pairwise races, Gaussian-mixture confidence sequences, and e-Benjamini–Hochberg for anytime-valid stopping." },
  { name: "fs-fab", layer: "L4", blurb: "Manufacturing, fabrication, and code compliance as its own layer (fs-fab): optimization without fabrication semantics produces fantasy artifacts." },
  { name: "fs-geocon", layer: "L4", blurb: "First-class manufacturability constraints: min-thickness (the anti-paperclip constraint), draft angle, symmetry-by-construction, and keep-out envelopes." },
  { name: "fs-opt", layer: "L4", blurb: "The optimization problem IR: typed objective / constraint graphs over manifold variables, with the Goodhart guard." },
  { name: "fs-robust", layer: "L4", blurb: "Objective epistemics (addendum Proposal F): apply the three colors to the GOAL itself." },
  { name: "fs-sos", layer: "L4", blurb: "Proof-carrying optimization (fs-sos): sum-of-squares certificates as executable PROOFS of polynomial lower bounds." },
  { name: "fs-surrogate", layer: "L4", blurb: "Learned accelerators with guarantees (fs-surrogate): classical reduced-order models permitted ONLY inside certified validity bands." },
  { name: "fs-toleralloc", layer: "L4", blurb: "Adjoint-driven tolerance allocation (addendum Proposal 11's commercial kicker): spend tight manufacturing tolerances." },
  { name: "fs-topols", layer: "L4", blurb: "Level-set topology optimization: WENO narrow-band advection, fast-iterative-method redistancing, normal velocity extension." },
  { name: "fs-topopt", layer: "L4", blurb: "Density-based topology optimization: SIMP with Helmholtz filtering, Heaviside projection, exact chain-rule sensitivities." },
  { name: "fs-truss", layer: "L4", blurb: "Ground-structure truss layout optimization: fnx candidate graphs, PDHG plastic-design LP with duality-gap certificates." },
  { name: "fs-uq", layer: "L4", blurb: "Uncertainty quantification: Karhunen-Loeve random fields with captured-variance evidence, polynomial chaos by regression, QMC propagation." },
  { name: "fs-voi", layer: "L4", blurb: "Value-of-information and active validation (fs-voi): the strategic layer deciding what information to acquire next." },
  // L5 LUMEN
  { name: "fs-img", layer: "L5", blurb: "Deterministic PNG / OpenEXR image plumbing, film / display transforms, and bias-labeled denoising for the render lane." },
  { name: "fs-render", layer: "L5", blurb: "Unbiased spectral path-tracing core (fs-render): the verifiable Monte-Carlo foundations." },
  { name: "fs-viz", layer: "L5", blurb: "Scientific visualization (fs-viz): the topological summaries that make a 10^8-cell field legible to an agent in one image." },
  // L6 HELM
  { name: "fs-bisect", layer: "L6", blurb: "Physics-VCS bisect (addendum Proposal 10): git-bisect for a wrong number." },
  { name: "fs-checker", layer: "L6", blurb: "The standalone evidence-package checker (addendum Proposal 12): an independently distributable verifier that re-verifies a package's completeness." },
  { name: "fs-frame", layer: "L6", blurb: "Flagship 2 (plan 15.2): the seismic-minimal building frame - ground-structure layout LP with duality certificates, code-checked sizing." },
  { name: "fs-ir", layer: "L6", blurb: "FrankenScript, the system's one true interface: a typed, versioned IR with isomorphic s-expr + JSON syntaxes and structured errors that teach." },
  { name: "fs-ledger", layer: "L6", blurb: "The Design Ledger on FrankenSQLite: content-addressed artifacts, event-sourced ops, lineage, tune cache, and time-travel / explain()." },
  { name: "fs-marquee", layer: "L6", blurb: "The P2 marquee demo: shape/topology optimization on a raw SDF with no mesh in the loop." },
  { name: "fs-package", layer: "L6", blurb: "Machine-checkable evidence packages (addendum Proposal 12): a content-addressed Merkle bundle of color-typed claims + provenance." },
  { name: "fs-plan", layer: "L6", blurb: "Per-operator error & cost models, the Error Ledger / Time Ledger attribution trees, and a plan-cost oracle rebuilt from tune records." },
  { name: "fs-recompute", layer: "L6", blurb: "A content-addressed Merkle DAG with per-node slack = tolerance − achieved error, for certified-skip incremental recomputation." },
  { name: "fs-report", layer: "L6", blurb: "Automatic lab notebooks + semantic design diffs (fs-report): every study emits a deterministic, content-addressed." },
  { name: "fs-roofline", layer: "L6", blurb: "Machine-axis probing, kernel specs, the roofline registry, a measurement harness, and staleness checks." },
  { name: "fs-session", layer: "L6", blurb: "Sessions, capability tokens, an enforcing resource governor, idempotency keys, and estimate() dry runs." },
  { name: "fs-spececo", layer: "L6", blurb: "Certified-speculation accept/reject economics (addendum Proposal 9): the decision rule." },
  { name: "fs-vskeleton", layer: "L6", blurb: "The vertical skeleton: a deliberately tiny SDF → PDE → objective → adjoint → optimize → ledger → replay demonstrator." },
  { name: "fs-wasm", layer: "L6", blurb: "Browser (WASM) surface over FrankenSim's pure numerical leaves — real math in the browser, no mocks." },
];

// ---------------------------------------------------------------------------
//  Feature cards — "Built Different"
// ---------------------------------------------------------------------------

export const features: Feature[] = [
  { title: "Certificates ride inside values", icon: "shield", category: "Evidence", description: "Every result is an Evidence<T>: a value plus four uncertainty slices (numerical, statistical, model-form, sensitivity) that compose conservatively. The value carries a proof of its own bound." },
  { title: "The three-color type system", icon: "layers", category: "Epistemics", description: "Every quantity is verified (interval-certified), validated (anchored to experiment), or estimated. Type-checked composition means an estimate can never be laundered into a certificate." },
  { title: "Determinism by construction", icon: "gitCommit", category: "Substrate", description: "Bit-identical across runs, thread counts, and ISAs. Fixed-shape reduction trees, counter-based RNG keyed by logical identity, and compensated summation make reproducibility a side effect." },
  { title: "Adjoint-native gradients", icon: "activity", category: "Differentiation", description: "Differentiate through the solution via the implicit function theorem, not through solver iterations. Gradient checks are a merge gate, not an afterthought." },
  { title: "Geometry as Region + Chart", icon: "boxes", category: "Morph", description: "A Region is abstract; Charts (SDF, mesh, F-rep, NURBS, voxel) present it. The Rep Router solves a Pareto shortest path over conversions, respecting your error budget and emitting a certificate." },
  { title: "CutFEM on a raw SDF", icon: "grid", category: "Flux", description: "FEM-grade physics directly on a level set (ghost penalty, Nitsche BCs, certified cut cells) with zero meshing in the loop. The marquee bridge between geometry and physics." },
  { title: "Anytime-valid statistics", icon: "lineChart", category: "Ascent", description: "e-processes and confidence sequences give valid inference under continuous peeking and optional stopping. Race candidate designs and stop the moment the evidence is decisive." },
  { title: "The Design Ledger", icon: "database", category: "Helm", description: "Content-addressed artifacts, event-sourced operations, and explain(artifact) turn a six-month campaign into a database you can query instead of a directory you fear. Time-travel and forkable worlds included." },
  { title: "Roofline-honest kernels", icon: "gauge", category: "Performance", description: "Every kernel ships its arithmetic-intensity analysis against machine peak. Targets are stated so they can be failed: GEMM ≥ 75% of peak, SpMV ≥ 85% of STREAM, LBM ≥ 1.0 GLUP/s." },
  { title: "Structure-preserving physics", icon: "gitMerge", category: "Flux", description: "Exact discrete de Rham (d∘d = 0), symplectic and Lie-group integrators, and power-conserving ports. Preserve the mathematics instead of resolving it away." },
  { title: "Certified speculation", icon: "zap", category: "The Flywheel", description: "Untrusted fast proposers generate candidates; a cheap certified verifier accepts them or fails closed. Machine learning proposes; certified numerics disposes." },
  { title: "Pure, safe, Franken-only", icon: "package", category: "Foundations", description: "One memory-safe Rust workspace, zero runtime dependencies outside the Franken constellation. Unsafe lives only in audited leaf capsules under 300 lines, each behind a safe façade." },
];

// ---------------------------------------------------------------------------
//  The three flagship pipelines — the forcing functions
// ---------------------------------------------------------------------------

export const flagships: Flagship[] = [
  {
    id: "aircraft",
    name: "Ornithoid Aircraft",
    tagline: "A certified Pareto atlas for a bird-like flyer",
    color: "#3b82f6",
    icon: "plane",
    description: "A multi-inlet, bird-like aircraft optimized jointly for lift-to-drag, stability, and maneuverability across a flight envelope.",
    objective: "maximize L/D × stability × maneuverability",
    methods: ["BEM + FMM + Kutta", "vortex-particle wakes", "Dirac-structure coupling", "SE(3) integrators", "Koopman surrogates"],
    payoff: "delivers a certified Pareto atlas with SOS Lyapunov region-of-attraction proofs.",
  },
  {
    id: "frame",
    name: "Seismic-Minimal Frame",
    tagline: "Least material, provable fragility",
    color: "#f59e0b",
    icon: "building",
    description: "A building frame that uses the minimum material while carrying a certified seismic fragility curve, the anti-paperclip constraint made real.",
    objective: "minimize material subject to a certified fragility bound",
    methods: ["IGA + Kirchhoff–Love shells", "fiber beams", "ground-structure PDHG", "Kanai–Tajimi + MLMC", "e-stopping"],
    payoff: "a fragility curve with anytime-valid stopping; you stop the moment the evidence is decisive.",
  },
  {
    id: "vessel",
    name: "The Spout That Never Dribbles",
    tagline: "A laminar-pour vessel, rendered from the same bytes",
    color: "#06b6d4",
    icon: "droplets",
    description: "A pouring vessel shaped so its stream stays laminar: an Orr–Sommerfeld stability objective validated against a free-surface LBM pour.",
    objective: "maximize pour stability (minimize spectral growth)",
    methods: ["Orr–Sommerfeld stability", "free-surface LBM", "Carreau rheology", "spectral rendering"],
    payoff: "the marketing shot and the physics are the same bytes: a differentiable render of the certified design.",
  },
];

// ---------------------------------------------------------------------------
//  Roadmap — Gauntlet-gated phases (PV → P6)
// ---------------------------------------------------------------------------

export const phases: Phase[] = [
  { id: "PV", name: "Vertical Skeleton", window: "Proven", status: "done",
    scope: "A tiny 2D SDF → PDE → objective → adjoint → optimize → replay demonstrator.",
    exit: "The typed continuum runs end-to-end and replays bit-for-bit." },
  { id: "P0", name: "Bedrock", window: "Weeks 0–6", status: "done",
    scope: "Substrate, two-lane executor, alloc, la, sparse, fft, ivl, rand, ledger v0.",
    exit: "G0 + G4 green; GEMM / SpMV / FFT within 80% of targets on both ISAs; deterministic mode bit-stable." },
  { id: "P1", name: "Geometry + Eyes", window: "Weeks 6–14", status: "done",
    scope: "geom, SDF / F-rep / mesh charts, Rep Router v1, dual contouring, Delaunay, the Lumen preview tracer.",
    exit: "Chart round-trips certified; watertightness vs. a ray-parity oracle; sphere-traced turntables at target ray rates." },
  { id: "P2", name: "Elasticity + First Optimization", window: "Weeks 14–24", status: "active",
    scope: "FEEC elasticity, CutFEM-on-SDF, matrix-free p-MG + AMG, adjoints, SIMP.",
    exit: "Marquee demo: topology optimization on a raw SDF (no mesh in the loop) with a composed error certificate." },
  { id: "P3", name: "Fluids I", window: "Weeks 24–34", status: "planned",
    scope: "LBM (cumulant, sparse, free-surface), the lattice-scaling assistant, thermal, non-Newtonian.",
    exit: "Cavity / TGV / cylinder benchmarks green; GLUP/s targets met; the first spout pours end-to-end." },
  { id: "P4", name: "Structures at Scale", window: "Weeks 34–44", status: "planned",
    scope: "IGA + Kirchhoff–Love shells, fiber beams, ground-structure PDHG, Kanai–Tajimi + MLMC + e-stop.",
    exit: "Frame flagship v1: fragility with anytime-valid stopping; the NAFEMS shell suite green." },
  { id: "P5", name: "Aero Stack", window: "Weeks 44–56", status: "planned",
    scope: "BEM + FMM + Kutta, vortex particles, Dirac coupling, SE(3) integrators, Koopman surrogates.",
    exit: "Ornithoid flagship v1: a live, e-raced Pareto front." },
  { id: "P6", name: "Certificates & Self-Optimization", window: "Weeks 56–68", status: "planned",
    scope: "SOS / Lasserre SDP, sheaf certificates, conformal e-prediction, the self-optimizing planner, differentiable rendering.",
    exit: "Moonshot features pass certification or ship flagged-off; the planner beats hand-tuned allocation." },
];

// ---------------------------------------------------------------------------
//  Comparison — FrankenSim vs the archipelago
// ---------------------------------------------------------------------------

export const comparisonData: ComparisonRow[] = [
  { feature: "Language & memory model", frankensim: "One safe Rust", comsol: "C / Java GUI", openfoam: "C++", scipy: "Python + C/Fortran" },
  { feature: "Evidence inside values", frankensim: "Certified<T>", comsol: "No", openfoam: "No", scipy: "No" },
  { feature: "Error bounds cross tools", frankensim: "Composed ledger", comsol: "Per-solver", openfoam: "Manual", scipy: "None" },
  { feature: "Provenance / replay", frankensim: "Content-addressed", comsol: "Project file", openfoam: "Case dir", scipy: "Ad hoc" },
  { feature: "Determinism", frankensim: "Bit-identical", comsol: "Best-effort", openfoam: "MPI-dependent", scipy: "BLAS-dependent" },
  { feature: "Cancellation", frankensim: "≤ 200 µs, structured", comsol: "Kill process", openfoam: "Kill process", scipy: "Kill process" },
  { feature: "Geometry ↔ physics", frankensim: "CutFEM on SDF", comsol: "Mesh required", openfoam: "Mesh required", scipy: "External" },
  { feature: "Gradients", frankensim: "Adjoint-native", comsol: "Add-on", openfoam: "adjoint solver", scipy: "autograd (external)" },
  { feature: "Anytime-valid stats", frankensim: "e-processes", comsol: "No", openfoam: "No", scipy: "Fixed-sample" },
  { feature: "Meshing in the loop", frankensim: "Optional", comsol: "Required", openfoam: "Required", scipy: "n/a" },
  { feature: "Agent-first API", frankensim: "FrankenScript IR", comsol: "GUI / Java", openfoam: "dict files", scipy: "Python" },
  { feature: "Runtime dependencies", frankensim: "Franken-only", comsol: "Proprietary", openfoam: "MPI stack", scipy: "NumPy / SciPy stack" },
];

// ---------------------------------------------------------------------------
//  Code examples
// ---------------------------------------------------------------------------

// FrankenScript — the agent-facing interface (units, seeds, budgets inline)
export const codeExampleStudy = `(study "spout-laminar-v3"
  (seed 0x5EED0001) (versions (constellation :lock "2026-07"))
  (budget (wall 2h) (mem 96GiB) (qoi-rel-error 2e-2))

  ; geometry: a revolved Chebyshev profile with a filleted lip
  (let vessel (frep (revolve (cheb-profile "body.chb"))
                    (fillet :edge lip :r 3mm)))

  ; physics: a free-surface pour, tilted over 3 seconds
  (let pour (flux.free-surface-lbm vessel
              (fluid :model (carreau :mu0 0.12Pa*s :n 0.8) :sigma 0.061N/m)
              (schedule :rate 0.5L/s :tilt (ramp 0deg 65deg 3s))))

  ; optimize the lip lever for pour stability, stop when decisive
  (ascent.optimize J :over lever :method (lbfgs :m 17)
    :until (any (grad-norm 1e-5) (e-value 20) (budget-exhausted))
    :emit (pareto ledger report)))`;

// Deterministic sparse assembly — a real, working API
export const codeExample = `use fs_sparse::{Coo, Csr};

// Assemble a 1-D Laplacian, deterministically.
let mut coo = Coo::new(3, 3);
coo.push(0, 0,  2.0);
coo.push(0, 1, -1.0);
coo.push(1, 0, -1.0);
coo.push(1, 1,  2.0);
coo.push(1, 2, -1.0);
coo.push(2, 1, -1.0);
coo.push(2, 2,  2.0);

let csr: Csr = coo.assemble();      // fixed-shape, order-independent
let mut y = vec![0.0; 3];
csr.spmv(&[1.0, 2.0, 3.0], &mut y); // bit-identical on 1 or 96 cores
assert_eq!(y, vec![0.0, 0.0, 4.0]);`;

// Evidence-carrying values
export const codeExampleEvidence = `use fs_evidence::{Evidence, ProvenanceHash};

let provenance = ProvenanceHash::of_bytes(b"laplacian kernel output");

// A value that knows how it was made — and proves its own bound.
let drag = Evidence::exact(12.47, provenance)
    .certified()                       // interval-certified numerics
    .expect("exact pure-math evidence is certifiable");

assert_eq!(drag.value, 12.47);
// drag carries: value + interval bound + provenance + adjoint hook + cancel scope`;

// Structured, teaching error — a refusal that teaches
export const codeExampleError = `{
  "error": "BudgetInfeasible",
  "stage": "flux.lbm",
  "need": { "wall": "5.1h" },
  "have": { "wall": "2h" },
  "fixes": [
    { "action": "relax qoi-rel-error to 4e-2", "est_wall": "1.7h", "est_qoi_impact": "+1.8e-2" },
    { "action": "surrogate screen, certify top-4 only", "est_wall": "1.9h" }
  ]
}`;

// ---------------------------------------------------------------------------
//  Build log / changelog
// ---------------------------------------------------------------------------

export const changelog: ChangelogEntry[] = [
  { period: "PV", title: "The Vertical Skeleton", items: [
    "Proved the typed continuum end-to-end: 2D SDF → PDE → objective → adjoint → optimize → replay",
    "Established the Cx execution context and the Design Ledger v0",
    "Locked the Franken constellation by hash",
  ]},
  { period: "P0", title: "Bedrock: the numerical floor", items: [
    "BLIS-style GEMM, batched small-dense, sparse formats with deterministic assembly, FFT",
    "Certified interval / Taylor arithmetic and exact geometric predicates",
    "Counter-based Philox RNG and QMC keyed by logical identity",
    "Two-lane executor with ≤ 200 µs latency-to-cancel; G0 + G4 green",
  ]},
  { period: "P1", title: "Geometry + Eyes", items: [
    "The Region / Chart abstraction and the Rep Router over SDF / mesh / F-rep / NURBS / voxel",
    "Dual contouring, incremental Delaunay, generalized winding numbers, certified round-trips",
    "The Lumen preview tracer: sphere-traced turntables at target ray rates",
  ]},
  { period: "P2", title: "Elasticity + First Optimization", items: [
    "FEEC elasticity, CutFEM-on-SDF, matrix-free p-multigrid + smoothed-aggregation AMG",
    "Adjoint-native gradients with a merge-gate gradient check; SIMP density fields",
    "The marquee: topology optimization on a raw SDF with a composed error certificate",
  ]},
  { period: "Addendum", title: "The Epistemic Engine", items: [
    "The three-color ledger, falsifier pairing, the Goodhart guard, and tombstones",
    "Incremental recomputation with certified skip; version control for physics",
    "Certified speculation, the sole research bet, verified by equilibrated-flux bounds",
  ]},
];

// ---------------------------------------------------------------------------
//  Glossary
// ---------------------------------------------------------------------------

export const glossaryTerms: GlossaryTerm[] = [
  { term: "Region", short: "An abstract measurable subset of ℝ³", long: "The founding move of the geometry kernel. A Region is an abstract subset of space that is never stored directly; it is only ever presented by Charts. Physics, optimization, and rendering all speak about Regions, so no single representation is privileged." },
  { term: "Chart", short: "A concrete representation of a Region", long: "A concrete presentation of a Region: an SDF grid, a half-edge mesh, an F-rep CSG tree, a NURBS patch, a voxel field, or a neural field. Charts of the same Region must agree; chart agreement is a checkable proposition, not a hope." },
  { term: "Rep Router", short: "Pareto shortest path over chart conversions", long: "Given a Region in one Chart and a task that needs another, the Rep Router solves a Pareto shortest-path problem over the graph of chart-to-chart conversions, choosing the cheapest chain that respects the error budget. Every conversion emits a certificate." },
  { term: "Evidence<T>", short: "A value plus its uncertainty and provenance", long: "The core wrapper. Evidence<T> (and its certified refinement Certified<T>) carries a value plus four uncertainty slices (numerical, statistical, model-form, and sensitivity) that compose conservatively, together with a provenance hash, an adjoint hook, and a cancellation scope. A result always knows how it was made." },
  { term: "The Three Colors", short: "verified / validated / estimated", long: "FrankenSim's epistemic type system. A quantity is verified (its bounds are proven by interval-certified numerics), validated (anchored to experimental data within a stated regime), or estimated (best-effort). Composition is type-checked so an estimate can never be laundered into a certificate, and a validated value auto-demotes to estimated the instant it leaves its regime." },
  { term: "The Five Explicits", short: "units, seeds, budgets, versions, capabilities", long: "The five things that are never implicit in FrankenSim. Every operation states its units, its random seeds, its accuracy/time/memory budgets, the versions of the kernels it used, and the capabilities it was granted. This is what makes the system safe for an agent swarm to drive." },
  { term: "The Decalogue", short: "The ten non-negotiable principles", long: "P1–P10: pure safe Rust; determinism as a feature; differentiable-or-certifiable; budgets first; structure over brute force; matrix-free and roofline-honest; cancellation-correct; one data model; provenance-complete; agent-first ergonomics." },
  { term: "The Gauntlet", short: "The tiered correctness program (G0–G5)", long: "The graded suite every merge must pass: G0 property and algebraic-law tests; G1 manufactured solutions and order verification (the build fails if the observed convergence slope deviates from theory by more than 0.2); G2 canonical benchmarks; G3 metamorphic tests; G4 chaos and cancellation storms; G5 determinism and cross-ISA divergence audits, plus certifying the certifiers." },
  { term: "FrankenScript", short: "The one true interface (typed IR)", long: "The typed, versioned intermediate representation that agents and humans use to drive FrankenSim. It has isomorphic s-expression and JSON syntaxes, an inspectable lowering trace, and structured errors that include ranked fixes. A refusal that teaches." },
  { term: "The Design Ledger", short: "The FrankenSQLite system of record", long: "Built on FrankenSQLite: content-addressed artifacts, event-sourced operations (the Five Explicits), lineage, metrics, a tune cache, and tombstones, all with time-travel, forkable worlds, and explain(artifact). It makes a six-month campaign a database you can query instead of a directory you fear." },
  { term: "Error Ledger / Time Ledger", short: "End-to-end attribution of error and seconds", long: "Two attribution trees that compose per-operator error and cost models across an entire plan, so every digit of uncertainty and every second of wall-clock can be traced to the operation that produced it." },
  { term: "Two-Lane Executor", short: "Latency lane + throughput lane", long: "The heart of L0. A latency lane (async orchestration, ledger I/O, progress) runs alongside a throughput lane (a work-stealing fork-join pool whose units of work are tiles), targeting a bounded latency-to-cancel of ≤ 200 µs and supporting speculative races and resumable solvers." },
  { term: "Tile", short: "The unit of scheduling and determinism", long: "The atomic unit of work in the throughput lane: a cache-aligned block whose lifetime is a cancellation scope and whose reduction shape is fixed, making parallel results deterministic and cancellation prompt." },
  { term: "Cx", short: "The execution context", long: "The capability context threaded through every operation. Cx carries the cancel token, the arena, the Philox key, the budget, and the ledger handle, so nothing about how a computation runs is implicit." },
  { term: "Certified Speculation", short: "Untrusted proposers, a certified verifier", long: "The system's single research bet: cheap, possibly-wrong proposers (surrogates, coarse solves, ML) generate candidate answers, and a cheap certified verifier (an equilibrated-flux, a-posteriori accept test) either stamps a candidate verified or fails closed. Machine learning proposes; certified numerics disposes." },
  { term: "CutFEM-on-SDF", short: "FEM-grade physics on a level set", long: "The marquee bridge between geometry and physics: finite-element accuracy computed directly on a signed distance field, with certified cut cells, ghost penalty, and Nitsche boundary conditions. No body-fitted meshing in the loop." },
  { term: "The Sheaf View", short: "Watertightness as a vanishing cocycle", long: "Gluing is modeled with a cellular sheaf: watertightness of a surface is the vanishing of an interface cocycle (H¹ = 0), and merge conflicts classify as coboundary (auto-fixable) or harmonic (structural)." },
  { term: "FEEC", short: "Finite Element Exterior Calculus", long: "The physics formalism: cochains on complexes with exact integer incidence (d∘d = 0 to the bit), Whitney forms, and Hodge stars, giving a discrete de Rham complex that preserves grad → curl → div identities to machine precision." },
  { term: "Adjoint", short: "Differentiate through the solution", long: "FrankenSim computes gradients via the implicit function theorem, differentiating through the converged solution rather than unrolling solver iterations. Sensitivities are exact and cheap, and gradient checks gate every merge." },
  { term: "DWR", short: "Dual-Weighted Residual", long: "Goal-oriented adaptivity: refinement is driven by the residual weighted by the adjoint of the actual quantity of interest, so effort is spent where it changes the answer you care about." },
  { term: "e-process", short: "Anytime-valid evidence", long: "A betting martingale that stays statistically valid no matter when you stop or how often you peek. FrankenSim uses e-processes and confidence sequences to race candidate designs and stop the instant the evidence is decisive, under optional stopping." },
  { term: "Roofline-honest", short: "Every kernel states its intensity", long: "Each kernel ships its arithmetic-intensity analysis against measured machine peak, so its performance claim is a fraction of a roof rather than a bare number, and the targets are stated so they can be failed." },
  { term: "FrankenVDB", short: "The in-house sparse tile tree", long: "A sparse hierarchical grid (hash root → 32³ → bitmasked 8³ leaves) used for SDFs and voxel fields: narrow-band storage that keeps large volumes cheap." },
  { term: "Goodhart Guard", short: "Every optimum is an adversarial example", long: "A guard that treats every optimizer endpoint as a potential exploit of the model, re-verifying it out-of-band before it is trusted, because a measure that becomes a target stops being a good measure." },
  { term: "The Anti-Paperclip Constraint", short: "Minimum-thickness manufacturability", long: "The codebase's name for the minimum-thickness constraint: the steel-minimizing frame that ignores buckling is a paperclip, so manufacturability constraints are first-class citizens of the optimization, never a bolt-on." },
  { term: "Port-Hamiltonian", short: "Power-conserving multiphysics coupling", long: "Physics domains are coupled through Dirac structures that conserve power across the interface, so multiphysics energy accounting is correct by construction." },
  { term: "SIMP", short: "Solid Isotropic Material with Penalization", long: "The density-field parameterization behind topology optimization: a continuous material density per cell, penalized toward solid-or-void, differentiated through the physics via the adjoint." },
  { term: "The Franken Constellation", short: "The sibling pure-Rust libraries", long: "FrankenSim's only runtime dependencies: asupersync (structured concurrency), FrankenSQLite, FrankenNumpy, FrankenTorch, FrankenScipy, FrankenPandas, and FrankenNetworkx, all pure Rust, all locked by hash." },
  { term: "Ambition Tags", short: "[S] Solid · [F] Frontier · [M] Moonshot", long: "Every planned capability is tagged by risk: Solid features are well-understood engineering, Frontier features push the state of the art, and Moonshots may fail. Nothing Moonshot is allowed to gate anything Solid." },
  { term: "Tombstones", short: "A ledger of falsified hypotheses", long: "When a hypothesis is refuted, it is recorded as a tombstone so an agent swarm accumulates knowledge instead of rediscovering the same dead ends: memory for a system with none of its own." },
];

// ---------------------------------------------------------------------------
//  FAQ
// ---------------------------------------------------------------------------

export const faq: FaqItem[] = [
  { question: "What exactly is FrankenSim?", answer: "FrankenSim is a working Rust workspace for deterministic geometry, certified numerics, meshing, execution, evidence, and design-ledger infrastructure for simulation and design optimization. Its goal: given a physics-based objective and constraints, synthesize the geometry that optimizes it, faster, more correctly, and more verifiably than any existing system, on commodity many-core CPUs, in pure safe Rust." },
  { question: "Why fuse geometry, physics, optimization, and rendering into one system?", answer: "Because the seams between OpenCASCADE, gmsh, FEniCS/OpenFOAM, SciPy/Dakota, and ParaView are where correctness drowns. Derivatives don't cross tool boundaries; error bounds don't either; provenance doesn't exist; cancellation means kill -9; and the hardware is wasted by MPI-shaped codebases. FrankenSim makes derivatives, error bounds, budgets, provenance, and cancellation ride inside the values instead of living in six incompatible tools' heads." },
  { question: "What does 'it returns proofs, not just numbers' mean?", answer: "Every result is an Evidence<T>: a value plus a proven interval bound, a provenance hash, an adjoint hook, and a cancellation scope. Quantities are typed verified, validated, or estimated, and composition is checked so an estimate can never wear the badge of a certificate. A false certificate is worse than an ordinary wrong answer: it is a wrong answer wearing a badge, so the type system exists to prevent exactly that." },
  { question: "Is FrankenSim faster than the incumbents?", answer: "The plan states illustrative, failable targets: GEMM ≥ 75% of peak, SpMV ≥ 85% of STREAM bandwidth, LBM ≥ 1.0 GLUP/s on an M4 Max, and sphere-traced SDF rays ≥ 80 Mray/s, all measured with a roofline harness against real machine peak on both Apple Silicon and 96-core Threadripper. Speed is necessary but not the pitch: the pitch is justified belief at minimum cost." },
  { question: "Who is it for?", answer: "AI coding agents and swarms are the primary operator; the whole system is designed around the Five Explicits so a fleet can drive it safely. It also targets simulation-infrastructure engineers who want a deterministic, evidence-oriented Rust substrate, and design-optimization users producing optimal artifacts (aircraft, seismic frames, vessels) at lowest cost." },
  { question: "How is correctness actually enforced?", answer: "By the Gauntlet (G0–G5), which gates every merge: property tests, manufactured-solution order verification that fails the build if the convergence slope drifts more than 0.2 from theory, canonical benchmarks, metamorphic tests, chaos and cancellation storms, and determinism / cross-ISA audits. Repository policy is code too: xtask mechanically enforces the acyclic layer direction, Franken-only dependencies, contract presence, and unsafe-capsule registration." },
  { question: "What makes the architecture different from a COMSOL-style platform?", answer: "Composition as a first-class certified operation. Incumbents assume a human absorbs the seams between solvers; FrankenSim makes the seam itself a typed, certified value. Merely-decent kernels with impeccable epistemics can beat excellent kernels with folklore epistemics in the verticals that need certification-by-analysis." },
  { question: "Why Rust, and why memory-safe?", answer: "Rust is the only mainstream substrate strong enough to hold the typed continuum together without a garbage collector or a C ABI in the hot path. The Decalogue's first principle is pure, memory-safe Rust: unsafe exists only in audited leaf capsules under 300 lines, each behind a safe façade, and each registered with the policy checker." },
  { question: "How does an agent actually talk to it?", answer: "Through FrankenScript, a typed, versioned IR with isomorphic s-expression and JSON syntaxes. A program states its seed, versions, and budgets inline; the lowering trace is inspectable; and when a request is infeasible the error is structured and carries ranked fixes with estimated impact. A refusal that teaches is worth ten silent successes." },
  { question: "What are the flagship demos?", answer: "Three forcing functions: an ornithoid multi-inlet aircraft that delivers a certified Pareto atlas with Lyapunov region-of-attraction proofs; a seismic-minimal building frame with a certified fragility curve and anytime-valid stopping; and a laminar-pour vessel (the spout that never dribbles) where the marketing shot and the physics are literally the same bytes. Plus the P2 marquee: topology optimization on a raw SDF with no mesh in the loop." },
  { question: "Can I use it today?", answer: "FrankenSim is a large, working Rust workspace (100+ crates, 160K+ lines, 1,300+ inline tests) implementing a substantial spine of the plan. It is not yet a packaged end-user simulator: there is no stable public API, no CLI, and no crates.io release yet. If you need a ready-made production physics solver or GUI today, the incumbents still win; if you want a deterministic, evidence-oriented Rust substrate to build on, this is it." },
  { question: "How was it built?", answer: "Through an AI engineering flywheel, a coordinated swarm of specialized coding agents orchestrated with tmux, guarded by command-safety layers, tracked in a beads issue graph, and given persistent memory and session search. The same toolchain that built FrankenTUI and asupersync built FrankenSim." },
];

// ---------------------------------------------------------------------------
//  The AI Flywheel (shared toolchain that built FrankenSim)
// ---------------------------------------------------------------------------

export interface FlywheelTool {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  icon: string;
  color: string;
  href: string;
  features: string[];
  connectsTo: string[];
  connectionDescriptions: Record<string, string>;
  projectSlug?: string;
  demoUrl?: string;
  stars?: number;
}

export const flywheelDescription = {
  title: "The AI Flywheel",
  subtitle: "A high-velocity AI engineering ecosystem that built FrankenSim.",
  description:
    "FrankenSim's 100+ crates weren't written by hand. They were architected and implemented through a recursive feedback loop of specialized AI agents: orchestrated in parallel, guarded against destructive commands, coordinated through a shared task graph, and given persistent memory across sessions.",
};

export const flywheelTools: FlywheelTool[] = [
  { id: "ntm", name: "Named Tmux Manager", shortName: "NTM", href: "https://github.com/Dicklesworthstone/ntm", icon: "LayoutGrid", color: "from-sky-500 to-blue-600", tagline: "Multi-agent tmux orchestration", connectsTo: ["slb", "mail", "cass", "bv"], connectionDescriptions: { slb: "Routes dangerous commands through safety checks", mail: "Human Overseer messaging and file reservations", cass: "Duplicate detection and session history search", bv: "Dashboard shows beads status; --robot-triage for dispatch" }, stars: 133, projectSlug: "named-tmux-manager", features: ["Spawn 10+ Claude/Codex/Gemini agents in parallel", "Smart broadcast with type/variant/tag filtering", "60fps animated dashboard with health monitoring"] },
  { id: "slb", name: "Simultaneous Launch Button", shortName: "SLB", href: "https://github.com/Dicklesworthstone/slb", icon: "ShieldCheck", color: "from-red-500 to-rose-600", tagline: "Peer review for dangerous commands", connectsTo: ["mail", "ubs"], connectionDescriptions: { mail: "Notifications sent to reviewer inboxes", ubs: "Pre-flight scans before execution" }, stars: 56, projectSlug: "simultaneous-launch-button", features: ["Three-tier risk classification (CRITICAL/DANGEROUS/CAUTION)", "Cryptographic command binding with SHA256+HMAC", "Dynamic quorum based on active agents"] },
  { id: "mail", name: "MCP Agent Mail", shortName: "Mail", href: "https://github.com/Dicklesworthstone/mcp_agent_mail", icon: "Mail", color: "from-amber-500 to-yellow-600", tagline: "Inter-agent messaging & coordination", connectsTo: ["bv", "cm", "slb"], connectionDescriptions: { bv: "Task IDs link conversations to Beads issues", cm: "Shared context across agent sessions", slb: "Approval requests delivered to inboxes" }, stars: 1654, demoUrl: "https://dicklesworthstone.github.io/cass-memory-system-agent-mailbox-viewer/viewer/", projectSlug: "mcp-agent-mail", features: ["GitHub-flavored Markdown messaging between agents", "Advisory file reservations to prevent conflicts", "SQLite-backed storage for complete audit trails"] },
  { id: "bv", name: "Beads Viewer", shortName: "BV", href: "https://github.com/Dicklesworthstone/beads_viewer", icon: "GitBranch", color: "from-violet-500 to-purple-600", tagline: "Graph analytics for task dependencies", connectsTo: ["mail", "ubs", "cass"], connectionDescriptions: { mail: "Task updates trigger mail notifications", ubs: "Bug scanner results create blocking issues", cass: "Search prior sessions for task context" }, stars: 1211, demoUrl: "https://dicklesworthstone.github.io/beads_viewer-pages/", projectSlug: "beads-viewer", features: ["9 graph metrics: PageRank, Betweenness, Critical Path", "Robot protocol (--robot-*) for AI-ready JSON", "60fps TUI rendering via Bubble Tea"] },
  { id: "ubs", name: "Ultimate Bug Scanner", shortName: "UBS", href: "https://github.com/Dicklesworthstone/ultimate_bug_scanner", icon: "Bug", color: "from-orange-500 to-amber-600", tagline: "Pattern-based bug detection", connectsTo: ["bv", "slb"], connectionDescriptions: { bv: "Creates issues for discovered bugs", slb: "Validates code before risky commits" }, stars: 152, projectSlug: "ultimate-bug-scanner", features: ["1,000+ custom detection patterns across languages", "Consistent JSON output for all languages", "Perfect for pre-commit hooks and CI/CD"] },
  { id: "cm", name: "CASS Memory System", shortName: "CM", href: "https://github.com/Dicklesworthstone/cass_memory_system", icon: "Brain", color: "from-emerald-500 to-green-600", tagline: "Persistent memory across sessions", connectsTo: ["mail", "cass", "bv"], connectionDescriptions: { mail: "Stores conversation summaries for recall", cass: "Semantic search over stored memories", bv: "Remembers task patterns and solutions" }, stars: 212, demoUrl: "https://dicklesworthstone.github.io/cass-memory-system-agent-mailbox-viewer/viewer/", projectSlug: "cass-memory-system", features: ["Three-layer cognitive: episodic, working, procedural memory", "MCP tools for cross-session context persistence", "Built on top of CASS for semantic search"] },
  { id: "cass", name: "Coding Agent Session Search", shortName: "CASS", href: "https://github.com/Dicklesworthstone/coding_agent_session_search", icon: "Search", color: "from-cyan-500 to-sky-600", tagline: "Unified search across 11+ agent formats", connectsTo: ["cm", "ntm", "bv", "mail"], connectionDescriptions: { cm: "CM integrates CASS for memory retrieval", ntm: "Duplicate detection before broadcasting", bv: "Links search results to related tasks", mail: "Agents query history before asking colleagues" }, stars: 446, projectSlug: "cass", features: ["11 formats: Claude Code, Codex, Cursor, Gemini, ChatGPT, Aider, etc.", "Sub-5ms cached search, hybrid semantic + keyword", "Multi-machine sync via SSH with path mapping"] },
  { id: "acfs", name: "Flywheel Setup", shortName: "ACFS", href: "https://github.com/Dicklesworthstone/agentic_coding_flywheel_setup", icon: "Cog", color: "from-blue-500 to-indigo-600", tagline: "One-command environment bootstrap", connectsTo: ["ntm", "mail", "dcg"], connectionDescriptions: { ntm: "Installs and configures NTM", mail: "Sets up Agent Mail MCP server", dcg: "Installs DCG safety hooks" }, stars: 1006, projectSlug: "agentic-coding-flywheel-setup", features: ["30-minute zero-to-hero setup", "Installs Claude Code, Codex, Gemini CLI", "All flywheel tools pre-configured"] },
  { id: "dcg", name: "Destructive Command Guard", shortName: "DCG", href: "https://github.com/Dicklesworthstone/destructive_command_guard", icon: "ShieldAlert", color: "from-red-600 to-orange-600", tagline: "Intercepts dangerous shell commands", connectsTo: ["slb", "ntm"], connectionDescriptions: { slb: "Works alongside SLB for layered command safety", ntm: "Guards all commands in NTM-managed sessions" }, stars: 349, projectSlug: "destructive-command-guard", features: ["Intercepts rm -rf, git reset --hard, etc.", "SIMD-accelerated pattern matching", "Command audit logging"] },
  { id: "ru", name: "Repo Updater", shortName: "RU", href: "https://github.com/Dicklesworthstone/repo_updater", icon: "RefreshCw", color: "from-teal-500 to-cyan-600", tagline: "Multi-repo sync in one command", connectsTo: ["ubs", "ntm"], connectionDescriptions: { ubs: "Run bug scans across all synced repos", ntm: "NTM integration for agent-driven sweeps" }, stars: 49, features: ["One-command multi-repo sync", "Parallel operations with conflict detection", "AI code review integration"] },
  { id: "cass2", name: "X Archive Search", shortName: "XF", href: "https://github.com/Dicklesworthstone/xf", icon: "Archive", color: "from-indigo-500 to-violet-600", tagline: "Ultra-fast X/Twitter archive search", connectsTo: ["cass", "cm"], connectionDescriptions: { cass: "Similar search architecture and patterns", cm: "Found tweets can become memories" }, stars: 67, features: ["Sub-second search over large archives", "Semantic + keyword hybrid search", "Privacy-preserving local processing"] },
];

// ---------------------------------------------------------------------------
//  Reference machines (for the roofline / performance story)
// ---------------------------------------------------------------------------

export const machines = [
  { name: "Apple M4 Max", detail: "16-core (12P + 4E) · ~546 GB/s unified · 128-byte lines", perCore: "~34 GB/s per core" },
  { name: "Threadripper PRO 7995WX", detail: "96 cores · 12 CCDs × 32 MB L3 · AVX-512", perCore: "~3.4 GB/s per core" },
];

// ---------------------------------------------------------------------------
//  The project graph (from the beads issue tracker)
// ---------------------------------------------------------------------------

export interface Epic { title: string; group: string; color: string; blurb: string; }

export const beadsStats = {
  total: 248,
  features: 177,
  tasks: 45,
  epics: 17,
  milestones: 8,
  bugs: 1,
  open: 130,
  closed: 115,
  inProgress: 3,
  closedPct: 46,
  ambition: { S: 106, F: 84, M: 13 },
};

export const epics: Epic[] = [
  // The layered kernel stack
  { title: "L0 · SUBSTRATE", group: "Kernel Stack", color: "#64748b", blurb: "Hardware, execution, memory, determinism." },
  { title: "L1 · BEDROCK", group: "Kernel Stack", color: "#f59e0b", blurb: "Numerical foundations." },
  { title: "L2 · MORPH", group: "Kernel Stack", color: "#10b981", blurb: "The geometry kernel." },
  { title: "L3 · FLUX", group: "Kernel Stack", color: "#06b6d4", blurb: "The physics kernel." },
  { title: "L4 · ASCENT", group: "Kernel Stack", color: "#3b82f6", blurb: "The optimization kernel." },
  { title: "L5 · LUMEN", group: "Kernel Stack", color: "#a855f7", blurb: "Rendering & visualization." },
  { title: "L6 · HELM", group: "Kernel Stack", color: "#f97316", blurb: "Orchestration, ledger & agent interface." },
  // Cross-cutting programs
  { title: "Foundations", group: "Programs", color: "#22d3ee", blurb: "Workspace, constellation, CI, contracts, safety, vertical skeleton." },
  { title: "The Gauntlet", group: "Programs", color: "#a3e635", blurb: "The tiered correctness program G0–G5 + certifier trials." },
  { title: "Performance", group: "Programs", color: "#fbbf24", blurb: "Rooflines, machine-adaptive tuning, tropical analytics." },
  { title: "Flagship Pipelines", group: "Programs", color: "#f472b6", blurb: "Ornithoid aircraft, seismic frame, laminar vessel." },
  // Addendum research bets
  { title: "The Flywheel", group: "Research Bets", color: "#a855f7", blurb: "Speculation, incremental recompute, physics VCS, swarm memory." },
  { title: "Epistemic Type System", group: "Research Bets", color: "#22d3ee", blurb: "Three-color ledger, objective epistemics, falsifiers, Goodhart guard." },
  { title: "Differentiation & Reality", group: "Research Bets", color: "#3b82f6", blurb: "End-to-end adjoints, reality-as-a-chart, spacetime complex." },
  { title: "Structure & Self-Knowledge", group: "Research Bets", color: "#10b981", blurb: "Interface types + symmetry, spectral health, explanations, value-of-information." },
  { title: "Go-To-Market", group: "Research Bets", color: "#f97316", blurb: "The wedge and the conformance-tested plugin surface." },
  { title: "Epistemic Engine", group: "Research Bets", color: "#f43f5e", blurb: "Governance, phases, risks: an epistemic engine for physical claims." },
];

// ---------------------------------------------------------------------------
//  End-to-end campaigns (the /e2e page)
//
//  Each entry is a certified multi-crate pipeline: it composes FrankenSim
//  crates that were never designed to meet into one campaign that returns an
//  answer carrying its own evidence (a proof, a frontier, a stop rule, or a
//  credibility map) rather than a bare number. Prose distilled and expanded
//  from the crates' own raison-d'etre docs.
// ---------------------------------------------------------------------------

export interface E2ePillar { crate: string; role: string; }
export interface E2eCampaign {
  key: string; // matches the live demo component
  crate: string;
  layer: string;
  name: string;
  title: string;
  tagline: string;
  lede: string; // the task, the conventional approach, and where it stalls
  context: string; // why the gap is structural and why it bites in practice
  pillars: E2ePillar[];
  difference: string; // what FrankenSim does differently, and why it is hard or impossible elsewhere
  payoff: string; // what the certified result lets you actually do
  result: string;
  accent: string;
}

export const e2eCampaigns: E2eCampaign[] = [
  {
    key: "proofrobust",
    crate: "fs-robustopt-e2e",
    layer: "L4 · Ascent",
    name: "ProofRobust",
    title: "The proven optimum is not the robust one.",
    tagline: "SOS-certified global optima, ranked by worst-case robustness.",
    lede:
      "You run an optimizer and it hands back a point. Nothing tells you whether that point is the global best or a local dip, and nothing tells you what a fraction of a millimeter of manufacturing drift does to it. ProofRobust returns a design that answers both questions with the evidence attached.",
    context:
      "Those two questions usually live in different tools. Global optimality is the province of a global solver or a hand proof; robustness is a Monte-Carlo sweep or a chance-constraint model; the two rarely share a representation. So a team proves optimality for a nominal design, then discovers on the shop floor that a slightly perturbed copy loses to a rival it was supposed to beat. The gap is structural, not an oversight: a steep cost basin can hold the lowest nominal value and still be the fragile choice, and no amount of nominal precision reveals that.",
    pillars: [
      { crate: "fs-sos", role: "Each family's cost is a convex quadratic. certify_quadratic returns the exact global minimum together with a sum-of-squares certificate, p(x) − p* = (√a·x + b∕2√a)², an identity a machine checks by matching coefficients. No local-versus-global argument survives it." },
      { crate: "fs-robust", role: "The realized design drifts from x* by a manufacturing tolerance, and the perturbed cost grows as p(x*+δ) = p* + a·δ², so a steep family pays for its curvature. A CVaR over a deterministic tolerance grid gives each family a worst-case cost." },
      { crate: "fs-evidence", role: "The nominal optimum carries a Verified color because it is proven; the robust ranking carries an Estimated color because it rests on a finite sample. A headline never claims more certainty than its weakest input." },
    ],
    difference:
      "A general optimizer offers a number and no warranty. A global solver can prove optimality but knows nothing about tolerance; a robust-design tool samples perturbations but cannot prove you found the global optimum to begin with. ProofRobust runs both through one typed pipeline where the epistemic colors keep them separate, so a proof is never quietly downgraded into a guess, nor a guess promoted into a proof. The lesson falls out of the composition: the family with the lowest nominal cost loses the robust ranking, and both nominal optima are still proven global.",
    payoff:
      "You ship the design that survives the shop floor, with a machine-checkable record of why it is optimal and how its ranking was decided.",
    result: "3 / 3 families proven globally optimal · robust winner ≠ nominal winner · headline honestly Estimated",
    accent: "#10b981",
  },
  {
    key: "metamat",
    crate: "fs-metamat-e2e",
    layer: "L4 · Ascent",
    name: "MetamatCert",
    title: "Every point on the frontier is certified.",
    tagline: "A stiffness–density frontier that is provably stable and admissible.",
    lede:
      "Numerical homogenization compresses a microstructure into a single effective stiffness tensor. The tensor looks authoritative, but the raw numbers carry no guarantee that they are even physically possible. MetamatCert traces the stiffness–density frontier of a holed-plate metamaterial and proves two properties at every point on it.",
    context:
      "A stiffness tensor that is not positive-definite would store negative strain energy, which is nonsense; a tensor that beats the Voigt bound for its density would violate the basic rule of mixtures. Both failures are easy to produce with a subtle bug in the cell solver or the averaging, and both are invisible in the bare numbers. In most workflows the homogenized tensor is handed straight to a downstream model, so the error propagates silently into whatever you build on top of it.",
    pillars: [
      { crate: "fs-lattice", role: "Each porosity yields an effective Voigt tensor C and a solid fraction ρ; the axial stiffness is C₁₁." },
      { crate: "fs-sos · is_psd", role: "A physical elastic tensor must be positive-definite. The minimum-eigenvalue certificate proves C ≻ 0 at every point on the frontier, so no operating point stores negative energy." },
      { crate: "fs-lattice · voigt_bound", role: "No microstructure at fraction ρ can exceed the Voigt mixture bound ρ·C₁₁ˢᵒˡⁱᵈ. Every homogenized C₁₁ is checked against it; a violation would expose the homogenizer itself, so the check certifies the certifier, and it also proves the solid optimal for specific stiffness." },
    ],
    difference:
      "Standard homogenization returns a tensor and trusts the finite-element code that produced it. Nothing in the pipeline checks the result against physics, so a stability failure or an inadmissible value ships downstream unnoticed. MetamatCert audits its own output at every frontier point against a positive-definiteness proof and a physical upper bound, and colors the whole frontier Verified only when both hold. The bound violation that never happens is exactly the event that would reveal a broken solver.",
    payoff:
      "You get a frontier you can hand to a designer knowing every point on it is stable, admissible, and monotone, with the proofs recorded alongside the numbers.",
    result: "6-point frontier · C₁₁ 3.5 → 0.8 · every point PSD-stable and Voigt-admissible · Verified",
    accent: "#22d3ee",
  },
  {
    key: "flutter",
    crate: "fs-flutter-e2e",
    layer: "L4 · Ascent",
    name: "FlutterCert",
    title: "The flutter boundary, proven twice over.",
    tagline: "An aeroelastic stability boundary, certified two independent ways.",
    lede:
      "Aeroelastic flutter is the point where a structure starts extracting energy from the flow and shakes itself apart. Finding it usually means sweeping a parameter, plotting a damping curve, and reading off where it crosses zero. A crossing on a plot is a strong hint, but it is not a proof, and a slightly under-resolved sweep can put the crossing in the wrong place.",
    context:
      "Getting a flutter boundary wrong is costly in both directions. Place it too low and you throw away flight envelope you actually had; place it too high and you clear a structure into a regime where it can flutter. The stakes are high enough that a curve read off a sweep is an uncomfortable foundation, yet a curve is what most analyses deliver.",
    pillars: [
      { crate: "fs-sos", role: "A Lyapunov certificate checks P ≻ 0 and −(AᵀP + PA) ≻ 0 for the 2-DOF operator A(μ). With P = I it reduces to a pair of eigenvalue conditions and recovers the exact boundary μ* = 2, colored Verified." },
      { crate: "fs-spectral", role: "Independently, the largest eigenvalue of the symmetric part is negative exactly when μ < 2. A second method lands on the same boundary, so each certifies the other." },
      { crate: "fs-couple", role: "Computing the coupled response by a partitioned scheme exposes a real failure mode: naive staggering diverges from about μ = 1, while Aitken relaxation converges across the whole stable range up to μ*." },
    ],
    difference:
      "A damping-crossing plot cannot certify anything; it shows you a curve and leaves the rest to judgment. FlutterCert proves the boundary with a Lyapunov certificate, confirms it with an independent spectral test, and shows where a common coupling scheme quietly fails before the physical limit. Two methods agreeing on the same μ* is a far stronger statement than any single sweep, and both are machine-checked rather than eyeballed.",
    payoff:
      "You get a flutter boundary backed by a certificate and an independent cross-check, plus a clear picture of which solver you can trust up to it.",
    result: "Lyapunov μ* = spectral μ* = 2 · boundaries agree · Aitken reaches the boundary, naive diverges near μ = 1",
    accent: "#a855f7",
  },
  {
    key: "schedule",
    crate: "fs-schedule-e2e",
    layer: "L6 · Helm",
    name: "CampaignSchedule",
    title: "When it finishes, and whether to keep going.",
    tagline: "An exact critical path plus a value-of-information stop rule.",
    lede:
      "A multi-fidelity design campaign is a graph of studies that feed each other, each taking some time, alongside a pool of candidate designs whose costs you only estimate. Two questions decide how it runs: when will the whole thing finish, and is the next expensive study even worth commissioning. CampaignSchedule answers both, and attaches a certificate to each answer.",
    context:
      "The two questions are usually served by different tools that never talk. Project schedulers compute a critical path heuristically and say nothing about whether more data would change your decision; decision-analysis tools reason about information value but know nothing about the precedence structure that sets the deadline. Teams end up gathering data they did not need, or committing to a design before the evidence justified it, because no single view holds both the timeline and the value of information.",
    pillars: [
      { crate: "fs-tropical", role: "The studies form a precedence DAG. Their completion time is the longest weighted path, computed exactly in the max-plus (tropical) semiring, which also names the bottleneck study whose slack is zero." },
      { crate: "fs-voi", role: "The candidate designs carry uncertain cost. EVPI measures how much the current ranking ambiguity is worth resolving; recommend picks the study with the best value per cost, or says stop once the decision is already robust." },
      { crate: "fs-evidence", role: "The makespan is Verified because it is an exact computation; the recommendation is Estimated because it rests on a decision-theoretic model of the uncertainty." },
    ],
    difference:
      "A Gantt chart shows you a schedule and a heuristic critical path, with no notion of whether the next experiment would change your mind. CampaignSchedule computes the finish time exactly, in a semiring where longest-path is just matrix multiplication, and in the same pass runs an anytime value-of-information rule over the design decision. The finish time is proven and the stop rule is principled, and both come out of one model rather than two disconnected ones.",
    payoff:
      "You know the exact deadline and the one study driving it, and you stop paying for information the moment it can no longer change the choice.",
    result: "makespan 13 (exact) · critical path windtunnel-A → decide · EVPI 0.048 → Act: sample-B",
    accent: "#f59e0b",
  },
  {
    key: "truss",
    crate: "fs-truss-e2e",
    layer: "L4 · Ascent",
    name: "TrussPath",
    title: "An optimal truss, and how the load travels through it.",
    tagline: "43 candidate bars pruned to 6, with a duality-gap certificate and a critical load path.",
    lede:
      "Give a structural optimizer a design domain and it returns member sizes. What it rarely returns is any statement of how close to optimal those sizes are, or how the load actually threads its way to the supports. TrussPath starts from a Michell ground structure, every admissible bar a candidate, and returns the optimal layout together with both of those missing pieces.",
    context:
      "Topology optimizers converge to a design, but convergence is not optimality; without a bound you are trusting that the iteration stopped somewhere good. And once you have a sparse truss, the question an engineer actually asks is which members carry the structure and which one fails first, usually answered by staring at a force plot. Neither the optimality gap nor the load path is standard output, so both get taken on faith.",
    pillars: [
      { crate: "fs-truss", role: "A first-order PDHG solver sizes all candidate bars to minimum volume under equilibrium and emits a relative primal-dual duality gap, a machine-checkable bound on how far the returned design sits from the true optimum." },
      { crate: "fs-tropical", role: "The surviving bars form a DAG oriented by distance to support. A max-plus critical-path computation finds the single chain carrying the most material from the load to the supports and names its bottleneck bar." },
      { crate: "fs-evidence", role: "The optimality claim is Verified once the duality gap and equilibrium residual are tiny; the load path is Verified, an exact tropical computation." },
    ],
    difference:
      "Most sizing and topology tools give you a shape and leave optimality to trust in the solver. TrussPath hands back a certified duality gap, a hard bound on suboptimality, and then traces the exact chain of bars carrying the load, with its weakest link named. You leave with the geometry, a proof of its quality, and the story of how it carries force, all from one run.",
    payoff:
      "You get a truss you can defend as near-optimal to a number, and you know before you build it which member to watch.",
    result: "43 → 6 active bars · duality gap 7.8e-5 · critical path bottlenecked at member 33 · Verified optimal",
    accent: "#22d3ee",
  },
  {
    key: "sensor",
    crate: "fs-oed-e2e",
    layer: "L4 · Ascent",
    name: "SensorForge",
    title: "Measure the decision, not the uncertainty.",
    tagline: "Value-of-information sensor placement that knows when to stop.",
    lede:
      "You have several candidate designs, you can only estimate how each performs, and you have a budget of sensors to sharpen those estimates. The obvious move is to measure whatever you are most unsure about, but that spends sensors on uncertainty that does not affect the choice. SensorForge places each sensor where it most sharpens the decision, and stops once the decision is settled.",
    context:
      "Reducing uncertainty and improving a decision are not the same goal, and optimizing the first can waste most of your budget. A candidate that is wildly uncertain but clearly worse than the leader does not deserve a single measurement; two near-tied front-runners deserve all of them. Classical experimental design tends to chase parameter information rather than the decision, and it rarely tells you when to stop, so you fix a sensor count in advance and hope it was enough.",
    pillars: [
      { crate: "fs-assimilate", role: "Each candidate is a Gaussian belief. A sensor reading is fused with the exact scalar Kalman update, shrinking that candidate's posterior variance." },
      { crate: "fs-voi", role: "EVPI scores how much the decision's ambiguity is worth resolving. recommend places the next sensor on the candidate whose measurement most moves the decision, and stops the instant EVPI falls below threshold." },
      { crate: "fs-toleralloc", role: "The remaining measurement-precision budget is distributed across candidates cost-optimally, by sensitivity." },
    ],
    difference:
      "Standard optimal experimental design maximizes information about parameters and leaves the stopping rule to you. SensorForge optimizes the decision directly, so it never spends a sensor on a design already out of contention, and its value-of-information stop is principled rather than a fixed budget. Sensors land only on the contenders that could still change the answer, and the loop halts the moment more data cannot.",
    payoff:
      "You reach a robust choice with the fewest measurements, and you can point to the value-of-information number that justified stopping.",
    result: "sensors land on decision-relevant contenders only · EVPI 0.163 → 0.010 over 8 placements · stops robust, chooses A",
    accent: "#10b981",
  },
  {
    key: "neuro",
    crate: "fs-neuroshape-e2e",
    layer: "L5 · Lumen",
    name: "NeuroShapeCert",
    title: "A neural shape whose topology is proven.",
    tagline: "A learned SDF with a certified Lipschitz bound and a proven single component.",
    lede:
      "A neural network can represent a shape as a signed-distance field, and it renders beautifully, but it comes with no guarantees. How far can a sphere-tracing ray step before it risks tunneling through a thin wall? How many separate pieces does the surface really have? NeuroShapeCert answers both with proofs rather than samples.",
    context:
      "The usual way to inspect a learned surface is to march a grid and look, but a grid can step right over a thin handle or miss a hidden void, so the topology you see is the topology you happened to sample. Rendering has the same hazard: pick a sphere-trace step that is slightly too large and the ray passes through the surface, dropping features. Sampling can build confidence, but it cannot certify that a shape is a single connected piece or that a ray never tunnels.",
    pillars: [
      { crate: "fs-rep-neural", role: "A small spectrally-normalized tanh-MLP defines the field, provably negative near the origin and positive on a surrounding ring. Its certified Lipschitz constant L = Π σᵢ makes |f|∕L a sphere-trace step that cannot tunnel through the surface." },
      { crate: "fs-rep-neural · IBP", role: "Sound interval bound propagation proves a central box lies strictly inside (hi < 0) and every box on a ring lies strictly outside (lo > 0). A non-empty interior enclosed by a certified-positive ring is a single bounded component, established by arithmetic rather than by meshing." },
      { crate: "fs-viz", role: "A Morse cross-check confirms one interior minimum, and the isocontour crossings all fall inside the certified ring." },
    ],
    difference:
      "Marching cubes samples a surface and hopes the grid was fine enough; a missed handle or void simply never appears. NeuroShapeCert proves the topology with interval arithmetic, which encloses the field over whole boxes at once and cannot skip a feature the way point samples can, and it derives a Lipschitz bound that makes rendering provably tunnel-free. The result is a statement about the shape, not about the grid you looked at it through.",
    payoff:
      "You can trust that the rendered shape is one bounded piece and that a ray tracer will never step through it, with the enclosures to back both claims.",
    result: "Lipschitz L = 18 (certified) · single bounded component proven · single interior minimum · all Verified",
    accent: "#a855f7",
  },
  {
    key: "grammar",
    crate: "fs-grammar-e2e",
    layer: "L4 · Ascent",
    name: "GrammarForge",
    title: "A fabricable family of shape programs, each rewrite re-proven.",
    tagline: "MAP-Elites over CSG programs with certificate-preserving simplification.",
    lede:
      "A CAD model is a single artifact, built by hand, carrying no record of why it is the shape it is. GrammarForge treats geometry as programs instead, searches for the whole family of CSG programs that approximate a target and can actually be manufactured, and proves that every simplification it applies preserves the shape.",
    context:
      "Two problems dog generative and program-based CAD. A search usually returns one optimum, which tells you nothing about the trade-offs you could have taken; and the rewrites that clean up a program (dropping a tiny offset, merging two primitives) are trusted to preserve the geometry without anyone checking. A rewrite that quietly changes the shape is a silent correctness bug, and a single optimum hides the diversity a designer wants to choose from.",
    pillars: [
      { crate: "fs-shapeprog", role: "A candidate is a CSG program, scored by its worst-case SDF discrepancy from the target. The rewrite engine drops redundant offsets and applies geometric identities, each carrying a fidelity certificate, so the simplified program is provably within max_error; the campaign then re-measures the discrepancy to confirm the certificate held." },
      { crate: "fs-fab", role: "A minimum-feature-size constraint scores each program's smallest feature, the margin that separates a buildable part from a fantasy." },
      { crate: "fs-archive", role: "MAP-Elites over program size and fabrication margin keeps the best-matching program in every niche, producing a diverse atlas rather than one winner." },
    ],
    difference:
      "Generative design tools return an optimum and treat their own simplifications as trustworthy. GrammarForge returns an illuminated family across the complexity-and-fabricability grid, and it re-verifies every optimization rewrite against the geometry it claims to preserve. The simplifier issues a certificate, and the campaign independently checks it, so a rewrite can never quietly change the part.",
    payoff:
      "You get a whole shelf of fabricable design options instead of one, each with a proof that the program you build was not altered on the way there.",
    result: "18 / 24 niches filled · simplification 108 → 99 nodes, re-verified sound · fabricable family · Verified",
    accent: "#22d3ee",
  },
  {
    key: "anytimebo",
    crate: "fs-adaptbo-e2e",
    layer: "L4 · Ascent",
    name: "AnytimeBO",
    title: "Bayesian optimization that provably knows when to stop.",
    tagline: "An anytime-valid stopping certificate for the search loop.",
    lede:
      "Every Bayesian optimizer eventually faces the same question: have we searched enough? The tempting answer is to watch the best-so-far and stop when it plateaus, but checking after every iteration and stopping on a threshold is exactly the peeking that inflates your chance of stopping too early. AnytimeBO replaces the threshold with a stopping rule that stays valid no matter how often you look.",
    context:
      "Classical statistical guarantees assume you fixed your sample size in advance. Optimization loops do the opposite; they look at the data after every single evaluation and decide whether to continue. Under that repeated peeking a naive plateau test can declare victory on a lucky flat stretch far more often than its nominal error rate suggests, so you stop short of the optimum and never know it.",
    pillars: [
      { crate: "fs-bo", role: "A Matérn-5⁄2 Gaussian process with closed-form Expected Improvement drives a deterministic minimization over a candidate grid." },
      { crate: "fs-eproc", role: "A betting e-process watches a per-iteration stall indicator. When its e-value crosses 1∕α the search stops, an anytime-valid decision by Ville's inequality, so testing after every iteration never pushes the false-stop rate past α." },
      { crate: "fs-eproc · CS", role: "An anytime-valid confidence sequence tracks the best-value trace as a running diagnostic." },
    ],
    difference:
      "Most BO libraries stop on a fixed evaluation budget or a naive threshold on the incumbent, neither of which survives being checked every iteration. AnytimeBO uses an e-process, an object designed to be valid at every stopping time at once, so the optimizer can peek after each step and still respect its error budget. The stop is a guarantee rather than a heuristic, and it comes without the alpha-spending accounting that sequential testing normally demands.",
    payoff:
      "You stop early with a certificate that the stop was sound, rather than a fixed budget you guessed at or a threshold that quietly cheats.",
    result: "stops at iteration 12 · log-e 3.17 > Ville threshold 3.00 · anytime-valid, no alpha-spending",
    accent: "#f59e0b",
  },
  {
    key: "flowcert",
    crate: "fs-flowcert-e2e",
    layer: "L4 · Ascent",
    name: "FlowCert",
    title: "It tells you where to trust the CFD.",
    tagline: "A certified credibility map over a lattice-Boltzmann operating space.",
    lede:
      "A CFD run returns a flow field and a number. What it does not return is any indication of whether you should believe that number at the operating point you chose. FlowCert sweeps a lattice-Boltzmann channel across Reynolds number and resolution and attaches a credibility verdict to every point in that space.",
    context:
      "Solver accuracy is not uniform across an operating envelope. Push the relaxation time toward its stability floor and the same code that was accurate a moment ago starts drifting, often with no obvious warning in the output. Validation against a known solution is usually a one-off study for a single case, so the credibility of the run you actually care about is left to intuition about the regime.",
    pillars: [
      { crate: "fs-lbm", role: "Each channel is marched to steady state, then compared to the analytic Poiseuille solution, a manufactured-solution check that reflects the inherent O(1∕ny²) discretization error. The scaling planner derives ν, τ and Mach for the target Reynolds and flags the regime Verified only when it is comfortably stable." },
      { crate: "fs-archive", role: "MAP-Elites over Reynolds and resolution keeps the most accurate operating point in every niche, building a credibility atlas rather than a single run." },
      { crate: "fs-evidence", role: "A point that is accurate and comfortably stable is Verified; a point near τ = ½ is flagged Estimated as risky even where it currently happens to be accurate." },
    ],
    difference:
      "A CFD solver gives you a number and stays silent about its own reliability; checking it against an exact solution is a manual exercise you run once, if at all. FlowCert checks every operating point against the analytic solution and a stability envelope, and returns a map of where the answer is trustworthy rather than a single unqualified figure. A point can be accurate today and still be flagged because its regime is fragile, which is the warning a bare number never gives.",
    payoff:
      "You get an operating map that tells you which Reynolds-and-resolution combinations you can rely on, and which ones to treat with suspicion even when they look fine.",
    result: "Re = 20 credible at every resolution · Re = 120 flagged (unstable regime) · error 0.0008 → 0.22 across the map",
    accent: "#22d3ee",
  },
];
