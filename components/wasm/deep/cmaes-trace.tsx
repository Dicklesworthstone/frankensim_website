"use client";

/**
 * Deep Kernel 04 — "Evolution that learns."
 *
 * Drives the real `cmaes_trace(seed, gens)` kernel: CMA-ES (the covariance-matrix-
 * adaptation evolution strategy, cast as a natural-gradient flow) from fs-dfo,
 * minimizing the 2-D Himmelblau function. The kernel returns, per generation, the
 * best objective value, the incumbent point, and the isotropic step-size σ; plus the
 * four true global minima.
 *
 * We paint the Himmelblau landscape as a glowing contour map (computed in JS for the
 * backdrop), trace the incumbent generation by generation, and draw a shrinking
 * σ-radius circle at the current best. As the search adapts, the circle collapses and
 * the point homes onto one of the four minima — different seeds fall into different
 * basins.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";
import {
  BG,
  BORDER,
  CYAN,
  CYAN_GLOW,
  VIOLET,
  AMBER,
  EMERALD,
  MUTED,
  BRIGHT,
  useReducedMotionSafe,
  useCanvasDpr,
  PanelHeader,
  Pill,
  ErrorNote,
  BootOverlay,
  Readout,
  Caption,
} from "./_chrome";

const GENS = 60;
const DOM = 5; // domain half-width → [-5,5]²
const NB = 200; // landscape sampling resolution
const SEEDS = [1, 2, 3, 7, 11];
const HOLD = 20; // generations-equivalent hold at the minimum before looping

function himmel(x: number, y: number): number {
  const a = x * x + y - 11;
  const b = x + y * y - 7;
  return a * a + b * b;
}

/* ------------------------------------------------------------------ */
/*  Decode                                                             */
/* ------------------------------------------------------------------ */

interface CMAData {
  g: number;
  fBest: Float64Array;
  bx: Float64Array;
  by: Float64Array;
  sigma: Float64Array;
  minima: { x: number; y: number }[];
  seed: number;
  ms: number;
}

function decode(raw: Float64Array, seed: number, ms: number): CMAData {
  const g = raw[0] | 0;
  const fBest = new Float64Array(g);
  const bx = new Float64Array(g);
  const by = new Float64Array(g);
  const sigma = new Float64Array(g);
  let o = 1;
  for (let i = 0; i < g; i++) {
    fBest[i] = raw[o + 1];
    bx[i] = raw[o + 2];
    by[i] = raw[o + 3];
    sigma[i] = raw[o + 4];
    o += 5;
  }
  const minima: { x: number; y: number }[] = [];
  for (let k = 0; k < 4; k++) minima.push({ x: raw[o + k * 2], y: raw[o + k * 2 + 1] });
  return { g, fBest, bx, by, sigma, minima, seed, ms };
}

