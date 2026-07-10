"use client";

/**
 * Flagship pipeline — run_frame(seed) · fs-frame-e2e (the seismic frame)
 * "The lightest frame that PROVES it survives the quake — and stops the instant
 *  the evidence is decisive."
 *
 * One compiled-Rust campaign runs end to end in WASM and returns a single
 * self-describing Vec<f64>: a 12-word header whose off_layout / off_sizing /
 * off_history / off_fragility / off_cvar fields are f64 INDICES into the same
 * array. We decode each block by those offsets and present the five stages as a
 * stage stepper over one large per-stage canvas:
 *
 *   1 LAYOUT     — a Michell ground structure over the domain: every candidate
 *                  bar faint, the survivors bright (width ∝ |force|, tension cyan /
 *                  compression rose), left-edge pins, the loaded node with a down
 *                  arrow. A PDHG duality gap certifies near-optimality.
 *   2 SIZING     — the survivors sized to a catalog, coloured by whether yield or
 *                  Euler buckling governs, equilibrium re-verified post-prune.
 *   3 TIME HIST. — the Kanai–Tajimi ground acceleration a_g(t) over the story
 *                  drift x(t) on a shared time axis, plus a real path-dependent
 *                  elastoplastic hysteresis loop (shear V vs drift x).
 *   4 FRAGILITY  — the running anytime-valid confidence sequence (center ± radius)
 *                  collapsing to the exceedance probability p̂, with the E-STOP
 *                  marker at the sample where the evidence became decisive.
 *   5 CVaR MASS  — the CVaR-vs-scale curve against the feasibility limit, the
 *                  bisection collapsing to scale*, the catalog rung it snaps to,
 *                  and the final certified mass.
 *
 * Every number drawn is the actual compiled-Rust output — no mocks, no scripted
 * curves. The kernel call runs ONCE per seed; stepping only switches which decoded
 * block is drawn.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView, useEasedText } from "@/lib/use-viz-anim";
import {
  BG,
  SURFACE,
  BORDER,
  CYAN,
  CYAN_GLOW,
  VIOLET,
  EMERALD,
  AMBER,
  ROSE,
  TEAL,
  MUTED,
  BRIGHT,
  dpr,
  hexRgb,
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Slider,
  Pill,
  ErrorNote,
  BootOverlay,
  Caption,
} from "@/components/wasm/deep/_chrome";

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* ------------------------------------------------------------------ */
/*  Decode  (self-describing offset header — off_* are f64 indices)    */
/* ------------------------------------------------------------------ */

interface Member {
  a: number;
  b: number;
  force: number;
  survivor: boolean;
}
interface Sized {
  idx: number;
  a: number;
  b: number;
  force: number;
  areaYield: number;
  areaEuler: number;
  areaCatalog: number;
  eulerGoverns: boolean;
}
interface CsPoint {
  idx: number;
  center: number;
  radius: number;
}
interface CvarPoint {
  scale: number;
  cvar: number;
}
interface FrameData {
  seed: number;
  // layout
  gap: number;
  eqResidual: number;
  volumePhys: number;
  iters: number;
  certifiedOptimal: boolean;
  Nn: number;
  M: number;
  loadNode: number;
  nodes: [number, number][];
  members: Member[];
  maxForce: number;
  supports: number[];
  // sizing
  allPass: boolean;
  eqResidualPostprune: number;
  pruned: number;
  Ms: number;
  sized: Sized[];
  maxCatalog: number;
  // history
  peakDrift: number;
  dt: number;
  Ns: number;
  k0: number;
  Vy: number;
  ag: Float64Array;
  xDrift: Float64Array;
  V: Float64Array;
  agMax: number;
  xMax: number;
  vMax: number;
  // fragility
  pHat: number;
  radius: number;
  membersUsed: number;
  stoppedEarly: boolean;
  alpha: number;
  confidence: number;
  exceedances: number;
  driftLimit: number;
  margin: number;
  mlmcEstimate: number;
  mlmcLevels: number;
  Nc: number;
  cs: CsPoint[];
  // cvar
  scaleStar: number;
  scaleSnapped: number;
  cvarStar: number;
  cvarSnapped: number;
  limit: number;
  mass: number;
  cvarIters: number;
  beta: number;
  Ncv: number;
  catalog: Float64Array;
  cvarCurve: CvarPoint[];
  ms: number;
}

