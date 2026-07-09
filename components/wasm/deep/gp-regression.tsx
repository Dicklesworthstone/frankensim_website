"use client";

/**
 * Deep Kernel 03 — "The machine decides where to look."
 *
 * Drives the real `gp_regression(nTrain, samples)` kernel: a 1-D Matérn Gaussian-
 * process posterior with an expected-improvement acquisition, from fs-bo (Bayesian
 * optimization). The kernel returns the training observations, the posterior mean and
 * variance sampled across the domain, the EI curve, and the argmax x_next where a
 * rational optimizer would sample next.
 *
 * We draw the posterior mean (cyan) inside a shaded ±σ / ±2σ uncertainty band, the
 * observations as glowing anchors, and — below — the EI acquisition (violet) with a
 * pulsing marker at x_next. The band pinches to nothing at the data and balloons in
 * the gaps; EI peaks exactly where the model is both uncertain and promising.
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
  useReducedMotionSafe,
  useCanvasDpr,
  PanelHeader,
  Slider,
  ErrorNote,
  BootOverlay,
  Readout,
  Caption,
} from "./_chrome";

interface GPData {
  train: { x: number; y: number }[];
  xs: Float64Array;
  mean: Float64Array;
  sd: Float64Array; // √variance
  ei: Float64Array;
  s: number;
  xNext: number;
  eiMax: number;
  xLo: number;
  xHi: number;
  yLo: number;
  yHi: number;
  ms: number;
}

function decode(raw: Float64Array, ms: number): GPData {
  const ntr = raw[0] | 0;
  const train: { x: number; y: number }[] = [];
  let o = 1;
  for (let i = 0; i < ntr; i++) {
    train.push({ x: raw[o], y: raw[o + 1] });
    o += 2;
  }
  const s = raw[o] | 0;
  o += 1;
  const xs = new Float64Array(s);
  const mean = new Float64Array(s);
  const sd = new Float64Array(s);
  const ei = new Float64Array(s);
  let yLo = Infinity;
  let yHi = -Infinity;
  for (let j = 0; j < s; j++) {
    const b = o + j * 4;
    xs[j] = raw[b];
    mean[j] = raw[b + 1];
    sd[j] = Math.sqrt(Math.max(0, raw[b + 2]));
    ei[j] = Math.max(0, raw[b + 3]);
    yLo = Math.min(yLo, mean[j] - 2 * sd[j]);
    yHi = Math.max(yHi, mean[j] + 2 * sd[j]);
  }
  o += s * 4;
  const xNext = raw[o];
  const eiMax = Math.max(1e-9, raw[o + 1]);
  for (const t of train) {
    yLo = Math.min(yLo, t.y);
    yHi = Math.max(yHi, t.y);
  }
  const pad = (yHi - yLo) * 0.12 || 0.5;
  return {
    train,
    xs,
    mean,
    sd,
    ei,
    s,
    xNext,
    eiMax,
    xLo: xs[0],
    xHi: xs[s - 1],
    yLo: yLo - pad,
    yHi: yHi + pad,
    ms,
  };
}

export default function GpRegression() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [nTrain, setNTrain] = useState(6);
  const [samples, setSamples] = useState(256);
  const [state, setState] = useState<GPData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GPData | null>(null);
  stateRef.current = state;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const phaseRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const d = stateRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    if (!d) return;

    const padL = W * 0.02;
    const padR = W * 0.02;
    const padT = H * 0.06;
    const gap = H * 0.04;
    const eiH = H * 0.26; // acquisition band height
    const postB = H - eiH - gap; // posterior bottom
    const postT = padT;
    const eiT = postB + gap;
    const eiB = H - H * 0.02;

    const X = (x: number) => padL + ((x - d.xLo) / (d.xHi - d.xLo)) * (W - padL - padR);
    const Y = (y: number) => postB - ((y - d.yLo) / (d.yHi - d.yLo)) * (postB - postT);
    const EY = (e: number) => eiB - (e / d.eiMax) * (eiB - eiT);
    const s = d.s;

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = Math.max(0.6, W / 1100);
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const gx = X(d.xLo + ((d.xHi - d.xLo) * i) / 6);
      ctx.moveTo(gx, postT);
      ctx.lineTo(gx, eiB);
    }
    ctx.stroke();
    // zero line for mean
    ctx.strokeStyle = "rgba(148,163,184,0.14)";
    ctx.beginPath();
    ctx.moveTo(padL, Y(0));
    ctx.lineTo(W - padR, Y(0));
    ctx.stroke();

    // uncertainty bands (±2σ faint, ±1σ stronger)
    const bandPath = (k: number): Path2D => {
      const p = new Path2D();
      p.moveTo(X(d.xs[0]), Y(d.mean[0] + k * d.sd[0]));
      for (let j = 1; j < s; j++) p.lineTo(X(d.xs[j]), Y(d.mean[j] + k * d.sd[j]));
      for (let j = s - 1; j >= 0; j--) p.lineTo(X(d.xs[j]), Y(d.mean[j] - k * d.sd[j]));
      p.closePath();
      return p;
    };
    ctx.fillStyle = "rgba(34,211,238,0.09)";
    ctx.fill(bandPath(2));
    ctx.fillStyle = "rgba(34,211,238,0.16)";
    ctx.fill(bandPath(1));

    // mean line (glowing cyan)
    const meanPath = new Path2D();
    meanPath.moveTo(X(d.xs[0]), Y(d.mean[0]));
    for (let j = 1; j < s; j++) meanPath.lineTo(X(d.xs[j]), Y(d.mean[j]));
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.4, W / 360);
    ctx.shadowBlur = Math.max(4, W / 130);
    ctx.shadowColor = CYAN_GLOW;
    ctx.strokeStyle = CYAN_GLOW;
    ctx.stroke(meanPath);
    ctx.shadowBlur = 0;

    // EI acquisition (violet) — filled + line
    const phase = phaseRef.current;
    const eiFill = new Path2D();
    eiFill.moveTo(X(d.xs[0]), eiB);
    for (let j = 0; j < s; j++) eiFill.lineTo(X(d.xs[j]), EY(d.ei[j]));
    eiFill.lineTo(X(d.xs[s - 1]), eiB);
    eiFill.closePath();
    ctx.fillStyle = "rgba(168,85,247,0.16)";
    ctx.fill(eiFill);
    const eiLine = new Path2D();
    eiLine.moveTo(X(d.xs[0]), EY(d.ei[0]));
    for (let j = 1; j < s; j++) eiLine.lineTo(X(d.xs[j]), EY(d.ei[j]));
    ctx.lineWidth = Math.max(1, W / 500);
    ctx.shadowBlur = Math.max(3, W / 200);
    ctx.shadowColor = VIOLET;
    ctx.strokeStyle = "#c084fc";
    ctx.stroke(eiLine);
    ctx.shadowBlur = 0;

    // x_next guide + pulsing marker
    const nx = X(d.xNext);
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = Math.max(0.8, W / 700);
    ctx.strokeStyle = `${AMBER}99`;
    ctx.beginPath();
    ctx.moveTo(nx, postT);
    ctx.lineTo(nx, eiB);
    ctx.stroke();
    ctx.setLineDash([]);

    const pulse = reducedRef.current ? 0.5 : 0.5 + 0.5 * Math.sin(phase * 3.2);
    const ny = EY(d.eiMax);
    const rr = Math.max(3, W / 150) * (1 + 0.35 * pulse);
    // expanding ring
    ctx.globalAlpha = 0.5 * (1 - pulse);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = Math.max(1, W / 500);
    ctx.beginPath();
    ctx.arc(nx, ny, rr * (1.6 + pulse), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(nx, ny, rr, 0, Math.PI * 2);
    ctx.fillStyle = AMBER;
    ctx.shadowBlur = Math.max(6, W / 90);
    ctx.shadowColor = AMBER;
    ctx.fill();
    ctx.shadowBlur = 0;

    // training observations
    for (const t of d.train) {
      const tx = X(t.x);
      const ty = Y(t.y);
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(3.5, W / 130), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(4,9,13,0.9)";
      ctx.fill();
      ctx.lineWidth = Math.max(1.4, W / 320);
      ctx.strokeStyle = CYAN_GLOW;
      ctx.shadowBlur = Math.max(4, W / 150);
      ctx.shadowColor = CYAN;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(1.4, W / 380), 0, Math.PI * 2);
      ctx.fillStyle = "#e6feff";
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // labels
    ctx.font = `${Math.max(9, Math.round(W / 62))}px ui-monospace, monospace`;
    ctx.fillStyle = "rgba(148,163,184,0.7)";
    ctx.textBaseline = "top";
    ctx.fillText("posterior μ ± σ", padL + 4, postT + 2);
    ctx.fillStyle = "rgba(192,132,252,0.85)";
    ctx.fillText("expected improvement", padL + 4, eiT + 2);
    ctx.fillStyle = AMBER;
    ctx.textAlign = nx > W * 0.8 ? "right" : "left";
    ctx.fillText("x_next", nx + (nx > W * 0.8 ? -6 : 6), postT + 2);
    ctx.textAlign = "left";
  }, []);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);
  const stableRedraw = useCallback(() => drawRef.current(), []);
  useCanvasDpr(canvasRef, stableRedraw);

  /* -- compute (fast; recompute on any slider change) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("gp_regression", nTrain, samples);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const decoded = decode(raw, ms);
        // The kernel folds a Cholesky/fit failure to an all-NaN tail (x_next,
        // EI, posterior). Guard so the HUD never prints the literal "NaN".
        if (!Number.isFinite(decoded.xNext) || !Number.isFinite(decoded.yLo)) {
          setState(null);
          setError("GP fit failed (near-singular covariance) — adjust the training set.");
          return;
        }
        setState(decoded);
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, nTrain, samples, call]);

  useEffect(() => {
    draw();
  }, [draw, state]);

  /* -- pulse loop (marker only) -- */
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
      phaseRef.current += Math.min(0.05, (now - last) / 1000);
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
        eyebrow="Deep 03 · fs-bo"
        title={
          <>
            The machine decides <span className="text-cyan-400">where to look</span>.
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
          role="img"
          aria-label="A Gaussian-process posterior mean with a shaded uncertainty band over training observations, and an expected-improvement acquisition curve with a marker at the next sample point"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && <BootOverlay />}

        <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1.5">
          <span
            className="ml-auto w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            REAL fs-bo · Matérn GP + EI
          </span>
          {state && (
            <div
              className="ml-auto w-fit rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm"
              style={{ borderColor: `${AMBER}44`, background: "rgba(4,9,13,0.72)" }}
            >
              <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                next sample x_next
              </div>
              <div className="font-mono text-[15px] font-black tabular-nums" style={{ color: AMBER, textShadow: `0 0 12px ${AMBER}88` }}>
                {state.xNext.toFixed(3)}
              </div>
              <div className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>
                EI_max {state.eiMax.toExponential(1)} · {state.ms.toFixed(1)} ms
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
        <Slider label="train" value={nTrain} min={3} max={16} step={1} onChange={setNTrain} disabled={!ready} />
        <Slider
          label="res"
          value={samples}
          min={64}
          max={512}
          step={32}
          onChange={setSamples}
          color={VIOLET}
          disabled={!ready}
        />
      </div>

      <Readout>
        {state ? (
          <>
            {state.train.length} observations · {state.s}-point posterior · argmax EI at{" "}
            <span style={{ color: AMBER }}>x_next = {state.xNext.toFixed(3)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{state.ms.toFixed(1)} ms in WASM</span>
          </>
        ) : (
          "fitting the Matérn posterior + expected-improvement acquisition…"
        )}
      </Readout>

      <Caption>
        A real <span className="text-slate-200">Gaussian-process</span> posterior from{" "}
        <span className="text-cyan-300">fs-bo</span>: a Matérn kernel conditioned on the observations gives a mean (the{" "}
        <span style={{ color: CYAN }}>cyan curve</span>) and a calibrated uncertainty — the shaded band — that{" "}
        <span className="text-slate-200">pinches to nothing at the data</span> and balloons in the gaps between. Below, the{" "}
        <span style={{ color: VIOLET }}>expected-improvement</span> acquisition scores every candidate by how much it could
        beat the best seen so far; its peak, marked <span style={{ color: AMBER }}>x_next</span>, is exactly where a rational
        optimizer samples next — high uncertainty <em>and</em> high promise. This is the decision engine inside Bayesian
        optimization, fit from scratch in your browser as you add points.
      </Caption>
    </SyncContainer>
  );
}