/* ------------------------------------------------------------------ */
/*  Landscape backdrop (seed-independent → cached, rebuilt on resize)  */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const RAMP: [number, RGB][] = [
  [0.0, [3, 6, 12]],
  [0.45, [10, 34, 60]],
  [0.68, [16, 96, 138]],
  [0.85, [30, 190, 226]],
  [1.0, [200, 250, 255]],
];
function ramp(v: number): RGB {
  const x = v <= 0 ? 0 : v >= 1 ? 1 : v;
  for (let i = 1; i < RAMP.length; i++) {
    if (x <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1];
      const [b, cb] = RAMP[i];
      const t = b === a ? 0 : (x - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

const LOGMAX = Math.log(1 + 900);
const CONTOURS = [2, 8, 20, 45, 90, 170, 300, 520];

function buildBackdrop(bg: HTMLCanvasElement, W: number, H: number) {
  bg.width = W;
  bg.height = H;
  const ctx = bg.getContext("2d");
  if (!ctx) return;
  // sample f on an NB×NB grid
  const f = new Float64Array(NB * NB);
  for (let j = 0; j < NB; j++) {
    const y = DOM - (j / (NB - 1)) * 2 * DOM; // screen top = +DOM
    for (let i = 0; i < NB; i++) {
      const x = -DOM + (i / (NB - 1)) * 2 * DOM;
      f[j * NB + i] = himmel(x, y);
    }
  }
  // fill via small imageData then scale up
  const small = document.createElement("canvas");
  small.width = NB;
  small.height = NB;
  const sctx = small.getContext("2d");
  if (!sctx) return;
  const img = sctx.createImageData(NB, NB);
  for (let p = 0; p < NB * NB; p++) {
    const v = Math.pow(1 - Math.min(1, Math.log(1 + f[p]) / LOGMAX), 1.5);
    const c = ramp(v);
    const o = p * 4;
    img.data[o] = c[0];
    img.data[o + 1] = c[1];
    img.data[o + 2] = c[2];
    img.data[o + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, NB, NB, 0, 0, W, H);

  // iso-contours (marching squares on f)
  const sx = W / (NB - 1);
  const sy = H / (NB - 1);
  const path = new Path2D();
  for (let j = 0; j < NB - 1; j++) {
    for (let i = 0; i < NB - 1; i++) {
      const tl = f[j * NB + i];
      const tr = f[j * NB + i + 1];
      const bl = f[(j + 1) * NB + i];
      const br = f[(j + 1) * NB + i + 1];
      for (const lv of CONTOURS) {
        const pts: [number, number][] = [];
        if (tl < lv !== tr < lv) pts.push([i + (lv - tl) / (tr - tl), j]);
        if (tr < lv !== br < lv) pts.push([i + 1, j + (lv - tr) / (br - tr)]);
        if (bl < lv !== br < lv) pts.push([i + (lv - bl) / (br - bl), j + 1]);
        if (tl < lv !== bl < lv) pts.push([i, j + (lv - tl) / (bl - tl)]);
        if (pts.length >= 2) {
          path.moveTo(pts[0][0] * sx, pts[0][1] * sy);
          path.lineTo(pts[1][0] * sx, pts[1][1] * sy);
          if (pts.length === 4) {
            path.moveTo(pts[2][0] * sx, pts[2][1] * sy);
            path.lineTo(pts[3][0] * sx, pts[3][1] * sy);
          }
        }
      }
    }
  }
  ctx.lineWidth = Math.max(0.5, W / 1000);
  ctx.strokeStyle = "rgba(148,197,222,0.18)";
  ctx.stroke(path);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CmaesTrace() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [seed, setSeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [state, setState] = useState<CMAData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<CMAData | null>(null);
  stateRef.current = state;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const genRef = useRef(0); // fractional generation being shown
  const phaseRef = useRef(0); // includes hold time
  const rafRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const scrubRef = useRef<HTMLInputElement>(null);
  const genLabelRef = useRef<HTMLSpanElement>(null);
  const fLabelRef = useRef<HTMLSpanElement>(null);
  const sigLabelRef = useRef<HTMLSpanElement>(null);

  if (bgRef.current === null && typeof document !== "undefined") {
    bgRef.current = document.createElement("canvas");
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const bg = bgRef.current;
    const d = stateRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !bg || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    if (bg.width !== W || bg.height !== H) buildBackdrop(bg, W, H);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);
    if (!d) return;

    const X = (x: number) => ((x + DOM) / (2 * DOM)) * W;
    const Yc = (y: number) => H - ((y + DOM) / (2 * DOM)) * H;

    // four true minima (emerald reticles)
    for (const m of d.minima) {
      const mx = X(m.x);
      const my = Yc(m.y);
      const r = Math.max(5, W / 70);
      ctx.strokeStyle = EMERALD;
      ctx.lineWidth = Math.max(1, W / 560);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - r * 1.5, my);
      ctx.lineTo(mx + r * 1.5, my);
      ctx.moveTo(mx, my - r * 1.5);
      ctx.lineTo(mx, my + r * 1.5);
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const gShown = genRef.current;
    const gi = Math.min(d.g - 1, Math.floor(gShown));
    const gf = Math.min(1, gShown - gi);
    const gj = Math.min(d.g - 1, gi + 1);

    // trajectory polyline 0..gi (violet→cyan gradient by segment)
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.3, W / 380);
    for (let k = 1; k <= gi; k++) {
      const t = k / Math.max(1, d.g - 1);
      const cr = Math.round(168 + (34 - 168) * t);
      const cg = Math.round(85 + (211 - 85) * t);
      const cb = Math.round(247 + (238 - 247) * t);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.85)`;
      ctx.beginPath();
      ctx.moveTo(X(d.bx[k - 1]), Yc(d.by[k - 1]));
      ctx.lineTo(X(d.bx[k]), Yc(d.by[k]));
      ctx.stroke();
    }
    // small nodes along path
    for (let k = 0; k <= gi; k++) {
      ctx.beginPath();
      ctx.arc(X(d.bx[k]), Yc(d.by[k]), Math.max(1, W / 500), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(226,240,255,0.5)";
      ctx.fill();
    }

    // interpolated head + σ circle
    const hx = d.bx[gi] + (d.bx[gj] - d.bx[gi]) * gf;
    const hy = d.by[gi] + (d.by[gj] - d.by[gi]) * gf;
    const hs = d.sigma[gi] + (d.sigma[gj] - d.sigma[gi]) * gf;
    const px = X(hx);
    const py = Yc(hy);
    const rSigma = (hs / (2 * DOM)) * W;

    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1, W / 480);
    ctx.setLineDash([Math.max(2, W / 240), Math.max(3, W / 200)]);
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.5, rSigma), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.5, rSigma), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // incumbent point
    ctx.beginPath();
    ctx.arc(px, py, Math.max(3.5, W / 130), 0, Math.PI * 2);
    ctx.fillStyle = "#fff7ed";
    ctx.shadowBlur = Math.max(8, W / 70);
    ctx.shadowColor = AMBER;
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD text (via refs — no setState)
    const fNow = d.fBest[gi] + (d.fBest[gj] - d.fBest[gi]) * gf;
    if (genLabelRef.current) genLabelRef.current.textContent = String(Math.min(d.g, gi + 1));
    if (fLabelRef.current) fLabelRef.current.textContent = fNow < 1e-3 ? fNow.toExponential(2) : fNow.toFixed(3);
    if (sigLabelRef.current) sigLabelRef.current.textContent = hs.toFixed(3);
    if (scrubRef.current && document.activeElement !== scrubRef.current) {
      scrubRef.current.value = String(gi);
    }
  }, []);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);
  const stableRedraw = useCallback(() => drawRef.current(), []);
  useCanvasDpr(canvasRef, stableRedraw);

  /* -- compute (once per seed) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("cmaes_trace", seed, GENS);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        genRef.current = 0;
        phaseRef.current = 0;
        setState(decode(raw, seed, ms));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, seed, call]);

  useEffect(() => {
    draw();
  }, [draw, state]);

  /* -- playback loop -- */
  useEffect(() => {
    if (!state) return;
    if (reduced) {
      genRef.current = state.g - 1;
      draw();
      return;
    }
    if (!playing || !inView) {
      draw();
      return;
    }
    let last = performance.now();
    const speed = 11; // generations / second
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      phaseRef.current += dt * speed;
      const span = state.g - 1 + HOLD;
      if (phaseRef.current >= span) phaseRef.current = 0;
      genRef.current = Math.min(state.g - 1, phaseRef.current);
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, playing, inView, draw]);

  const onScrub = useCallback(
    (v: number) => {
      setPlaying(false);
      genRef.current = v;
      phaseRef.current = v;
      draw();
    },
    [draw],
  );

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <PanelHeader
        eyebrow="Deep 04 · fs-dfo"
        title={
          <>
            Evolution that <span className="text-cyan-400">learns</span>.
          </>
        }
        computing={computing}
      />

      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          style={{ filter: "saturate(1.08) contrast(1.04)" }}
          role="img"
          aria-label="CMA-ES searching the Himmelblau landscape: a trajectory homing onto one of four minima as a shrinking step-size circle collapses"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && <BootOverlay />}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            REAL fs-dfo · CMA-ES
          </span>
          {state && (
            <div
              className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm"
              style={{ borderColor: `${AMBER}33`, background: "rgba(4,9,13,0.72)" }}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  gen
                </span>
                <span className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT }}>
                  <span ref={genLabelRef}>1</span>/{GENS}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  f_best
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD, textShadow: `0 0 8px ${EMERALD}66` }}>
                  <span ref={fLabelRef}>—</span>
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  σ
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: AMBER }}>
                  <span ref={sigLabelRef}>—</span>
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: EMERALD, boxShadow: `0 0 6px ${EMERALD}` }} />
          true minima (f = 0)
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* generation scrubber */}
      <div className="mt-4 flex items-center gap-2">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          gen
        </span>
        <input
          ref={scrubRef}
          type="range"
          min={0}
          max={GENS - 1}
          step={1}
          defaultValue={0}
          onChange={(e) => onScrub(parseInt(e.target.value, 10))}
          aria-label="Scrub generation"
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10"
          style={{ accentColor: AMBER }}
          disabled={!ready}
        />
      </div>

      {/* seed + play */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          seed
        </span>
        {SEEDS.map((s) => (
          <Pill key={s} onClick={() => setSeed(s)} active={seed === s} color={VIOLET} ariaLabel={`Random seed ${s}`} disabled={!ready}>
            {s}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill onClick={() => setPlaying((p) => !p)} active={playing && !reduced} color={EMERALD} ariaLabel={playing ? "Pause" : "Play"} disabled={!ready || reduced}>
          {playing && !reduced ? "Pause" : "Replay"}
        </Pill>
      </div>

      <Readout>
        {state ? (
          <>
            Himmelblau minimization · seed {state.seed} · {GENS} generations{" "}
            <span style={{ color: MUTED }}>│</span> converged f_best ={" "}
            <span style={{ color: EMERALD }}>{state.fBest[state.g - 1].toExponential(2)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{state.ms.toFixed(1)} ms in WASM</span>
          </>
        ) : (
          "adapting the search covariance generation by generation…"
        )}
      </Readout>

      <Caption>
        This is <span className="text-slate-200">CMA-ES</span> from <span className="text-cyan-300">fs-dfo</span> — a
        derivative-free optimizer that treats the search as a{" "}
        <span className="text-slate-200">natural-gradient flow</span>: each generation it samples around the incumbent, then
        adapts both the mean and the step size <span style={{ color: AMBER }}>σ</span> from what it learned. Watch the{" "}
        <span style={{ color: AMBER }}>σ-circle</span> collapse as the search grows confident and the trajectory homes onto
        one of the four <span style={{ color: EMERALD }}>true minima</span> of Himmelblau. Change the seed and it falls into a
        different basin — same landscape, different destiny. Every step is the real, deterministic-from-seed Rust optimizer.
      </Caption>
    </SyncContainer>
  );
}