function decode(raw: Float64Array, ms: number): FrameData {
  const offL = raw[3] | 0;
  const offS = raw[4] | 0;
  const offH = raw[5] | 0;
  const offF = raw[6] | 0;
  const offC = raw[7] | 0;

  /* ---- LAYOUT ---- */
  const Nn = Math.round(raw[offL + 5]);
  const M = Math.round(raw[offL + 6]);
  const loadNode = Math.round(raw[offL + 7]);
  const cbase = offL + 8;
  const nodes: [number, number][] = [];
  for (let k = 0; k < Nn; k++) nodes.push([raw[cbase + 2 * k], raw[cbase + 2 * k + 1]]);
  const mbase = cbase + 2 * Nn;
  const members: Member[] = [];
  let maxForce = 1e-9;
  for (let k = 0; k < M; k++) {
    const o = mbase + 4 * k;
    const m: Member = { a: Math.round(raw[o]), b: Math.round(raw[o + 1]), force: raw[o + 2], survivor: raw[o + 3] > 0.5 };
    members.push(m);
    if (m.survivor) maxForce = Math.max(maxForce, Math.abs(m.force));
  }
  let minX = Infinity;
  for (const [x] of nodes) minX = Math.min(minX, x);
  const supports = nodes.map((_, i) => i).filter((i) => Math.abs(nodes[i][0] - minX) < 1e-6);

  /* ---- SIZING ---- */
  const Ms = Math.round(raw[offS + 3]);
  const sbase = offS + 4;
  const sized: Sized[] = [];
  let maxCatalog = 1e-12;
  for (let k = 0; k < Ms; k++) {
    const o = sbase + 7 * k;
    const areaYield = raw[o + 4];
    const areaEuler = raw[o + 5];
    const areaCatalog = raw[o + 6];
    maxCatalog = Math.max(maxCatalog, areaCatalog);
    sized.push({
      idx: Math.round(raw[o]),
      a: Math.round(raw[o + 1]),
      b: Math.round(raw[o + 2]),
      force: raw[o + 3],
      areaYield,
      areaEuler,
      areaCatalog,
      eulerGoverns: areaEuler > areaYield,
    });
  }

  /* ---- HISTORY ---- */
  const Ns = Math.round(raw[offH + 2]);
  const agB = offH + 5;
  const xB = agB + Ns;
  const vB = xB + Ns;
  const ag = raw.slice(agB, agB + Ns);
  const xDrift = raw.slice(xB, xB + Ns);
  const V = raw.slice(vB, vB + Ns);
  let agMax = 1e-12;
  let xMax = 1e-12;
  let vMax = 1e-12;
  for (let i = 0; i < Ns; i++) {
    agMax = Math.max(agMax, Math.abs(ag[i]));
    xMax = Math.max(xMax, Math.abs(xDrift[i]));
    vMax = Math.max(vMax, Math.abs(V[i]));
  }

  /* ---- FRAGILITY ---- */
  const Nc = Math.round(raw[offF + 11]);
  const fb = offF + 12;
  const cs: CsPoint[] = [];
  for (let k = 0; k < Nc; k++) {
    const o = fb + 3 * k;
    cs.push({ idx: raw[o], center: raw[o + 1], radius: raw[o + 2] });
  }

  /* ---- CVAR ---- */
  const catalogLen = Math.round(raw[offC + 9]);
  const Ncv = Math.round(raw[offC + 8]);
  const catB = offC + 10;
  const catalog = raw.slice(catB, catB + catalogLen);
  const cvB = catB + catalogLen;
  const cvarCurve: CvarPoint[] = [];
  for (let k = 0; k < Ncv; k++) {
    const o = cvB + 2 * k;
    cvarCurve.push({ scale: raw[o], cvar: raw[o + 1] });
  }

  return {
    seed: Math.round(raw[2]),
    gap: raw[offL],
    eqResidual: raw[offL + 1],
    volumePhys: raw[offL + 2],
    iters: Math.round(raw[offL + 3]),
    certifiedOptimal: raw[offL + 4] > 0.5,
    Nn,
    M,
    loadNode,
    nodes,
    members,
    maxForce,
    supports,
    allPass: raw[offS] > 0.5,
    eqResidualPostprune: raw[offS + 1],
    pruned: Math.round(raw[offS + 2]),
    Ms,
    sized,
    maxCatalog,
    peakDrift: raw[offH],
    dt: raw[offH + 1],
    Ns,
    k0: raw[offH + 3],
    Vy: raw[offH + 4],
    ag,
    xDrift,
    V,
    agMax,
    xMax,
    vMax,
    pHat: raw[offF],
    radius: raw[offF + 1],
    membersUsed: Math.round(raw[offF + 2]),
    stoppedEarly: raw[offF + 3] > 0.5,
    alpha: raw[offF + 4],
    confidence: raw[offF + 5],
    exceedances: Math.round(raw[offF + 6]),
    driftLimit: raw[offF + 7],
    margin: raw[offF + 8],
    mlmcEstimate: raw[offF + 9],
    mlmcLevels: Math.round(raw[offF + 10]),
    Nc,
    cs,
    scaleStar: raw[offC],
    scaleSnapped: raw[offC + 1],
    cvarStar: raw[offC + 2],
    cvarSnapped: raw[offC + 3],
    limit: raw[offC + 4],
    mass: raw[offC + 5],
    cvarIters: Math.round(raw[offC + 6]),
    beta: raw[offC + 7],
    Ncv,
    catalog,
    cvarCurve,
    ms,
  };
}

/* ------------------------------------------------------------------ */
/*  Stage metadata                                                     */
/* ------------------------------------------------------------------ */

const STAGES = [
  { num: "01", name: "Layout", tag: "ground structure", color: CYAN },
  { num: "02", name: "Sizing", tag: "yield · Euler", color: VIOLET },
  { num: "03", name: "Time history", tag: "Kanai–Tajimi", color: TEAL },
  { num: "04", name: "Fragility", tag: "anytime E-stop", color: EMERALD },
  { num: "05", name: "CVaR mass", tag: "catalog-snapped", color: AMBER },
] as const;

const DEFAULT_SEED = 90210;

/* ------------------------------------------------------------------ */

