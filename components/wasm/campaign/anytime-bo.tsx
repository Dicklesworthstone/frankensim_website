"use client";

/**
 * Campaign 09 — anytimebo(max_iters, delta, alpha) · fs-adaptbo-e2e
 * "Stop the instant the evidence says stop — and peek all you like."
 *
 * Bayesian optimization minimizes a tilted double-well objective on [0,4]. Each
 * iteration fits a Matérn-5/2 Gaussian process, samples the point of maximum expected
 * improvement, and feeds a single binary "did the incumbent improve?" indicator into a
 * betting e-process (a test martingale). The search STOPS the first iteration the
 * log-e-value crosses the Ville threshold ln(1/α) — an anytime-valid decision that
 * stays sound even though you inspected it after every single iteration (no
 * alpha-spending, no fixed horizon).
 *
 * At the defaults it stops at iter 12 with log-e 3.17 > threshold 2.996, having found
 * best_x ≈ 3.0, best_value ≈ −0.45. Top panel: the double-well objective with the
 * initial design plus every sampled point dropping in, the running incumbent
 * descending, and the certified best crowned. Bottom panel: the log-e trajectory
 * climbing as a bold line across the horizontal Ville threshold, the crossing marked
 * as the certified STOP with a vertical line rhymed through both panels. Everything is
 * live compiled Rust.
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

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

interface Row {
  x: number;
  y: number;
  inc: number; // running incumbent (best-so-far)
  logE: number;
}
interface BOData {
  iters: number;
  ville: number;
  stopped: boolean;
  bestX: number;
  bestValue: number;
  evals: number;
  ciCenter: number;
  ciRadius: number;
  init: { x: number; y: number }[];
  rows: Row[];
  gridX: Float64Array;
  gridY: Float64Array;
  logEStop: number;
  ms: number;
}

function decode(raw: Float64Array, ms: number): BOData {
  const iters = raw[0] | 0;
  const nInit = raw[8] | 0;
  let o = 9;
  const init: { x: number; y: number }[] = [];
  for (let i = 0; i < nInit; i++) {
    init.push({ x: raw[o], y: raw[o + 1] });
    o += 2;
  }
  const iI = raw[o] | 0;
  o += 1;
  const rows: Row[] = [];
  for (let i = 0; i < iI; i++) {
    rows.push({ x: raw[o], y: raw[o + 1], inc: raw[o + 2], logE: raw[o + 3] });
    o += 4;
  }
  const g = raw[o] | 0;
  o += 1;
  const gridX = new Float64Array(g);
  const gridY = new Float64Array(g);
  for (let i = 0; i < g; i++) {
    gridX[i] = raw[o];
    gridY[i] = raw[o + 1];
    o += 2;
  }
  return {
    iters,
    ville: raw[1],
    stopped: raw[2] > 0.5,
    bestX: raw[3],
    bestValue: raw[4],
    evals: raw[5] | 0,
    ciCenter: raw[6],
    ciRadius: raw[7],
    init,
    rows,
    gridX,
    gridY,
    logEStop: rows.length ? rows[rows.length - 1].logE : 0,
    ms,
  };
}

export default function AnytimeBo() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [maxIters, setMaxIters] = useState(30);
  const [delta, setDelta] = useState(0.02);
  const [alpha, setAlpha] = useState(0.05);
  const [data, setData] = useState<BOData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<BOData | null>(null);
  dataRef.current = data;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  const iterRef = useEasedText<HTMLSpanElement>(data?.iters ?? 0, reduced, (v) => String(Math.round(v)), {
    enabled: !!data,
    inViewRef,
  });
  const logERef = useEasedText<HTMLSpanElement>(data?.logEStop ?? 0, reduced, (v) => v.toFixed(2), {
    enabled: !!data,
    inViewRef,
  });
  const bestValRef = useEasedText<HTMLSpanElement>(data?.bestValue ?? 0, reduced, (v) => v.toFixed(3), {
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
        const raw = await call<Float64Array>("anytimebo", maxIters, delta, alpha);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        setData(decode(raw, ms));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, maxIters, delta, alpha, call]);

  /* -- draw both panels at a synchronized iteration reveal -- */
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

    const padL = W * 0.11;
    const padR = W * 0.05;
    const plotW = W - padL - padR;
    const gap = H * 0.075;
    const topT = H * 0.07;
    const topB = H * 0.53;
    const botT = topB + gap;
    const botB = H - H * 0.09;

    const I = Math.max(1, d.iters);
    const nShown = reveal * I; // shared playhead: how many BO iterations are revealed

    /* ================= TOP · objective landscape (domain x) ================= */
    {
      const g = d.gridX.length;
      const xLo = g ? d.gridX[0] : 0;
      const xHi = g ? d.gridX[g - 1] : 4;
      let gMin = Infinity;
      for (let i = 0; i < g; i++) gMin = Math.min(gMin, d.gridY[i]);
      const yLo = gMin - 0.4;
      const yHi = 2.4; // cap so the two wells + central hump stay legible (walls clip)
      const X = (x: number) => padL + ((x - xLo) / (xHi - xLo)) * plotW;
      const Y = (y: number) => topB - ((Math.min(yHi, y) - yLo) / (yHi - yLo)) * (topB - topT);

      // grid + zero line
      ctx.strokeStyle = "rgba(148,163,184,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const gx = X(xLo + ((xHi - xLo) * i) / 4);
        ctx.moveTo(gx, topT);
        ctx.lineTo(gx, topB);
      }
      ctx.stroke();
      if (yHi > 0 && yLo < 0) {
        ctx.strokeStyle = "rgba(148,163,184,0.16)";
        ctx.beginPath();
        ctx.moveTo(padL, Y(0));
        ctx.lineTo(W - padR, Y(0));
        ctx.stroke();
      }

      // objective curve (clipped to the panel rect)
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, topT, plotW, topB - topT);
      ctx.clip();
      ctx.beginPath();
      for (let i = 0; i < g; i++) {
        const px = X(d.gridX[i]);
        const py = Y(d.gridY[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = rgba(CYAN, 0.85);
      ctx.lineWidth = Math.max(1.5, W / 320);
      ctx.shadowColor = CYAN_GLOW;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // section label
      ctx.fillStyle = "rgba(148,163,184,0.75)";
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("objective f(x) · minimize", padL + 4, topT + 2);

      // initial design points (hollow neutral)
      for (const p of d.init) {
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), Math.max(0.1, Math.max(2.6, W / 170)), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(4,9,13,0.9)";
        ctx.fill();
        ctx.strokeStyle = rgba(MUTED, 0.75);
        ctx.lineWidth = Math.max(1.1, W / 460);
        ctx.stroke();
      }

      // running incumbent (descending) — dashed emerald line at the current best
      const shownRows = Math.min(d.rows.length, Math.floor(nShown + 1e-6));
      const curInc = shownRows > 0 ? d.rows[shownRows - 1].inc : d.init.reduce((m, p) => Math.min(m, p.y), Infinity);
      if (Number.isFinite(curInc)) {
        const yi = Y(curInc);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = rgba(EMERALD, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, yi);
        ctx.lineTo(W - padR, yi);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(EMERALD, 0.85);
        ctx.font = `${Math.max(7, W / 74)}px ui-monospace, monospace`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(`incumbent ${curInc.toFixed(3)}`, W - padR - 2, yi - 2);
      }

      // BO samples, appearing in sequence (drop in from above + fade)
      for (let k = 0; k < d.rows.length; k++) {
        const appear = Math.max(0, Math.min(1, nShown - k));
        if (appear <= 0) continue;
        const r = d.rows[k];
        const over = r.y > yHi;
        const tx = X(r.x);
        const drop = (1 - appear) * (topB - topT) * 0.14;
        const ty = Y(r.y) - drop;
        const improved = k === 0 ? r.inc < (d.init.reduce((m, p) => Math.min(m, p.y), Infinity)) : r.inc < d.rows[k - 1].inc;
        const col = improved ? EMERALD : AMBER;
        ctx.globalAlpha = appear;
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(0.1, Math.max(2.6, W / 155)), 0, Math.PI * 2);
        ctx.fillStyle = rgba(col, 0.95);
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (over) {
          // sample fell on a steep wall above the cap — tiny up-tick
          ctx.strokeStyle = rgba(col, 0.8);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tx, ty - Math.max(3, W / 150));
          ctx.lineTo(tx, ty - Math.max(7, W / 90));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // certified best: vertical emerald line + crown (rhymes with the STOP line below)
      if (reveal > 0.55 && Number.isFinite(d.bestX)) {
        const bx = X(d.bestX);
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = rgba(EMERALD, 0.5);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(bx, topT);
        ctx.lineTo(bx, topB);
        ctx.stroke();
        ctx.setLineDash([]);
        const by = Y(d.bestValue);
        const pulse = rm ? 1 : 0.7 + 0.3 * Math.sin(time * 0.005);
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(0.1, Math.max(4, W / 140) * pulse), 0, Math.PI * 2);
        ctx.strokeStyle = EMERALD;
        ctx.lineWidth = Math.max(1.3, W / 320);
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = EMERALD;
        ctx.font = `700 ${Math.max(8, W / 66)}px ui-monospace, monospace`;
        ctx.textAlign = bx > W * 0.8 ? "right" : "left";
        ctx.textBaseline = "top";
        ctx.fillText("♛ best", bx + (bx > W * 0.8 ? -5 : 5), by + 5);
      }

      // x-axis
      ctx.fillStyle = "rgba(148,163,184,0.6)";
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("design x ∈ [0, 4] →", padL + plotW / 2, topB + 4);
    }

    /* ================= BOTTOM · log-e vs iteration ================= */
    {
      let leMin = 0;
      let leMax = d.ville;
      for (const r of d.rows) {
        leMin = Math.min(leMin, r.logE);
        leMax = Math.max(leMax, r.logE);
      }
      const lePad = (leMax - leMin) * 0.12 || 0.5;
      leMin -= lePad;
      leMax += lePad;
      const X = (k: number) => padL + (I > 1 ? (k - 1) / (I - 1) : 0.5) * plotW;
      const Y = (v: number) => botB - ((v - leMin) / (leMax - leMin)) * (botB - botT);

      // zero line
      if (leMin < 0 && leMax > 0) {
        ctx.strokeStyle = "rgba(148,163,184,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, Y(0));
        ctx.lineTo(W - padR, Y(0));
        ctx.stroke();
      }

      // Ville threshold line (amber dashed) + shaded rejection band above it
      const yV = Y(d.ville);
      ctx.fillStyle = "rgba(251,191,36,0.05)";
      ctx.fillRect(padL, botT, plotW, Math.max(0, yV - botT));
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, yV);
      ctx.lineTo(W - padR, yV);
      ctx.strokeStyle = "rgba(251,191,36,0.7)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = AMBER;
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`Ville ln(1/α) = ${d.ville.toFixed(3)}`, padL + 4, yV - 3);

      // section label
      ctx.fillStyle = "rgba(148,163,184,0.75)";
      ctx.textBaseline = "top";
      ctx.fillText("log e-value · evidence to stop ↑", padL + 4, botT + 2);

      // log-e trajectory (revealed up to the playhead)
      if (d.rows.length > 0) {
        const shown = Math.min(d.rows.length, nShown);
        ctx.beginPath();
        let started = false;
        for (let k = 0; k < d.rows.length; k++) {
          const kk = k + 1; // iteration index (1-based)
          if (kk > shown + 1) break;
          const frac = Math.max(0, Math.min(1, shown - k));
          if (frac <= 0) break;
          // interpolate the partial final segment for a smooth growing line
          let vx = X(kk);
          let vy = Y(d.rows[k].logE);
          if (frac < 1 && k > 0) {
            const px = X(k);
            const py = Y(d.rows[k - 1].logE);
            vx = px + (vx - px) * frac;
            vy = py + (vy - py) * frac;
          }
          if (!started) {
            ctx.moveTo(X(1), Y(d.rows[0].logE));
            started = true;
          }
          ctx.lineTo(vx, vy);
        }
        // soft under-glow, then a crisp bright core
        ctx.strokeStyle = rgba(CYAN_GLOW, 0.28);
        ctx.lineWidth = Math.max(4, W / 150);
        ctx.shadowColor = CYAN_GLOW;
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.strokeStyle = rgba(CYAN_GLOW, 0.98);
        ctx.lineWidth = Math.max(2, W / 260);
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // point markers (color flips emerald once at/above threshold)
        for (let k = 0; k < d.rows.length; k++) {
          if (k + 1 > nShown + 1e-6) continue;
          const above = d.rows[k].logE >= d.ville;
          ctx.beginPath();
          ctx.arc(X(k + 1), Y(d.rows[k].logE), Math.max(0.1, Math.max(2.2, W / 170)), 0, Math.PI * 2);
          ctx.fillStyle = above ? EMERALD : rgba(CYAN_GLOW, 0.9);
          ctx.fill();
        }
      }

      // certified STOP — vertical emerald line at the crossing iteration
      if (d.stopped && reveal > 0.985) {
        const sx = X(I);
        ctx.strokeStyle = EMERALD;
        ctx.lineWidth = Math.max(1.6, W / 300);
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(sx, botT);
        ctx.lineTo(sx, botB);
        ctx.stroke();
        ctx.shadowBlur = 0;
        const yS = Y(d.logEStop);
        const pulse = rm ? 1 : 0.7 + 0.3 * Math.sin(time * 0.005);
        ctx.beginPath();
        ctx.arc(sx, yS, Math.max(0.1, Math.max(4.5, W / 120) * pulse), 0, Math.PI * 2);
        ctx.strokeStyle = EMERALD;
        ctx.lineWidth = Math.max(1.4, W / 300);
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = EMERALD;
        ctx.font = `700 ${Math.max(8, W / 62)}px ui-monospace, monospace`;
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(`STOP · iter ${I}`, sx - 5, botT + 2);
      }

      // x-axis
      ctx.fillStyle = "rgba(148,163,184,0.6)";
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("iteration →", padL + plotW / 2, botB + H * 0.075);
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
      const h = Math.round(w * 0.9);
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

  /* -- animate the search on first data; snap on later solves -- */
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
    const DUR = Math.min(3000, 500 + 200 * Math.max(1, data.iters));
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

  const crossed = !!data && data.logEStop >= data.ville;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 09 · fs-adaptbo-e2e · anytime-valid BO</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Stop when the <span className="text-emerald-400">evidence</span> says stop.
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
          style={{ aspectRatio: "1 / 0.9" }}
          role="img"
          aria-label="Top panel: a tilted double-well objective curve with the initial design and each sampled point appearing in sequence, the running incumbent descending, and the certified best crowned. Bottom panel: the log-e-value trajectory climbing across a horizontal Ville threshold, with the crossing iteration marked as the certified stop."
        />
        <span
          className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
          style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}
        >
          GP-EI × betting e-process
        </span>

        {/* best seal */}
        {data && (
          <div
            className="pointer-events-none absolute right-3 top-3 flex flex-col items-end rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm"
            style={{ borderColor: `${EMERALD}44`, background: "rgba(4,9,13,0.72)" }}
          >
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              certified best
            </span>
            <span
              className="font-mono text-[20px] font-black leading-none tabular-nums md:text-[24px]"
              style={{ color: "#d1fae5", textShadow: `0 0 14px ${EMERALD}88` }}
            >
              <span ref={bestValRef}>{data.bestValue.toFixed(3)}</span>
            </span>
            <span className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>
              at x = {data.bestX.toFixed(2)}
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
        <div
          className="flex flex-col justify-center rounded-lg border px-2.5 py-2"
          style={
            data?.stopped
              ? { borderColor: `${EMERALD}88`, background: `${EMERALD}12` }
              : { borderColor: `${AMBER}66`, background: `${AMBER}10` }
          }
        >
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            stop iter
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: data?.stopped ? EMERALD : AMBER }}>
            <span ref={iterRef}>{data?.iters ?? "—"}</span>
            {data ? (data.stopped ? "" : " · budget") : ""}
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${CYAN}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            log-e vs Ville
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: crossed ? EMERALD : CYAN_GLOW }}>
            <span ref={logERef}>{data ? data.logEStop.toFixed(2) : "—"}</span>
            <span style={{ color: MUTED }}>{data ? ` / ${data.ville.toFixed(2)}` : ""}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${VIOLET}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            evaluations
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: VIOLET }}>
            {data?.evals ?? "—"}
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${AMBER}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            conf. interval
          </div>
          <div className="font-mono text-[13px] font-black tabular-nums md:text-sm" style={{ color: AMBER }}>
            {data ? `${data.ciCenter.toFixed(2)} ± ${Number.isFinite(data.ciRadius) ? data.ciRadius.toFixed(2) : "∞"}` : "—"}
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-col gap-2.5">
        <Slider
          label="max iters"
          value={maxIters}
          min={1}
          max={40}
          step={1}
          onChange={(v) => setMaxIters(Math.round(v))}
          format={(v) => String(Math.round(v))}
          disabled={!ready}
        />
        <Slider
          label="δ min-gain"
          value={delta}
          min={0.001}
          max={0.2}
          step={0.001}
          onChange={setDelta}
          format={(v) => v.toFixed(3)}
          color={VIOLET}
          disabled={!ready}
        />
        <Slider
          label="α (Ville)"
          value={alpha}
          min={0.001}
          max={0.5}
          step={0.001}
          onChange={setAlpha}
          format={(v) => v.toFixed(3)}
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
            {data.stopped ? (
              <>
                stopped at iter <span style={{ color: EMERALD }}>{data.iters}</span> · log-e{" "}
                <span style={{ color: EMERALD }}>{data.logEStop.toFixed(2)}</span> &gt; Ville{" "}
                <span style={{ color: AMBER }}>{data.ville.toFixed(3)}</span>
              </>
            ) : (
              <>
                ran to budget <span style={{ color: AMBER }}>{data.iters}</span> · log-e{" "}
                <span style={{ color: CYAN_GLOW }}>{data.logEStop.toFixed(2)}</span> &lt; Ville{" "}
                <span style={{ color: AMBER }}>{data.ville.toFixed(3)}</span>
              </>
            )}{" "}
            <span style={{ color: MUTED }}>│</span> best <span style={{ color: EMERALD }}>x = {data.bestX.toFixed(2)}</span>,{" "}
            f = <span style={{ color: EMERALD }}>{data.bestValue.toFixed(3)}</span> · {data.evals} evals{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(2)} ms in WASM</span>
          </>
        ) : (
          "fitting a Matérn GP, sampling max-EI, and betting an e-process against a Ville threshold…"
        )}
      </div>

      {/* caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Bayesian optimization minimizes a tilted <span className="text-slate-200">double-well</span> objective on [0, 4]. Each
        iteration fits a <span style={{ color: CYAN_GLOW }}>Matérn-5/2 GP</span> (<span className="text-cyan-300">fs-adaptbo</span>),
        samples the point of maximum <span style={{ color: AMBER }}>expected improvement</span>, and feeds one binary
        &ldquo;did the incumbent improve?&rdquo; indicator into a <span style={{ color: VIOLET }}>betting e-process</span>, a test
        martingale. The search <span style={{ color: EMERALD }}>stops</span> the first iteration the log-e-value crosses the{" "}
        <span style={{ color: AMBER }}>Ville threshold</span> ln(1/α): an <span className="text-slate-200">anytime-valid</span>{" "}
        decision that stays sound even though you peeked after every iteration; no alpha-spending, no fixed horizon. Watch each
        sample drop onto the curve, the incumbent descend to the crowned{" "}
        <span style={{ color: EMERALD }}>certified best</span>, and the evidence climb across the threshold to the vertical{" "}
        <span style={{ color: EMERALD }}>STOP</span>. Every number is compiled Rust, live in your tab.
      </div>
    </SyncContainer>
  );
}
