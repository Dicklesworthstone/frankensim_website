"use client";

/**
 * Campaign 06 — sensorforge(threshold, max_sensors, b_prior_mean) · fs-oed-e2e
 * "Measure the decision, not the uncertainty."
 *
 * Four candidate designs (A/B/C/D), each a Gaussian belief over its unknown cost.
 * You must ship the cheapest, but you can buy sensor readings first — every reading
 * is fused by an EXACT scalar Kalman update that shrinks that candidate's variance.
 * At each step the value-of-information rule (fs-oed) places the next sensor on the
 * candidate that most sharpens the DECISION — not the most-uncertain one — and STOPS
 * the instant the expected value of perfect information (EVPI) drops below threshold.
 *
 * The result is the money shot: sensors land only on the two decision-relevant
 * contenders (A and B alternate; the dominated C/D never get touched), EVPI plunges
 * 0.163 → 0.0097 over ~8 placements, and the true-best design A is chosen. Top: the
 * EVPI descent curve diving to the emerald stop line, each placement marker colored
 * by which candidate got the sensor. Bottom: the four beliefs as Gaussian bells that
 * visibly SHARPEN as sensors land — A and B towering, C/D left wide and dim — with A
 * crowned as the certified choice. Every number is live compiled Rust.
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
  MUTED,
  BRIGHT,
  dpr,
  hexRgb,
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Slider,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/deep/_chrome";

/* Fixed candidate metadata — the four designs of demo_candidates() are a structural
   constant of the campaign (like the names A/B/C/D); every VALUE below (posterior
   mean, posterior variance, EVPI trace, placements) is live wasm output. Prior
   variances are the demo constants; B's prior mean is the b_prior_mean slider. A/B
   are the vivid contenders, C/D the dim dominated designs. */
const CAND: { name: string; priorVar: number; color: string; rgba: (a: number) => string }[] = [
  { name: "A", priorVar: 0.1, color: CYAN_GLOW, rgba: (a) => `rgba(34,211,238,${a})` },
  { name: "B", priorVar: 0.12, color: AMBER, rgba: (a) => `rgba(251,191,36,${a})` },
  { name: "C", priorVar: 0.06, color: "#64748b", rgba: (a) => `rgba(100,116,139,${a})` },
  { name: "D", priorVar: 0.04, color: "#475569", rgba: (a) => `rgba(71,85,105,${a})` },
];
const PRIOR_MEAN = [0.6, 0.65, 0.85, 1.1]; // B (index 1) is overridden by the slider

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

interface Belief {
  postMean: number;
  postVar: number;
  priorMean: number;
  priorVar: number;
}
interface SFData {
  c: number;
  s: number;
  priorVar: number;
  postVar: number;
  varReduction: number;
  initialEvpi: number;
  finalEvpi: number;
  robust: boolean;
  chosen: number;
  trace: number[]; // length s+1, EVPI after each placement ([0]=initial)
  placements: number[]; // length s, candidate index each sensor measured
  beliefs: Belief[];
  threshold: number;
  ms: number;
}

function decode(raw: Float64Array, threshold: number, bMean: number, ms: number): SFData {
  const c = raw[0] | 0;
  const s = raw[1] | 0;
  const t = raw[9] | 0;
  let o = 10;
  const trace: number[] = [];
  for (let i = 0; i < t; i++) trace.push(raw[o + i]);
  o += t;
  const placements: number[] = [];
  for (let i = 0; i < s; i++) placements.push(raw[o + i] | 0);
  o += s;
  const beliefs: Belief[] = [];
  for (let i = 0; i < c; i++) {
    beliefs.push({
      postMean: raw[o],
      postVar: Math.max(1e-9, raw[o + 1]),
      priorMean: i === 1 ? bMean : PRIOR_MEAN[i] ?? raw[o],
      priorVar: CAND[i]?.priorVar ?? Math.max(1e-9, raw[o + 1]),
    });
    o += 2;
  }
  return {
    c,
    s,
    priorVar: raw[2],
    postVar: raw[3],
    varReduction: raw[4],
    initialEvpi: raw[5],
    finalEvpi: raw[6],
    robust: raw[7] > 0.5,
    chosen: raw[8] | 0,
    trace,
    placements,
    beliefs,
    threshold,
    ms,
  };
}