export default function FramePipeline() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [nonce, setNonce] = useState(0);
  const [stage, setStage] = useState(0);
  const [auto, setAuto] = useState(true);
  const [data, setData] = useState<FrameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<FrameData | null>(null);
  dataRef.current = data;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);

  const volRef = useEasedText<HTMLSpanElement>(data?.volumePhys ?? 0, reduced, (v) => v.toFixed(2), {
    enabled: !!data,
    inViewRef,
  });
  const pHatRef = useEasedText<HTMLSpanElement>(data?.pHat ?? 0, reduced, (v) => v.toFixed(3), {
    enabled: !!data,
    inViewRef,
  });
  const massRef = useEasedText<HTMLSpanElement>(data?.mass ?? 0, reduced, (v) => v.toFixed(2), {
    enabled: !!data,
    inViewRef,
  });

  /* -- compute once per (seed, nonce), latest-wins, debounced for slider drags -- */
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const token = ++tokenRef.current;
      setComputing(true);
      setError(null);
      (async () => {
        try {
          const t0 = performance.now();
          const raw = await call<Float64Array>("run_frame", seed);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          setData(decode(raw, ms));
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 200);
    return () => clearTimeout(id);
  }, [ready, seed, nonce, call]);

  /* ============================================================= */
  /*  DRAW — one canvas, dispatch on the active stage              */
  /* ============================================================= */
  const draw = useCallback((reveal: number, time: number) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    if (!d) return;
    const rm = reducedRef.current;
    const st = stageRef.current;
    const pulse = rm ? 1 : 0.6 + 0.4 * Math.sin(time * 0.005);

    if (st === 0 || st === 1) drawFrame(ctx, d, W, H, st, reveal, pulse);
    else if (st === 2) drawHistory(ctx, d, W, H, reveal);
    else if (st === 3) drawFragility(ctx, d, W, H, reveal, pulse);
    else drawCvar(ctx, d, W, H, reveal, pulse);
  }, []);

  /* -- DPR sizing + redraw -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const dp = dpr();
      const cssW = canvas.clientWidth || 480;
      const w = Math.max(240, Math.min(1200, Math.round(cssW * dp)));
      const h = Math.round(w * 0.66);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      draw(revealRef.current, performance.now());
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      ro.observe(canvas);
    }
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [draw]);

  /* -- per-stage reveal animation (gated by view + reduced-motion) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      draw(1, 0);
      return;
    }
    revealStartRef.current = performance.now();
    revealRef.current = 0;
    const DUR = stage === 2 ? 2400 : stage === 3 ? 2100 : stage === 4 ? 1500 : 1200;
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      if (revealStartRef.current !== null) {
        const t = Math.min((now - revealStartRef.current) / DUR, 1);
        revealRef.current = 1 - Math.pow(1 - t, 3);
        if (t >= 1) revealStartRef.current = null;
      } else {
        revealRef.current = 1;
      }
      draw(revealRef.current, now);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [data, inView, reduced, stage, draw, inViewRef]);

  /* -- subtle auto-advance (respects reduced-motion + off-screen + manual nav) -- */
  useEffect(() => {
    if (reduced || !auto) return;
    const id = setInterval(() => {
      if (!inViewRef.current) return;
      setStage((s) => (s + 1) % STAGES.length);
    }, 6200);
    return () => clearInterval(id);
  }, [reduced, auto, inViewRef]);

  const go = (s: number) => {
    setAuto(false);
    setStage(s);
  };
  const rerun = () => {
    setStage(0);
    setNonce((n) => n + 1);
  };

  const metric = data ? stageMetric(data, stage) : null;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Flagship · fs-frame-e2e · certified seismic frame</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            The lightest frame that <span className="text-cyan-300">proves</span> it survives the quake.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* stage stepper */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {STAGES.map((s, i) => (
          <Pill key={s.num} onClick={() => go(i)} active={stage === i} color={s.color} ariaLabel={`Stage ${s.num}: ${s.name}`} disabled={!data}>
            <span className="tabular-nums opacity-60">{s.num}</span>
            <span>{s.name}</span>
          </Pill>
        ))}
      </div>

      {/* canvas */}
      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full"
          style={{ aspectRatio: "1 / 0.66" }}
          role="img"
          aria-label={`Stage ${STAGES[stage].num} ${STAGES[stage].name}: ${STAGES[stage].tag}. A live compiled-Rust seismic-frame campaign, decoded from a self-describing offset-header buffer.`}
        />
        {/* stage label */}
        <span
          className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
          style={{ borderColor: `${STAGES[stage].color}66`, background: `${BG}bb`, color: STAGES[stage].color }}
        >
          {STAGES[stage].num} · {STAGES[stage].name} · {STAGES[stage].tag}
        </span>

        {/* per-stage certified seal */}
        {data && metric && (
          <div
            className="pointer-events-none absolute right-3 top-3 flex flex-col items-end rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm"
            style={{ borderColor: `${metric.sealColor}44`, background: "rgba(4,9,13,0.72)" }}
          >
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              {metric.sealLabel}
            </span>
            <span
              className="font-mono text-[17px] font-black leading-none tabular-nums"
              style={{ color: metric.sealColor, textShadow: `0 0 12px ${metric.sealColor}66` }}
            >
              {metric.sealValue}
            </span>
          </div>
        )}

        {(!ready || (computing && !data)) && <BootOverlay />}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* legend (stage-contextual) */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]" style={{ color: MUTED }}>
        {stageLegend(stage).map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full" style={{ background: l.color }} /> {l.label}
          </span>
        ))}
      </div>

      {/* pipeline summary tiles (constant across stages — the whole certified campaign) */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${CYAN}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            material volume
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: CYAN_GLOW }}>
            <span ref={volRef}>{data ? data.volumePhys.toFixed(2) : "—"}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${EMERALD}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            exceedance p̂
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: EMERALD }}>
            <span ref={pHatRef}>{data ? data.pHat.toFixed(3) : "—"}</span>
            <span style={{ color: MUTED }}>{data ? ` ±${data.radius.toFixed(2)}` : ""}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${AMBER}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            CVaR mass
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: AMBER }}>
            <span ref={massRef}>{data ? data.mass.toFixed(2) : "—"}</span>
          </div>
        </div>
      </div>

      {/* certified / measured metric line (the money line for the active stage) */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        {data && metric ? (
          <>
            <span style={{ color: metric.sealColor }}>{metric.verb}</span> {metric.line}
          </>
        ) : (
          <>
            <span style={{ color: CYAN_GLOW }}>›</span> running the end-to-end frame campaign in WASM and decoding the offset-header buffer…
          </>
        )}
      </div>

      {/* running readout (seed · headline stats · WASM time) */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {computing && !data ? (
          <span style={{ color: AMBER }}>running the full end-to-end FRAME campaign in WASM…</span>
        ) : data ? (
          <>
            5-stage campaign · seed <span style={{ color: CYAN }}>{data.seed}</span> ·{" "}
            <span style={{ color: CYAN_GLOW }}>{data.members.filter((m) => m.survivor).length}</span> survivors ·{" "}
            p̂ <span style={{ color: EMERALD }}>{data.pHat.toFixed(3)}</span>{" "}
            {data.stoppedEarly ? (
              <>
                e-stopped at <span style={{ color: EMERALD }}>{data.membersUsed}</span>
              </>
            ) : (
              <>
                ran to <span style={{ color: MUTED }}>{data.membersUsed}</span>
              </>
            )}{" "}
            <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>{data.ms.toFixed(0)} ms in WASM</span>
            {computing ? <span style={{ color: AMBER }}> · recomputing…</span> : null}
          </>
        ) : (
          "one call runs Layout → Sizing → Time history → Fragility → CVaR; stepping just re-draws a decoded block…"
        )}
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Slider
            label="seed"
            value={seed}
            min={1}
            max={99999}
            step={1}
            onChange={(v) => setSeed(Math.round(v))}
            format={(v) => String(Math.round(v))}
            disabled={!ready}
          />
        </div>
        <button
          type="button"
          onClick={rerun}
          disabled={!ready}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: `${CYAN}55`, color: CYAN }}
        >
          ↻ re-run campaign
        </button>
        <button
          type="button"
          onClick={() => setAuto((a) => !a)}
          aria-pressed={auto}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide transition-colors hover:bg-white/5"
          style={{ borderColor: auto ? `${EMERALD}66` : `${MUTED}44`, color: auto ? EMERALD : MUTED }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: auto ? EMERALD : MUTED }} />
          {auto ? "auto-tour" : "manual"}
        </button>
      </div>

      {/* caption */}
      <Caption>{stageCaption(stage)}</Caption>
    </SyncContainer>
  );
}

