"use client";

/**
 * Deep Kernel 05 — "Melt one shape into another."
 *
 * Drives the real `optimal_transport(n, epsilon)` kernel: entropic-regularized 1-D
 * optimal transport solved by Sinkhorn iterations (matrix scaling). Given a source
 * distribution `a` and a target `b`, it returns the optimal coupling P — the cheapest
 * way to move every grain of mass from a into b — plus the transport cost and a
 * marginal-conservation residual (mass preserved to machine precision).
 *
 * We draw `a` along the top, `b` along the bottom, and the plan P as glowing
 * mass-flow arcs whose width is the coupled mass, with particles streaming down them
 * so you literally watch one shape melt into the other. A coupling-matrix inset shows
 * P directly. Shrink ε and the plan sharpens toward the true (unregularized) optimum.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";
import {
  BG,
  BORDER,
  CYAN,
  CYAN_GLOW,
  VIOLET,
  ROSE,
  EMERALD,
  MUTED,
  BRIGHT,
  useReducedMotionSafe,
  useCanvasDpr,
  PanelHeader,
  Slider,
  ErrorNote,
  BootOverlay,
  Readout,
  Caption,
} from "./_chrome";

const EPS_MIN = 0.005;
const EPS_MUL = 200; // eps = EPS_MIN * EPS_MUL^pos  →  pos∈[0,1] spans 0.005‥1.0
const epsFromPos = (p: number) => EPS_MIN * Math.pow(EPS_MUL, p);
const MAX_ARCS = 640;
const PARTICLES = 260;

interface Arc {
  x0: number; // normalized source x ∈ [0,1]
  x1: number; // normalized target x
  w: number; // coupled mass P[i,j]
}

interface OTData {
  n: number;
  residual: number;
  x: Float64Array;
  a: Float64Array;
  b: Float64Array;
  P: Float64Array;
  maxA: number;
  maxB: number;
  maxP: number;
  arcs: Arc[];
  cost: number;
  eps: number;
  ms: number;
}

function decode(raw: Float64Array, eps: number, ms: number): OTData {
  const n = raw[0] | 0;
  const residual = raw[1];
  let o = 2;
  const x = raw.slice(o, o + n) as Float64Array;
  o += n;
  const a = raw.slice(o, o + n) as Float64Array;
  o += n;
  const b = raw.slice(o, o + n) as Float64Array;
  o += n;
  const P = raw.slice(o, o + n * n) as Float64Array;
  o += n * n;
  const cost = raw[o];

  let maxA = 1e-9,
    maxB = 1e-9,
    maxP = 1e-9;
  for (let i = 0; i < n; i++) {
    maxA = Math.max(maxA, a[i]);
    maxB = Math.max(maxB, b[i]);
  }
  for (let k = 0; k < n * n; k++) maxP = Math.max(maxP, P[k]);

  // normalize x to [0,1]
  const xLo = x[0];
  const xHi = x[n - 1];
  const span = xHi - xLo || 1;
  const arcs: Arc[] = [];
  const thresh = maxP * 0.02;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const w = P[i * n + j];
      if (w <= thresh) continue;
      arcs.push({ x0: (x[i] - xLo) / span, x1: (x[j] - xLo) / span, w });
    }
  }
  arcs.sort((p, q) => q.w - p.w);
  if (arcs.length > MAX_ARCS) arcs.length = MAX_ARCS;

  return { n, residual, x, a, b, P, maxA, maxB, maxP, arcs, cost, eps, ms };
}

/* deterministic hash → [0,1) for stable particle offsets */
function frac(i: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/* cubic-bezier S-curve point */
function bez(t: number, x0: number, y0: number, x1: number, y1: number, midY: number): [number, number] {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  const x = b0 * x0 + b1 * x0 + b2 * x1 + b3 * x1;
  const y = b0 * y0 + b1 * midY + b2 * midY + b3 * y1;
  return [x, y];
}

export default function OptimalTransport() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [nDisp, setNDisp] = useState(24);
  const [nCommit, setNCommit] = useState(24);
  const [epsPosDisp, setEpsPosDisp] = useState(0.43); // ≈ eps 0.05
  const [epsPosCommit, setEpsPosCommit] = useState(0.43);
  const [state, setState] = useState<OTData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLCanvasElement | null>(null);
  const stageSigRef = useRef("");
  const stateRef = useRef<OTData | null>(null);
  stateRef.current = state;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const phaseRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  // particle assignment (arc index + offset), rebuilt when arcs change
  const particlesRef = useRef<{ arc: number; off: number }[]>([]);

  if (stageRef.current === null && typeof document !== "undefined") {
    stageRef.current = document.createElement("canvas");
  }

  const epsDisp = useMemo(() => epsFromPos(epsPosDisp), [epsPosDisp]);

  // rebuild particle allocation when the arc set changes
  useEffect(() => {
    const s = state;
    if (!s || s.arcs.length === 0) {
      particlesRef.current = [];
      return;
    }
    let total = 0;
    for (const arc of s.arcs) total += arc.w;
    const parts: { arc: number; off: number }[] = [];
    for (let i = 0; i < s.arcs.length; i++) {
      const c = Math.max(0, Math.round((s.arcs[i].w / total) * PARTICLES));
      for (let k = 0; k < c; k++) parts.push({ arc: i, off: frac(i * 131 + k * 17) });
    }
    particlesRef.current = parts;
  }, [state]);

  const buildStage = useCallback((stage: HTMLCanvasElement, W: number, H: number, d: OTData) => {
    stage.width = W;
    stage.height = H;
    const ctx = stage.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const margin = W * 0.05;
    const plotW = W - 2 * margin;
    const ySrc = H * 0.2;
    const yTgt = H * 0.8;
    const midY = (ySrc + yTgt) / 2;
    const barH = H * 0.14;
    const X = (xn: number) => margin + xn * plotW;
    const xLo = d.x[0];
    const span = d.x[d.n - 1] - d.x[0] || 1;
    const binW = Math.max(1.5, (plotW / d.n) * 0.7);

    // arcs (glowing ribbons, additive)
    ctx.globalCompositeOperation = "lighter";
    for (const arc of d.arcs) {
      const sx = X(arc.x0);
      const tx = X(arc.x1);
      const grad = ctx.createLinearGradient(sx, ySrc, tx, yTgt);
      grad.addColorStop(0, CYAN_GLOW);
      grad.addColorStop(0.5, "#e6d5ff");
      grad.addColorStop(1, ROSE);
      ctx.strokeStyle = grad;
      const wRel = arc.w / d.maxP;
      ctx.globalAlpha = 0.1 + 0.5 * wRel;
      ctx.lineWidth = Math.max(0.5, Math.sqrt(wRel) * (W / 90));
      ctx.beginPath();
      ctx.moveTo(sx, ySrc);
      ctx.bezierCurveTo(sx, midY, tx, midY, tx, yTgt);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // source bars (cyan, grow up)
    for (let i = 0; i < d.n; i++) {
      const cx = X((d.x[i] - xLo) / span);
      const h = (d.a[i] / d.maxA) * barH;
      const g = ctx.createLinearGradient(0, ySrc - h, 0, ySrc);
      g.addColorStop(0, CYAN_GLOW);
      g.addColorStop(1, `${CYAN}55`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - binW / 2, ySrc - h, binW, h);
    }
    // target bars (rose, grow down)
    for (let j = 0; j < d.n; j++) {
      const cx = X((d.x[j] - xLo) / span);
      const h = (d.b[j] / d.maxB) * barH;
      const g = ctx.createLinearGradient(0, yTgt, 0, yTgt + h);
      g.addColorStop(0, ROSE);
      g.addColorStop(1, `${ROSE}55`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - binW / 2, yTgt, binW, h);
    }
    // baselines
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth = Math.max(0.75, W / 800);
    ctx.beginPath();
    ctx.moveTo(margin, ySrc);
    ctx.lineTo(W - margin, ySrc);
    ctx.moveTo(margin, yTgt);
    ctx.lineTo(W - margin, yTgt);
    ctx.stroke();

    // coupling-matrix inset P (top-right)
    const s = Math.min(W, H) * 0.24;
    const ix = W - s - W * 0.03;
    const iy = H * 0.03;
    const small = document.createElement("canvas");
    small.width = d.n;
    small.height = d.n;
    const sctx = small.getContext("2d");
    if (sctx) {
      const img = sctx.createImageData(d.n, d.n);
      const inv = 1 / d.maxP;
      for (let i = 0; i < d.n; i++) {
        for (let j = 0; j < d.n; j++) {
          const v = Math.pow(Math.min(1, d.P[i * d.n + j] * inv), 0.6);
          const o = (i * d.n + j) * 4;
          img.data[o] = 20 + 34 * v;
          img.data[o + 1] = 30 + 181 * v;
          img.data[o + 2] = 40 + 198 * v;
          img.data[o + 3] = 255;
        }
      }
      sctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, d.n, d.n, ix, iy, s, s);
      ctx.imageSmoothingEnabled = true;
      ctx.strokeStyle = `${CYAN}55`;
      ctx.lineWidth = Math.max(0.75, W / 900);
      ctx.strokeRect(ix, iy, s, s);
      ctx.font = `${Math.max(8, Math.round(W / 74))}px ui-monospace, monospace`;
      ctx.fillStyle = "rgba(148,163,184,0.8)";
      ctx.textBaseline = "bottom";
      ctx.fillText("plan P", ix, iy - 2);
    }

    // labels
    ctx.font = `${Math.max(9, Math.round(W / 60))}px ui-monospace, monospace`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = CYAN_GLOW;
    ctx.fillText("a (source)", margin, ySrc - barH - H * 0.03);
    ctx.fillStyle = ROSE;
    ctx.fillText("b (target)", margin, yTgt + barH + H * 0.03);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const d = stateRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !stage || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (!d) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    // rebuild the static stage if size or data changed
    const sig = `${W}x${H}:${d.eps.toFixed(5)}:${d.n}:${d.ms}`;
    if (stageSigRef.current !== sig || stage.width !== W) {
      buildStage(stage, W, H, d);
      stageSigRef.current = sig;
    }
    ctx.drawImage(stage, 0, 0);

    // animated particles flowing source → target
    const margin = W * 0.05;
    const plotW = W - 2 * margin;
    const ySrc = H * 0.2;
    const yTgt = H * 0.8;
    const midY = (ySrc + yTgt) / 2;
    const X = (xn: number) => margin + xn * plotW;
    const phase = phaseRef.current;
    const parts = particlesRef.current;
    const arcs = d.arcs;
    ctx.globalCompositeOperation = "lighter";
    const pr = Math.max(1.1, W / 320);
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      const arc = arcs[p.arc];
      if (!arc) continue;
      const t = (p.off + phase) % 1;
      const [bx, by] = bez(t, X(arc.x0), ySrc, X(arc.x1), yTgt, midY);
      // color cyan → white → rose along the flow
      const cr = Math.round(34 + (244 - 34) * t);
      const cg = Math.round(211 + (63 - 211) * t);
      const cb = Math.round(238 + (94 - 238) * t);
      const fade = Math.sin(Math.PI * t); // dim at the ends
      ctx.globalAlpha = 0.25 + 0.6 * fade;
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.beginPath();
      ctx.arc(bx, by, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [buildStage]);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);
  const stableRedraw = useCallback(() => drawRef.current(), []);
  useCanvasDpr(canvasRef, stableRedraw);

  /* -- compute (on slider commit) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    const eps = epsFromPos(epsPosCommit);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("optimal_transport", nCommit, eps);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        phaseRef.current = 0;
        setState(decode(raw, eps, ms));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, nCommit, epsPosCommit, call]);

  useEffect(() => {
    draw();
  }, [draw, state]);

  /* -- particle-flow loop -- */
  useEffect(() => {
    if (!state || reduced || !inView) {
      draw();
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      phaseRef.current = (phaseRef.current + Math.min(0.05, (now - last) / 1000) * 0.28) % 1;
      last = now;
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, inView, draw]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <PanelHeader
        eyebrow="Deep 05 · Sinkhorn"
        title={
          <>
            Melt one shape <span className="text-cyan-400">into another</span>.
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
          className="block aspect-[3/2] w-full max-w-full"
          style={{ filter: "saturate(1.12) contrast(1.04)" }}
          role="img"
          aria-label="Optimal transport plan drawn as glowing arcs from a source distribution to a target distribution, with mass particles streaming along the coupling"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && <BootOverlay />}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            REAL Sinkhorn · entropic OT
          </span>
          {state && (
            <div
              className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm"
              style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  cost
                </span>
                <span className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>
                  {state.cost.toFixed(4)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  ε
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: VIOLET }}>
                  {state.eps < 0.1 ? state.eps.toFixed(4) : state.eps.toFixed(3)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  Δmass
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD }}>
                  {Math.abs(state.residual).toExponential(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Slider
          label="bins n"
          value={nDisp}
          min={8}
          max={48}
          step={1}
          onChange={setNDisp}
          onCommit={(v) => setNCommit(v)}
          disabled={!ready}
        />
        <Slider
          label="ε"
          value={epsPosDisp}
          min={0}
          max={1}
          step={0.02}
          onChange={setEpsPosDisp}
          onCommit={(v) => setEpsPosCommit(v)}
          color={VIOLET}
          format={() => (epsDisp < 0.1 ? epsDisp.toFixed(4) : epsDisp.toFixed(3))}
          disabled={!ready}
        />
      </div>

      <Readout>
        {state ? (
          <>
            {state.n} bins · optimal coupling P ({state.n}×{state.n}) · transport cost{" "}
            <span style={{ color: CYAN }}>{state.cost.toFixed(4)}</span> · mass conserved to{" "}
            <span style={{ color: EMERALD }}>{Math.abs(state.residual).toExponential(0)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{state.ms.toFixed(0)} ms in WASM</span>
          </>
        ) : (
          "Sinkhorn-scaling the coupling toward the optimum…"
        )}
      </Readout>

      <Caption>
        Genuine <span className="text-slate-200">entropic optimal transport</span>, solved by{" "}
        <span className="text-cyan-300">Sinkhorn</span> matrix scaling: the cheapest possible plan to move every grain of
        mass from the <span style={{ color: CYAN }}>source</span> distribution into the{" "}
        <span style={{ color: ROSE }}>target</span> — the same primitive behind Wasserstein distances, color transfer, and
        distribution matching in ML. Each glowing arc is a coupled pair P<sub>ij</sub>; the particles are mass in transit. The
        marginals are recovered to <span style={{ color: EMERALD }}>~10⁻¹⁶</span>, so no mass is created or destroyed. Shrink{" "}
        <span style={{ color: VIOLET }}>ε</span> and the entropy blur relaxes — the plan sharpens toward the crisp,
        unregularized optimum, recomputed live in your browser.
      </Caption>
    </SyncContainer>
  );
}