export default function SensorForge() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [threshold, setThreshold] = useState(0.01);
  const [maxSensors, setMaxSensors] = useState(12);
  const [bMean, setBMean] = useState(0.65);
  const [data, setData] = useState<SFData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<SFData | null>(null);
  dataRef.current = data;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  const finalEvpiRef = useEasedText<HTMLSpanElement>(data?.finalEvpi ?? 0, reduced, (v) => v.toFixed(4), {
    enabled: !!data,
    inViewRef,
  });
  const varRedRef = useEasedText<HTMLSpanElement>(data ? data.varReduction * 100 : 0, reduced, (v) => `${v.toFixed(0)}%`, {
    enabled: !!data,
    inViewRef,
  });
  const sensorsRef = useEasedText<HTMLSpanElement>(data?.s ?? 0, reduced, (v) => String(Math.round(v)), {
    enabled: !!data,
    inViewRef,
  });

  /* -- compute (latest-wins) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("sensorforge", threshold, maxSensors, bMean);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        setData(decode(raw, threshold, bMean, ms));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, threshold, maxSensors, bMean, call]);

  /* -- draw both regions at a given placement reveal -- */
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
    const fs = Math.max(8, W / 60);

    /* ---- region split ---- */
    const padL = W * 0.12;
    const padR = W * 0.05;
    const gap = H * 0.06;
    const topT = H * 0.08;
    const topB = H * 0.5;
    const botT = topB + gap;
    const botB = H - H * 0.09;
    const plotW = W - padL - padR;

    /* ================= TOP · EVPI descent ================= */
    {
      const S = Math.max(1, d.s);
      const yTop = Math.max(d.initialEvpi, d.threshold) * 1.14 || 1;
      const X = (step: number) => padL + (S > 0 ? step / S : 0) * plotW;
      const Y = (e: number) => topB - (e / yTop) * (topB - topT);

      // grid
      ctx.strokeStyle = "rgba(148,163,184,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const gy = topT + ((topB - topT) * i) / 4;
        ctx.moveTo(padL, gy);
        ctx.lineTo(W - padR, gy);
      }
      ctx.stroke();

      // y-axis label + endpoints
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(d.initialEvpi.toFixed(3), padL - W * 0.012, Y(d.initialEvpi));
      ctx.fillText("0", padL - W * 0.012, topB);

      // emerald stop-threshold line
      const yThr = Y(d.threshold);
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, yThr);
      ctx.lineTo(W - padR, yThr);
      ctx.strokeStyle = "rgba(16,185,129,0.6)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = EMERALD;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`stop θ = ${d.threshold.toFixed(3)}`, padL + 4, yThr - 3);

      // section label
      ctx.fillStyle = "rgba(148,163,184,0.75)";
      ctx.textBaseline = "top";
      ctx.fillText("EVPI · value of the decision ↓", padL + 4, topT + 2);

      // reveal clip (draw the descent left→right)
      const clipStep = reveal * S;
      const clipX = X(clipStep) + 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipX, H);
      ctx.clip();

      // descent polyline
      ctx.beginPath();
      ctx.moveTo(X(0), Y(d.trace[0]));
      for (let k = 1; k < d.trace.length; k++) ctx.lineTo(X(k), Y(d.trace[k]));
      ctx.strokeStyle = rgba(CYAN, 0.95);
      ctx.lineWidth = Math.max(1.8, W / 300);
      ctx.shadowColor = CYAN_GLOW;
      ctx.shadowBlur = 9;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // placement markers — step 0 = initial (neutral), step k colored by placement
      ctx.textAlign = "center";
      for (let k = 0; k < d.trace.length; k++) {
        if (k > clipStep + 1e-6) continue;
        const mx = X(k);
        const my = Y(d.trace[k]);
        const isInit = k === 0;
        const cand = isInit ? -1 : d.placements[k - 1];
        const col = isInit ? BRIGHT : CAND[cand]?.color ?? MUTED;
        const belowStop = d.trace[k] <= d.threshold;
        const isLast = k === d.trace.length - 1;
        if (isLast && d.robust) {
          const pulse = rm ? 1 : 0.72 + 0.28 * Math.sin(time * 0.005);
          ctx.beginPath();
          ctx.arc(mx, my, Math.max(0.1, Math.max(5.5, W / 96) * pulse), 0, Math.PI * 2);
          ctx.strokeStyle = EMERALD;
          ctx.lineWidth = Math.max(1.3, W / 320);
          ctx.shadowColor = EMERALD;
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        const mR = Math.max(0.1, Math.max(2.8, W / 150));
        ctx.beginPath();
        ctx.arc(mx, my, mR, 0, Math.PI * 2);
        ctx.fillStyle = belowStop && !isInit ? EMERALD : col;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = isInit ? 4 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        // crisp rim: separate each marker from the descent line behind it
        ctx.beginPath();
        ctx.arc(mx, my, mR, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(4,9,13,0.85)";
        ctx.lineWidth = Math.max(0.75, W / 660);
        ctx.stroke();
        // small candidate letter above each placement marker
        if (!isInit && reveal > 0.02) {
          ctx.fillStyle = col;
          ctx.font = `700 ${Math.max(7, W / 78)}px ui-monospace, monospace`;
          ctx.textBaseline = "bottom";
          ctx.fillText(CAND[cand]?.name ?? "?", mx, my - Math.max(6, W / 120));
        }
      }

      // x-axis label
      ctx.fillStyle = "rgba(148,163,184,0.6)";
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("sensors placed →", padL + plotW / 2, topB + 4);
    }

    /* ================= BOTTOM · belief bells ================= */
    {
      // shared cost axis
      let xLo = Infinity;
      let xHi = -Infinity;
      for (const b of d.beliefs) {
        xLo = Math.min(xLo, b.postMean, b.priorMean);
        xHi = Math.max(xHi, b.postMean, b.priorMean);
      }
      xLo -= 0.42;
      xHi += 0.42;
      const plotH = botB - botT;
      const X = (x: number) => padL + ((x - xLo) / (xHi - xLo)) * plotW;

      // baseline
      ctx.strokeStyle = "rgba(148,163,184,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, botB);
      ctx.lineTo(W - padR, botB);
      ctx.stroke();

      // normalization: tallest FINAL peak fills ~82% of the band
      let maxPeak = 0;
      for (const b of d.beliefs) maxPeak = Math.max(maxPeak, 1 / Math.sqrt(b.postVar));
      const scale = (plotH * 0.82) / Math.max(1e-6, maxPeak);
      const bell = (mu: number, sig: number, xv: number) => Math.exp(-0.5 * ((xv - mu) / sig) ** 2);

      // section label
      ctx.fillStyle = "rgba(148,163,184,0.75)";
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("beliefs · cost (lower = better) →", padL + 4, botT - 1);

      const N = 90;
      // draw dominated (C/D) first, then contenders (A/B) on top
      const order = [3, 2, 1, 0];
      for (const i of order) {
        const b = d.beliefs[i];
        if (!b) continue;
        const meta = CAND[i];
        const sigP = Math.sqrt(b.priorVar);
        const sigQ = Math.sqrt(b.postVar);
        const sig = sigP + (sigQ - sigP) * reveal; // shrink as sensors land
        const mu = b.priorMean + (b.postMean - b.priorMean) * reveal;
        const peak = scale / sig;

        // prior (before) — faint dashed outline
        ctx.beginPath();
        for (let n = 0; n <= N; n++) {
          const xv = xLo + ((xHi - xLo) * n) / N;
          const yy = botB - Math.min(plotH * 0.95, scale / sigP * bell(b.priorMean, sigP, xv));
          if (n === 0) ctx.moveTo(X(xv), yy);
          else ctx.lineTo(X(xv), yy);
        }
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = meta.rgba(0.28);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // current (after) — filled + stroked bell
        const path = new Path2D();
        path.moveTo(X(xLo), botB);
        for (let n = 0; n <= N; n++) {
          const xv = xLo + ((xHi - xLo) * n) / N;
          const yy = botB - Math.min(plotH * 0.95, peak * bell(mu, sig, xv));
          path.lineTo(X(xv), yy);
        }
        path.lineTo(X(xHi), botB);
        path.closePath();
        const isContender = i <= 1;
        ctx.fillStyle = meta.rgba(isContender ? 0.16 : 0.08);
        ctx.fill(path);
        ctx.strokeStyle = meta.rgba(isContender ? 0.95 : 0.5);
        ctx.lineWidth = Math.max(1.2, W / (isContender ? 340 : 460));
        if (isContender) {
          ctx.shadowColor = meta.color;
          ctx.shadowBlur = 11;
        }
        ctx.stroke(path);
        ctx.shadowBlur = 0;

        // mean tick + candidate letter on the axis
        const mx = X(mu);
        ctx.strokeStyle = meta.rgba(0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, botB);
        ctx.lineTo(mx, botB + Math.max(4, W / 120));
        ctx.stroke();
        ctx.fillStyle = i === d.chosen ? EMERALD : meta.color;
        ctx.font = `700 ${Math.max(9, W / 56)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(meta.name, mx, botB + Math.max(6, W / 90));

        // crown the chosen (true-best) candidate
        if (i === d.chosen && reveal > 0.6) {
          const cy = botB - Math.min(plotH * 0.95, peak);
          const pulse = rm ? 1 : 0.7 + 0.3 * Math.sin(time * 0.005);
          ctx.beginPath();
          ctx.arc(mx, cy, Math.max(0.1, Math.max(4, W / 150) * pulse), 0, Math.PI * 2);
          ctx.fillStyle = EMERALD;
          ctx.shadowColor = EMERALD;
          ctx.shadowBlur = 16 * pulse;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = EMERALD;
          ctx.font = `700 ${Math.max(8, W / 66)}px ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText("♛ chosen", mx, cy - Math.max(6, W / 90));
        }
      }
    }
  }, []);

  /* -- DPR sizing + redraw -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const d = dpr();
      const cssW = canvas.clientWidth || 480;
      const w = Math.max(240, Math.min(1100, Math.round(cssW * d)));
      const h = Math.round(w * 0.82);
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

  /* -- reveal the placements on first data; snap on later solves -- */
  useEffect(() => {
    if (!data) return;
    if (!seenRef.current) {
      seenRef.current = true;
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    } else {
      revealRef.current = 1;
    }
  }, [data]);

  /* -- animation loop (gated by view + reduced-motion) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      draw(1, 0);
      return;
    }
    const DUR = Math.min(2200, 380 + 200 * Math.max(1, data.s));
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
  }, [data, inView, reduced, inViewRef, draw]);

  const placementSeq = data ? data.placements.map((i) => CAND[i]?.name ?? "?").join(" ") : "";

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 06 · fs-oed-e2e · value of information</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Measure the <span className="text-emerald-400">decision</span>, not the uncertainty.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full"
          style={{ aspectRatio: "1 / 0.82" }}
          role="img"
          aria-label="Top: an EVPI descent curve diving toward an emerald stop-threshold line, each placement marker colored by which candidate got the sensor. Bottom: four candidate beliefs drawn as Gaussian bells that sharpen as sensors land, with the chosen design crowned."
        />
        <span
          className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
          style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}
        >
          exact Kalman × EVPI
        </span>

        {/* chosen seal */}
        {data && (
          <div
            className="pointer-events-none absolute right-3 top-3 flex flex-col items-end rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm"
            style={{ borderColor: `${EMERALD}44`, background: "rgba(4,9,13,0.72)" }}
          >
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              chosen design
            </span>
            <span
              className="font-mono text-[22px] font-black leading-none tabular-nums md:text-[26px]"
              style={{ color: "#d1fae5", textShadow: `0 0 14px ${EMERALD}88` }}
            >
              {CAND[data.chosen]?.name ?? "—"}
            </span>
            <span
              className="mt-1 rounded-full border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em]"
              style={
                data.robust
                  ? { borderColor: `${EMERALD}88`, background: `${EMERALD}14`, color: EMERALD }
                  : { borderColor: `${AMBER}66`, background: `${AMBER}12`, color: AMBER }
              }
            >
              {data.robust ? "EVPI-certified stop" : "budget-limited"}
            </span>
          </div>
        )}

        {!ready && <BootOverlay />}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* scalar tiles */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${CYAN}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            sensors placed
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: CYAN_GLOW }}>
            <span ref={sensorsRef}>{data?.s ?? "—"}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${EMERALD}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            variance ↓
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: EMERALD }}>
            <span ref={varRedRef}>{data ? `${(data.varReduction * 100).toFixed(0)}%` : "—"}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${VIOLET}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            EVPI initial
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: VIOLET }}>
            {data ? data.initialEvpi.toFixed(3) : "—"}
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${EMERALD}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            EVPI final
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: EMERALD }}>
            <span ref={finalEvpiRef}>{data ? data.finalEvpi.toFixed(4) : "—"}</span>
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-col gap-2.5">
        <Slider
          label="stop θ"
          value={threshold}
          min={0.002}
          max={0.2}
          step={0.002}
          onChange={setThreshold}
          format={(v) => v.toFixed(3)}
          color={EMERALD}
          disabled={!ready}
        />
        <Slider
          label="max sensors"
          value={maxSensors}
          min={1}
          max={16}
          step={1}
          onChange={(v) => setMaxSensors(Math.round(v))}
          format={(v) => String(Math.round(v))}
          disabled={!ready}
        />
        <Slider
          label="B prior μ"
          value={bMean}
          min={0.6}
          max={0.9}
          step={0.01}
          onChange={setBMean}
          format={(v) => v.toFixed(2)}
          color={AMBER}
          disabled={!ready}
        />
      </div>

      {/* readout */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {data ? (
          <>
            <span style={{ color: CYAN_GLOW }}>{data.s}</span> sensors on{" "}
            <span style={{ color: BRIGHT }}>{placementSeq || "—"}</span> · EVPI{" "}
            <span style={{ color: VIOLET }}>{data.initialEvpi.toFixed(3)}</span> →{" "}
            <span style={{ color: EMERALD }}>{data.finalEvpi.toFixed(4)}</span> · variance{" "}
            <span style={{ color: EMERALD }}>−{(data.varReduction * 100).toFixed(0)}%</span> · chose{" "}
            <span style={{ color: EMERALD }}>{CAND[data.chosen]?.name ?? "—"}</span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(2)} ms in WASM</span>
          </>
        ) : (
          "placing each sensor by value of information, fusing exact Kalman updates, stopping when EVPI clears θ…"
        )}
      </div>

      {/* caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Four candidate designs, each a <span className="text-slate-200">Gaussian belief</span> over its unknown cost, and you
        must ship the cheapest. Every sensor reading is fused by an <span style={{ color: EMERALD }}>exact scalar Kalman
        update</span> (<span className="text-cyan-300">fs-oed</span>) that shrinks that candidate&apos;s variance. At each step the{" "}
        <span style={{ color: VIOLET }}>value-of-information</span> rule places the next sensor on the candidate that most
        sharpens the <span className="text-slate-200">decision</span>, not the most-uncertain one, and{" "}
        <span style={{ color: EMERALD }}>stops</span> the instant EVPI drops below θ. Watch the sensors land only on the
        decision-relevant contenders <span style={{ color: CYAN_GLOW }}>A</span> and <span style={{ color: AMBER }}>B</span>{" "}
        (they alternate; the dominated <span style={{ color: "#94a3b8" }}>C/D</span> are never touched), EVPI plunge to the
        emerald stop line, and the two contender bells tower as their variance collapses, with true-best{" "}
        <span style={{ color: EMERALD }}>A</span> crowned. Compiled Rust, certified live in your tab.
      </div>
    </SyncContainer>
  );
}