/* ================================================================== */
/*  Stage 1 & 2 — the frame (ground structure / sized)                */
/* ================================================================== */

function drawFrame(
  ctx: CanvasRenderingContext2D,
  d: FrameData,
  W: number,
  H: number,
  st: number,
  reveal: number,
  pulse: number,
) {
  if (d.nodes.length === 0) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of d.nodes) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const domW = Math.max(1e-6, maxX - minX);
  const domH = Math.max(1e-6, maxY - minY);
  const padL = W * 0.08;
  const padR = W * 0.08;
  const padT = H * 0.13;
  const padB = H * 0.16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const scale = Math.min(plotW / domW, plotH / domH);
  const ox = padL + (plotW - domW * scale) / 2;
  const oy = padT + (plotH - domH * scale) / 2;
  const mapX = (x: number) => ox + (x - minX) * scale;
  const mapY = (y: number) => oy + (maxY - y) * scale;
  const P = (i: number): [number, number] => [mapX(d.nodes[i][0]), mapY(d.nodes[i][1])];

  ctx.lineCap = "round";

  if (st === 0) {
    /* -- LAYOUT: candidate cloud + survivors width∝|force| -- */
    for (const m of d.members) {
      if (m.survivor) continue;
      const [ax, ay] = P(m.a);
      const [bx, by] = P(m.b);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = "rgba(120,140,160,0.11)";
      ctx.lineWidth = Math.max(0.6, W / 1100);
      ctx.stroke();
    }
    const wOf = (f: number) => {
      const t = Math.min(1, Math.abs(f) / d.maxForce);
      return Math.max(1.4, W / 560) + t * Math.max(4.5, W / 95);
    };
    for (const m of d.members) {
      if (!m.survivor) continue;
      const tension = m.force >= 0;
      const col = tension ? CYAN_GLOW : ROSE;
      const [ax, ay] = P(m.a);
      const [bx, by] = P(m.b);
      ctx.globalAlpha = 0.25 + 0.75 * reveal;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = rgba(col, 0.92);
      ctx.lineWidth = wOf(m.force) * (0.4 + 0.6 * reveal);
      ctx.shadowColor = col;
      ctx.shadowBlur = W / 220;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  } else {
    /* -- SIZING: survivors sized to catalog, coloured by governing mode -- */
    // faint remaining ghosts of pruned candidates
    for (const m of d.members) {
      if (m.survivor) continue;
      const [ax, ay] = P(m.a);
      const [bx, by] = P(m.b);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = "rgba(120,140,160,0.05)";
      ctx.lineWidth = Math.max(0.5, W / 1300);
      ctx.stroke();
    }
    const wArea = (area: number) => {
      const t = Math.sqrt(Math.min(1, area / d.maxCatalog));
      return Math.max(2.4, W / 360) + t * Math.max(5, W / 74);
    };
    for (const s of d.sized) {
      const tension = s.force >= 0;
      const col = tension ? CYAN_GLOW : ROSE;
      const [ax, ay] = P(s.a);
      const [bx, by] = P(s.b);
      const lw = wArea(s.areaCatalog) * (0.2 + 0.8 * reveal);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = rgba(col, 0.9);
      ctx.lineWidth = lw;
      ctx.shadowColor = col;
      ctx.shadowBlur = W / 260;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // buckling-governed members get an amber dashed core (Euler beats yield)
      if (s.eulerGoverns && reveal > 0.5) {
        ctx.save();
        ctx.setLineDash([Math.max(3, W / 160), Math.max(3, W / 160)]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = rgba(AMBER, 0.9);
        ctx.lineWidth = Math.max(1, lw * 0.32);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // joints
  for (let i = 0; i < d.nodes.length; i++) {
    const [x, y] = P(i);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, Math.max(1.7, W / 340)), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(203,213,225,0.65)";
    ctx.fill();
  }

  // supports (left-edge pins) — triangle + ground hatch
  const tri = Math.max(6, W / 60);
  for (const sIdx of d.supports) {
    const [x, y] = P(sIdx);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - tri, y - tri * 0.62);
    ctx.lineTo(x - tri, y + tri * 0.62);
    ctx.closePath();
    ctx.fillStyle = rgba(EMERALD, 0.18);
    ctx.strokeStyle = rgba(EMERALD, 0.85);
    ctx.lineWidth = Math.max(1, W / 480);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = rgba(EMERALD, 0.5);
    ctx.lineWidth = Math.max(0.8, W / 600);
    for (let h = 0; h < 4; h++) {
      const hy = y - tri * 0.62 + (tri * 1.24 * h) / 3;
      ctx.beginPath();
      ctx.moveTo(x - tri, hy);
      ctx.lineTo(x - tri - tri * 0.42, hy + tri * 0.42);
      ctx.stroke();
    }
  }

  // load arrow (downward) at the loaded node
  if (d.loadNode >= 0 && d.loadNode < d.nodes.length) {
    const [lx, ly] = P(d.loadNode);
    const len = Math.max(20, H * 0.14) * (0.7 + 0.3 * pulse);
    const tipY = ly + len;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, tipY);
    ctx.strokeStyle = rgba(AMBER, 0.95);
    ctx.lineWidth = Math.max(1.8, W / 270);
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = W / 130;
    ctx.stroke();
    const ah = Math.max(6, W / 100);
    ctx.beginPath();
    ctx.moveTo(lx, tipY + ah * 0.5);
    ctx.lineTo(lx - ah * 0.6, tipY - ah * 0.5);
    ctx.lineTo(lx + ah * 0.6, tipY - ah * 0.5);
    ctx.closePath();
    ctx.fillStyle = AMBER;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(AMBER, 0.95);
    ctx.font = `${Math.max(8, W / 60)}px ui-monospace, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("seismic load", lx + ah, tipY);
  }
}

/* ================================================================== */
/*  Stage 3 — time history (seismogram + hysteresis loop)             */
/* ================================================================== */

function drawHistory(ctx: CanvasRenderingContext2D, d: FrameData, W: number, H: number, reveal: number) {
  if (d.Ns < 2) return;
  const fs = Math.max(8, W / 66);
  const nShown = Math.max(1, Math.floor(reveal * (d.Ns - 1)));

  const padL = W * 0.1;
  const splitX = W * 0.6; // left = time traces, right = hysteresis
  const padT = H * 0.06;
  const padB = H * 0.09;
  const leftR = splitX - W * 0.04;
  const plotW = leftR - padL;

  // two stacked bands in the left column
  const gap = H * 0.06;
  const bandH = (H - padT - padB - gap) / 2;
  const aTop = padT;
  const aBot = padT + bandH;
  const xTop = aBot + gap;
  const xBot = xTop + bandH;

  const Xt = (i: number) => padL + (d.Ns > 1 ? i / (d.Ns - 1) : 0) * plotW;

  const drawTrace = (
    top: number,
    bot: number,
    vals: Float64Array,
    amp: number,
    col: string,
    label: string,
    markPeak: boolean,
  ) => {
    const mid = (top + bot) / 2;
    const half = (bot - top) / 2;
    const Y = (v: number) => mid - (v / (amp * 1.12)) * half;
    // zero line
    ctx.strokeStyle = "rgba(148,163,184,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, mid);
    ctx.lineTo(leftR, mid);
    ctx.stroke();
    // trace up to playhead
    ctx.beginPath();
    for (let i = 0; i <= nShown; i++) {
      const px = Xt(i);
      const py = Y(vals[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = rgba(col, 0.95);
    ctx.lineWidth = Math.max(1.2, W / 520);
    ctx.shadowColor = col;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // peak-drift marker
    if (markPeak) {
      let pk = 0;
      let pi = 0;
      for (let i = 0; i < d.Ns; i++) {
        if (Math.abs(vals[i]) > pk) {
          pk = Math.abs(vals[i]);
          pi = i;
        }
      }
      if (pi <= nShown) {
        ctx.beginPath();
        ctx.arc(Xt(pi), Y(vals[pi]), Math.max(0.1, Math.max(2.4, W / 220)), 0, Math.PI * 2);
        ctx.fillStyle = AMBER;
        ctx.shadowColor = AMBER;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    // label
    ctx.fillStyle = rgba(col, 0.85);
    ctx.font = `${fs}px ui-monospace, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, padL + 3, top + 2);
  };

  drawTrace(aTop, aBot, d.ag, d.agMax, CYAN, "ground accel a_g(t)", false);
  drawTrace(xTop, xBot, d.xDrift, d.xMax, TEAL, "story drift x(t)", true);

  // shared playhead
  const phx = Xt(nShown);
  ctx.strokeStyle = "rgba(226,232,240,0.35)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(phx, aTop);
  ctx.lineTo(phx, xBot);
  ctx.stroke();
  ctx.setLineDash([]);

  // time axis label
  ctx.fillStyle = MUTED;
  ctx.font = `${fs}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`t → ${(d.Ns * d.dt).toFixed(1)} s`, padL + plotW / 2, H - padB * 0.2);

  /* ---- hysteresis loop (right column), square, traced to the playhead ---- */
  const hL = splitX + W * 0.02;
  const hR = W - W * 0.03;
  const hT = padT + H * 0.02;
  const hB = H - padB - H * 0.02;
  const side = Math.min(hR - hL, hB - hT);
  const hcx = (hL + hR) / 2;
  const hcy = (hT + hB) / 2;
  const hx0 = hcx - side / 2;
  const hy0 = hcy - side / 2;
  const HX = (x: number) => hcx + (x / (d.xMax * 1.05)) * (side / 2);
  const HY = (v: number) => hcy - (v / (d.vMax * 1.05)) * (side / 2);

  // frame + axes
  ctx.strokeStyle = "rgba(148,163,184,0.16)";
  ctx.lineWidth = 1;
  ctx.strokeRect(hx0, hy0, side, side);
  ctx.beginPath();
  ctx.moveTo(hx0, hcy);
  ctx.lineTo(hx0 + side, hcy);
  ctx.moveTo(hcx, hy0);
  ctx.lineTo(hcx, hy0 + side);
  ctx.stroke();

  // ±Vy yield plateaus (amber dashed)
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = rgba(AMBER, 0.4);
  for (const sgn of [1, -1]) {
    const vy = HY(sgn * d.Vy);
    if (vy > hy0 && vy < hy0 + side) {
      ctx.beginPath();
      ctx.moveTo(hx0, vy);
      ctx.lineTo(hx0 + side, vy);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // loop path up to playhead (violet→cyan by progress)
  ctx.save();
  ctx.beginPath();
  ctx.rect(hx0, hy0, side, side);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i <= nShown; i++) {
    const px = HX(d.xDrift[i]);
    const py = HY(d.V[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = rgba(VIOLET, 0.85);
  ctx.lineWidth = Math.max(1.1, W / 620);
  ctx.shadowColor = VIOLET;
  ctx.shadowBlur = 7;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // live head marker
  ctx.beginPath();
  ctx.arc(HX(d.xDrift[nShown]), HY(d.V[nShown]), Math.max(0.1, Math.max(2.6, W / 200)), 0, Math.PI * 2);
  ctx.fillStyle = CYAN_GLOW;
  ctx.shadowColor = CYAN_GLOW;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = rgba(VIOLET, 0.85);
  ctx.font = `${fs}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("hysteresis · V vs x", hcx, hy0 - fs * 1.1 < padT ? hy0 + 2 : hy0 - fs * 1.1);
  ctx.fillStyle = rgba(AMBER, 0.7);
  ctx.textBaseline = "bottom";
  ctx.fillText("±Vy yield", hcx, hy0 + side + fs * 1.05 > H ? hy0 + side - 2 : hy0 + side + fs * 1.05);
}

/* ================================================================== */
/*  Stage 4 — fragility (anytime-valid confidence sequence + E-stop)  */
/* ================================================================== */

function drawFragility(ctx: CanvasRenderingContext2D, d: FrameData, W: number, H: number, reveal: number, pulse: number) {
  if (d.Nc < 1) return;
  const fs = Math.max(8, W / 60);
  const padL = W * 0.11;
  const padR = W * 0.05;
  const padT = H * 0.1;
  const padB = H * 0.12;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const cl = (v: number) => Math.max(0, Math.min(1, v));
  const X = (i: number) => padL + (d.Nc > 1 ? i / (d.Nc - 1) : 0.5) * plotW;
  const Y = (p: number) => padT + (1 - cl(p)) * plotH;
  const nShown = reveal * (d.Nc - 1);

  // horizontal gridlines at 0,.25,.5,.75,1
  ctx.font = `${fs}px ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const p = g / 4;
    const y = Y(p);
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.fillText(p.toFixed(2), padL - W * 0.012, y);
  }

  // confidence band (center ± radius), revealed left→right
  const shown = Math.max(1, Math.ceil(nShown));
  ctx.beginPath();
  for (let k = 0; k <= shown && k < d.Nc; k++) ctx.lineTo(X(k), Y(d.cs[k].center + d.cs[k].radius));
  for (let k = Math.min(shown, d.Nc - 1); k >= 0; k--) ctx.lineTo(X(k), Y(d.cs[k].center - d.cs[k].radius));
  ctx.closePath();
  ctx.fillStyle = rgba(CYAN, 0.12);
  ctx.fill();

  // p̂ target line (emerald dashed)
  const yHat = Y(d.pHat);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = rgba(EMERALD, 0.55);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padL, yHat);
  ctx.lineTo(W - padR, yHat);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = EMERALD;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`p̂ = ${d.pHat.toFixed(3)}`, padL + 4, yHat - 3);

  // section label
  ctx.fillStyle = "rgba(148,163,184,0.75)";
  ctx.textBaseline = "top";
  ctx.fillText("exceedance-prob confidence sequence · tightening ↓", padL + 4, padT + 2);

  // center line — bold, plunging to p̂
  ctx.beginPath();
  let started = false;
  for (let k = 0; k < d.Nc; k++) {
    if (k > nShown + 1) break;
    const frac = Math.max(0, Math.min(1, nShown - k + 1));
    if (frac <= 0) break;
    const x = X(k);
    const y = Y(d.cs[k].center);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rgba(CYAN_GLOW, 0.28);
  ctx.lineWidth = Math.max(4, W / 150);
  ctx.shadowColor = CYAN_GLOW;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.strokeStyle = rgba(CYAN_GLOW, 0.98);
  ctx.lineWidth = Math.max(1.8, W / 300);
  ctx.shadowBlur = 7;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // sample markers
  for (let k = 0; k < d.Nc; k++) {
    if (k > nShown + 1e-6) continue;
    ctx.beginPath();
    ctx.arc(X(k), Y(d.cs[k].center), Math.max(0.1, Math.max(1.8, W / 320)), 0, Math.PI * 2);
    ctx.fillStyle = rgba(CYAN_GLOW, 0.9);
    ctx.fill();
  }

  // E-STOP vertical line at members_used (once revealed to it)
  const stopIdx = Math.max(0, Math.min(d.Nc - 1, d.membersUsed - 1));
  if (reveal > 0.97) {
    const sx = X(stopIdx);
    ctx.strokeStyle = EMERALD;
    ctx.lineWidth = Math.max(1.6, W / 300);
    ctx.shadowColor = EMERALD;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(sx, padT);
    ctx.lineTo(sx, padT + plotH);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const yS = Y(d.cs[stopIdx].center);
    ctx.beginPath();
    ctx.arc(sx, yS, Math.max(0.1, Math.max(4.5, W / 120) * pulse), 0, Math.PI * 2);
    ctx.strokeStyle = EMERALD;
    ctx.lineWidth = Math.max(1.4, W / 300);
    ctx.shadowColor = EMERALD;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = EMERALD;
    ctx.font = `700 ${Math.max(8, W / 58)}px ui-monospace, monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`E-STOP · n=${d.membersUsed}`, sx - 6, padT + 2);
    ctx.font = `${Math.max(7, W / 78)}px ui-monospace, monospace`;
    ctx.fillStyle = rgba(EMERALD, 0.75);
    ctx.textBaseline = "bottom";
    ctx.fillText("anytime-valid", sx - 6, padT + plotH - 3);
  }

  // x-axis label
  ctx.fillStyle = MUTED;
  ctx.font = `${fs}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("ensemble sample →", padL + plotW / 2, H - padB * 0.15);
}

/* ================================================================== */
/*  Stage 5 — CVaR mass (curve vs feasibility limit, catalog snap)    */
/* ================================================================== */

function drawCvar(ctx: CanvasRenderingContext2D, d: FrameData, W: number, H: number, reveal: number, pulse: number) {
  if (d.cvarCurve.length < 1 || d.catalog.length < 1) return;
  const fs = Math.max(8, W / 60);
  const padL = W * 0.11;
  const padR = W * 0.06;
  const padT = H * 0.1;
  const padB = H * 0.13;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const sMin = d.catalog[0];
  const sMax = d.catalog[d.catalog.length - 1];
  const sSpan = Math.max(1e-9, sMax - sMin);
  let cMax = d.limit;
  for (const p of d.cvarCurve) cMax = Math.max(cMax, p.cvar);
  cMax *= 1.14;
  const X = (s: number) => padL + ((s - sMin) / sSpan) * plotW;
  const Y = (c: number) => padT + (1 - Math.max(0, Math.min(1, c / cMax))) * plotH;

  // feasible region (cvar ≤ limit) shaded emerald
  const yLim = Y(d.limit);
  ctx.fillStyle = rgba(EMERALD, 0.06);
  ctx.fillRect(padL, yLim, plotW, padT + plotH - yLim);

  // limit line (amber)
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = rgba(AMBER, 0.7);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(padL, yLim);
  ctx.lineTo(W - padR, yLim);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = AMBER;
  ctx.font = `${fs}px ui-monospace, monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`feasibility limit ${d.limit.toExponential(2)}`, padL + 4, yLim - 3);

  // section label
  ctx.fillStyle = "rgba(148,163,184,0.75)";
  ctx.textBaseline = "top";
  ctx.fillText("CVaR vs material scale · minimise mass s.t. CVaR ≤ limit", padL + 4, padT + 2);

  // catalog rungs (x ticks) + highlight the snapped rung
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i < d.catalog.length; i++) {
    const s = d.catalog[i];
    const x = X(s);
    const snapped = Math.abs(s - d.scaleSnapped) < 1e-9;
    ctx.strokeStyle = snapped ? rgba(EMERALD, 0.55) : "rgba(148,163,184,0.16)";
    ctx.lineWidth = snapped ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillStyle = snapped ? EMERALD : MUTED;
    ctx.font = `${Math.max(7, W / 82)}px ui-monospace, monospace`;
    ctx.fillText(s.toFixed(2), x, padT + plotH + 3);
  }

  // bisection bracket collapsing toward scale* as reveal → 1
  const lo = sMin + (d.scaleStar - sMin) * Math.min(1, reveal * 1.05);
  const hi = sMax - (sMax - d.scaleStar) * Math.min(1, reveal * 1.05);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = "rgba(226,232,240,0.22)";
  ctx.lineWidth = 1;
  for (const bx of [X(lo), X(hi)]) {
    ctx.beginPath();
    ctx.moveTo(bx, padT);
    ctx.lineTo(bx, padT + plotH);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // CVaR curve, revealed left→right
  const clip = padL + reveal * plotW + 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, clip, H);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i < d.cvarCurve.length; i++) {
    const px = X(d.cvarCurve[i].scale);
    const py = Y(d.cvarCurve[i].cvar);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = rgba(CYAN_GLOW, 0.95);
  ctx.lineWidth = Math.max(1.8, W / 300);
  ctx.shadowColor = CYAN_GLOW;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  for (const p of d.cvarCurve) {
    ctx.beginPath();
    ctx.arc(X(p.scale), Y(p.cvar), Math.max(0.1, Math.max(2, W / 260)), 0, Math.PI * 2);
    ctx.fillStyle = rgba(CYAN_GLOW, 0.9);
    ctx.fill();
  }
  ctx.restore();

  // scale* crossing (continuous optimum) — emerald vertical line
  if (reveal > 0.55) {
    const xs = X(d.scaleStar);
    ctx.strokeStyle = rgba(EMERALD, 0.85);
    ctx.lineWidth = Math.max(1.4, W / 340);
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(xs, padT);
    ctx.lineTo(xs, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = EMERALD;
    ctx.font = `700 ${Math.max(8, W / 66)}px ui-monospace, monospace`;
    ctx.textAlign = xs > W * 0.78 ? "right" : "left";
    ctx.textBaseline = "top";
    ctx.fillText(`scale* = ${d.scaleStar.toFixed(3)}`, xs + (xs > W * 0.78 ? -5 : 5), padT + fs * 1.4);
  }

  // snapped solution dot (scale_snapped, cvar_snapped) — pulsing crown
  if (reveal > 0.82) {
    const px = X(d.scaleSnapped);
    const py = Y(d.cvarSnapped);
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.1, Math.max(4.5, W / 120) * pulse), 0, Math.PI * 2);
    ctx.strokeStyle = EMERALD;
    ctx.lineWidth = Math.max(1.4, W / 320);
    ctx.shadowColor = EMERALD;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = EMERALD;
    ctx.font = `700 ${Math.max(8, W / 62)}px ui-monospace, monospace`;
    ctx.textAlign = px > W * 0.78 ? "right" : "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`snap → mass ${d.mass.toFixed(2)}`, px + (px > W * 0.78 ? -6 : 6), py - 6);
  }

  // x-axis label
  ctx.fillStyle = MUTED;
  ctx.font = `${fs}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("material scale factor →", padL + plotW / 2, H - padB * 0.1);
}

/* ================================================================== */
/*  Per-stage seal / metric line / legend / caption                   */
/* ================================================================== */

interface StageMetric {
  verb: string;
  line: React.ReactNode;
  sealLabel: string;
  sealValue: string;
  sealColor: string;
}

function stageMetric(d: FrameData, stage: number): StageMetric {
  switch (stage) {
    case 0:
      return {
        verb: "Certified:",
        sealLabel: "duality gap",
        sealValue: d.gap.toExponential(1),
        sealColor: d.certifiedOptimal ? EMERALD : AMBER,
        line: (
          <>
            PDHG duality gap <span style={{ color: d.certifiedOptimal ? EMERALD : AMBER }}>{d.gap.toExponential(1)}</span>{" "}
            {d.certifiedOptimal ? "< 1e-3 → certified near-optimal" : "iterating"} <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: CYAN_GLOW }}>{d.members.filter((m) => m.survivor).length}</span> survivors of {d.M} candidates ·
            volume <span style={{ color: CYAN_GLOW }}>{d.volumePhys.toFixed(2)}</span>
          </>
        ),
      };
    case 1:
      return {
        verb: "Certified:",
        sealLabel: "eq. residual",
        sealValue: d.eqResidualPostprune.toExponential(1),
        sealColor: d.allPass ? EMERALD : AMBER,
        line: (
          <>
            <span style={{ color: d.allPass ? EMERALD : AMBER }}>{d.allPass ? "all members pass" : "check members"}</span> · equilibrium
            re-verified to <span style={{ color: EMERALD }}>{d.eqResidualPostprune.toExponential(1)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: VIOLET }}>{d.pruned}</span> pruned →{" "}
            <span style={{ color: CYAN_GLOW }}>{d.Ms}</span> sized to catalog
          </>
        ),
      };
    case 2:
      return {
        verb: "Measured:",
        sealLabel: "peak drift ratio",
        sealValue: d.peakDrift.toFixed(4),
        sealColor: TEAL,
        line: (
          <>
            peak story-drift ratio <span style={{ color: TEAL }}>{d.peakDrift.toFixed(4)}</span> · Kanai–Tajimi excitation,{" "}
            <span style={{ color: CYAN_GLOW }}>{d.Ns}</span> steps @ {d.dt}s <span style={{ color: MUTED }}>│</span> yield shear V
            <sub>y</sub> = <span style={{ color: AMBER }}>{(d.Vy / 1000).toFixed(1)}k</span>
          </>
        ),
      };
    case 3:
      return {
        verb: "Certified:",
        sealLabel: "exceedance p̂",
        sealValue: d.pHat.toFixed(3),
        sealColor: EMERALD,
        line: (
          <>
            exceedance probability <span style={{ color: EMERALD }}>p̂ = {d.pHat.toFixed(3)} ± {d.radius.toFixed(3)}</span>,
            anytime-valid <span style={{ color: MUTED }}>│</span> {d.stoppedEarly ? "e-stopped" : "ran to budget"} at{" "}
            <span style={{ color: EMERALD }}>{d.membersUsed}</span> samples · confidence 1−α ={" "}
            <span style={{ color: EMERALD }}>{(1 - d.alpha).toFixed(2)}</span>
          </>
        ),
      };
    default:
      return {
        verb: "Certified:",
        sealLabel: "CVaR mass",
        sealValue: d.mass.toFixed(2),
        sealColor: AMBER,
        line: (
          <>
            CVaR mass <span style={{ color: AMBER }}>{d.mass.toFixed(2)}</span> · cvar
            <sub>snap</sub> <span style={{ color: EMERALD }}>{d.cvarSnapped.toExponential(2)}</span> ≤ limit{" "}
            <span style={{ color: AMBER }}>{d.limit.toExponential(2)}</span> <span style={{ color: MUTED }}>│</span> scale*{" "}
            <span style={{ color: EMERALD }}>{d.scaleStar.toFixed(3)}</span> → catalog rung{" "}
            <span style={{ color: EMERALD }}>{d.scaleSnapped.toFixed(2)}</span>
          </>
        ),
      };
  }
}

function stageLegend(stage: number): { label: string; color: string }[] {
  switch (stage) {
    case 0:
      return [
        { label: "tension", color: CYAN_GLOW },
        { label: "compression", color: ROSE },
        { label: "candidate", color: "rgba(120,140,160,0.4)" },
        { label: "pin support", color: EMERALD },
        { label: "load", color: AMBER },
      ];
    case 1:
      return [
        { label: "tension (yield)", color: CYAN_GLOW },
        { label: "compression", color: ROSE },
        { label: "Euler-buckling governs", color: AMBER },
      ];
    case 2:
      return [
        { label: "ground accel a_g", color: CYAN },
        { label: "story drift x", color: TEAL },
        { label: "hysteresis V(x)", color: VIOLET },
        { label: "±Vy yield", color: AMBER },
      ];
    case 3:
      return [
        { label: "confidence band", color: rgba(CYAN, 0.5) },
        { label: "running estimate", color: CYAN_GLOW },
        { label: "p̂ / E-stop", color: EMERALD },
      ];
    default:
      return [
        { label: "CVaR(scale)", color: CYAN_GLOW },
        { label: "feasibility limit", color: AMBER },
        { label: "scale* / snapped", color: EMERALD },
      ];
  }
}

function stageCaption(stage: number): React.ReactNode {
  switch (stage) {
    case 0:
      return (
        <>
          Every faint line is a <span className="text-slate-200">candidate bar</span> in a Michell ground structure over the
          building bay. A first-order <span style={{ color: VIOLET }}>PDHG linear program</span> sizes them for minimum material
          under equilibrium and emits a machine-checkable <span style={{ color: EMERALD }}>duality gap</span> — the certificate of
          near-optimality. Only the survivors remain: <span style={{ color: CYAN_GLOW }}>tension</span> in cyan,{" "}
          <span style={{ color: ROSE }}>compression</span> in rose, width set by force, anchored at the{" "}
          <span style={{ color: EMERALD }}>pinned supports</span> and driven by the <span style={{ color: AMBER }}>seismic load</span>.
        </>
      );
    case 1:
      return (
        <>
          Each surviving bar is <span className="text-slate-200">sized to a real discrete catalog</span>: the required area is the
          larger of the <span style={{ color: CYAN_GLOW }}>yield</span> demand and, for compression members, the{" "}
          <span style={{ color: AMBER }}>Euler-buckling</span> area — buckling-governed members carry the amber core. After pruning
          the zero-force candidates, equilibrium is <span style={{ color: EMERALD }}>re-verified</span> to machine precision on the
          reduced structure, so the sized frame is provably in balance.
        </>
      );
    case 2:
      return (
        <>
          A <span style={{ color: CYAN }}>Kanai–Tajimi</span> filtered ground acceleration drives the frame; the response integrates
          to the <span style={{ color: TEAL }}>story drift</span> x(t). The right panel traces the real path-dependent{" "}
          <span style={{ color: VIOLET }}>hysteresis loop</span> — shear V against drift x — its area the energy dissipated each
          cycle, saturating at the <span style={{ color: AMBER }}>yield shear ±Vy</span>. Nothing is scripted: the loop is the
          integrator&rsquo;s own trajectory, played to the shared time cursor.
        </>
      );
    case 3:
      return (
        <>
          Across a Monte-Carlo ensemble of quakes, an <span style={{ color: CYAN_GLOW }}>anytime-valid confidence sequence</span>{" "}
          brackets the true drift-exceedance probability. The band is a genuine <span className="text-slate-200">e-process</span>{" "}
          bound — sound no matter how often you peek — so the run <span style={{ color: EMERALD }}>stops the instant</span> the
          interval is decisive, at the marked E-stop, converging to the certified{" "}
          <span style={{ color: EMERALD }}>p̂</span>. No fixed horizon, no alpha-spending.
        </>
      );
    default:
      return (
        <>
          A final <span style={{ color: CYAN_GLOW }}>CVaR</span> pass buys robustness: scaling the material shifts the worst-case
          tail loss along the curve. A bisection finds the smallest continuous{" "}
          <span style={{ color: EMERALD }}>scale*</span> whose CVaR clears the <span style={{ color: AMBER }}>feasibility limit</span>,
          then snaps up to the nearest <span style={{ color: EMERALD }}>catalog rung</span> and independently re-checks it. The
          result is the lightest buildable frame with a certified tail-risk guarantee — every number compiled Rust, live in your tab.
        </>
      );
  }
}
