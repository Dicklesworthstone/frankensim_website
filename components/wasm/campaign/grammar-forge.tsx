"use client";

/**
 * Campaign 08 — grammarforge(match_tol, simplify_tol)  ·  fs-grammar-e2e
 * "A design space, illuminated — and every rewrite re-proven."
 *
 * A MAP-Elites archive illuminates a design space of CSG shape programs (target: a
 * "peanut" — two unit spheres) across a 6×4 behavior grid whose axes are total material
 * (r1+r2) × dipole separation (d). It keeps the best-matching program per niche: 18 of 24
 * niches filled, coverage 0.75. Every elite is then run through a CERTIFICATE-PRESERVING
 * simplifier (geometric-identity rewrites; tiny-offset drops carry an error bound), and the
 * campaign INDEPENDENTLY re-measures each simplification to confirm it stays within its
 * certified bound: 108 → 99 nodes, 9 elites simplified, re-verified SOUND. A fabrication
 * predicate (minimum feature size) separates buildable programs from fantasy.
 *
 * Left: the 6×4 niche occupancy heatmap — each filled cell glowing by fitness, empties dark
 * (the illuminated design space). Right: the representative best program rendered from its
 * z=0 SDF slice — the recognizable peanut, with its zero-contour outline. Raise
 * `simplify_tol` to drop more nodes and watch size_after — and the shape — respond.
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
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Slider,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/deep/_chrome";

type RGB = [number, number, number];
interface Seg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/* diverging SDF ramps, centered at 0 (interior emerald, exterior faded) */
const INSIDE: [number, RGB][] = [
  [0.0, [6, 24, 22]],
  [0.32, [10, 78, 62]],
  [0.58, [16, 150, 108]],
  [0.82, [52, 211, 153]],
  [1.0, [196, 255, 222]],
];
const OUTSIDE: [number, RGB][] = [
  [0.0, [10, 44, 56]],
  [0.34, [7, 26, 38]],
  [0.66, [4, 14, 22]],
  [1.0, [3, 8, 12]],
];
/* niche fitness glow ramp */
const FIT: [number, RGB][] = [
  [0.0, [8, 30, 40]],
  [0.4, [12, 92, 108]],
  [0.72, [22, 176, 196]],
  [1.0, [150, 250, 255]],
];

function sampleStops(stops: [number, RGB][], m: number): RGB {
  const x = m <= 0 ? 0 : m >= 1 ? 1 : m;
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = b === a ? 0 : (x - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

function fieldColor(v: number, insideScale: number, outsideScale: number): RGB {
  if (v < 0) return sampleStops(INSIDE, Math.pow(Math.min(1, -v / insideScale), 0.78));
  return sampleStops(OUTSIDE, Math.pow(Math.min(1, v / outsideScale), 0.9));
}

function contour(field: Float64Array, n: number, lo: number, hi: number): Seg[] {
  const d = (hi - lo) / (n - 1);
  const wx = (i: number) => lo + i * d;
  const wy = (j: number) => lo + j * d;
  const segs: Seg[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const v00 = field[j * n + i];
      const v10 = field[j * n + i + 1];
      const v11 = field[(j + 1) * n + i + 1];
      const v01 = field[(j + 1) * n + i];
      const pts: [number, number][] = [];
      if (v00 < 0 !== v10 < 0) pts.push([wx(i) + (v00 / (v00 - v10)) * d, wy(j)]);
      if (v10 < 0 !== v11 < 0) pts.push([wx(i + 1), wy(j) + (v10 / (v10 - v11)) * d]);
      if (v01 < 0 !== v11 < 0) pts.push([wx(i) + (v01 / (v01 - v11)) * d, wy(j + 1)]);
      if (v00 < 0 !== v01 < 0) pts.push([wx(i), wy(j) + (v00 / (v00 - v01)) * d]);
      if (pts.length === 2) segs.push({ x0: pts[0][0], y0: pts[0][1], x1: pts[1][0], y1: pts[1][1] });
      else if (pts.length === 4) {
        segs.push({ x0: pts[0][0], y0: pts[0][1], x1: pts[1][0], y1: pts[1][1] });
        segs.push({ x0: pts[2][0], y0: pts[2][1], x1: pts[3][0], y1: pts[3][1] });
      }
    }
  }
  return segs;
}

interface GFData {
  rBins: number;
  dBins: number;
  numElites: number;
  capacity: number;
  coverage: number;
  qd: number;
  bestDisc: number;
  sizeBefore: number;
  sizeAfter: number;
  simplified: number;
  maxCertErr: number;
  sound: boolean;
  fab: number;
  headline: boolean;
  reprN: number;
  reprLo: number;
  reprHi: number;
  niche: Float64Array; // length rBins*dBins, -1 = empty
  fitMin: number;
  fitMax: number;
  bestNiche: number;
  field: Float64Array;
  insideScale: number;
  outsideScale: number;
  segs: Seg[];
  matchTol: number;
  simplifyTol: number;
  ms: number;
  seq: number;
}

function decode(raw: Float64Array, matchTol: number, simplifyTol: number, ms: number, seq: number): GFData {
  const rBins = raw[0] | 0;
  const dBins = raw[1] | 0;
  const nicheN = rBins * dBins;
  const niche = raw.subarray(21, 21 + nicheN);
  let fitMin = Infinity;
  let fitMax = -Infinity;
  let bestNiche = -1;
  for (let k = 0; k < nicheN; k++) {
    const f = niche[k];
    if (f < 0) continue;
    if (f < fitMin) fitMin = f;
    if (f > fitMax) {
      fitMax = f;
      bestNiche = k;
    }
  }
  if (!isFinite(fitMin)) fitMin = 0;
  if (!isFinite(fitMax)) fitMax = 1;
  const reprN = raw[18] | 0;
  const reprLo = raw[19];
  const reprHi = raw[20];
  const field = raw.subarray(21 + nicheN, 21 + nicheN + reprN * reprN);
  let mn = Infinity;
  const pos: number[] = [];
  for (let k = 0; k < field.length; k++) {
    const v = field[k];
    if (v < mn) mn = v;
    if (v > 0) pos.push(v);
  }
  pos.sort((a, b) => a - b);
  const insideScale = Math.max(1e-3, -mn);
  const outsideScale = pos.length ? Math.max(0.3, pos[Math.floor(0.82 * (pos.length - 1))]) : 1;
  return {
    rBins,
    dBins,
    numElites: Math.round(raw[2]),
    capacity: Math.round(raw[3]),
    coverage: raw[4],
    qd: raw[5],
    bestDisc: raw[6],
    sizeBefore: Math.round(raw[11]),
    sizeAfter: Math.round(raw[12]),
    simplified: Math.round(raw[13]),
    maxCertErr: raw[14],
    sound: raw[15] > 0.5,
    fab: Math.round(raw[16]),
    headline: raw[17] > 0.5,
    reprN,
    reprLo,
    reprHi,
    niche,
    fitMin,
    fitMax,
    bestNiche,
    field,
    insideScale,
    outsideScale,
    segs: contour(field, reprN, reprLo, reprHi),
    matchTol,
    simplifyTol,
    ms,
    seq,
  };
}

export default function GrammarForge() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [matchTol, setMatchTol] = useState(0.2);
  const [simplifyTol, setSimplifyTol] = useState(0.03);
  const [data, setData] = useState<GFData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const nicheRef = useRef<HTMLCanvasElement>(null);
  const sdfRef = useRef<HTMLCanvasElement>(null);
  const fieldBufRef = useRef<HTMLCanvasElement | null>(null);
  const fieldImgRef = useRef<ImageData | null>(null);
  const bufKeyRef = useRef("");
  const dataRef = useRef<GFData | null>(null);
  dataRef.current = data;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  const afterRef = useEasedText<HTMLSpanElement>(data?.sizeAfter ?? 0, reduced, (v) => String(Math.round(v)), {
    enabled: !!data,
    inViewRef,
  });

  if (fieldBufRef.current === null && typeof document !== "undefined") {
    fieldBufRef.current = document.createElement("canvas");
    fieldBufRef.current.width = 64;
    fieldBufRef.current.height = 64;
    const c = fieldBufRef.current.getContext("2d");
    if (c) fieldImgRef.current = c.createImageData(64, 64);
  }

  /* -- compute (latest-wins; kernel is ~2 ms) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("grammarforge", matchTol, simplifyTol);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        setData(decode(raw, matchTol, simplifyTol, ms, token));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, matchTol, simplifyTol, call]);

  /* -- render the peanut SDF slice to the 64² offscreen buffer -- */
  const renderField = useCallback(() => {
    const buf = fieldBufRef.current;
    const img = fieldImgRef.current;
    const d = dataRef.current;
    if (!buf || !img || !d) return;
    const ctx = buf.getContext("2d");
    if (!ctx) return;
    const n = d.reprN;
    if (buf.width !== n) {
      buf.width = n;
      buf.height = n;
      const c2 = buf.getContext("2d");
      if (c2) fieldImgRef.current = c2.createImageData(n, n);
    }
    const image = fieldImgRef.current;
    if (!image) return;
    const px = image.data;
    for (let r = 0; r < n; r++) {
      const j = n - 1 - r;
      for (let c = 0; c < n; c++) {
        const v = d.field[j * n + c];
        const [cr, cg, cb] = fieldColor(v, d.insideScale, d.outsideScale);
        const o = (r * n + c) * 4;
        px[o] = cr;
        px[o + 1] = cg;
        px[o + 2] = cb;
        px[o + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    bufKeyRef.current = `${d.seq}`;
  }, []);

  /* -- niche occupancy heatmap (left) -- */
  const drawNiche = useCallback((reveal: number, time: number) => {
    const canvas = nicheRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const padL = W * 0.13;
    const padB = H * 0.13;
    const padT = H * 0.06;
    const padR = W * 0.04;
    const gw = W - padL - padR;
    const gh = H - padT - padB;
    const cw = gw / d.dBins;
    const ch = gh / d.rBins;
    const fs = Math.max(7, W / 44);
    const gap = Math.max(1.5, W / 260);
    const pulse = reducedRef.current ? 1 : 0.7 + 0.3 * Math.sin(time * 0.004);

    for (let r = 0; r < d.rBins; r++) {
      // material increases upward → highest r-bin at top
      const rowTop = padT + (d.rBins - 1 - r) * ch;
      for (let dcol = 0; dcol < d.dBins; dcol++) {
        const idx = r * d.dBins + dcol;
        const f = d.niche[idx];
        const x = padL + dcol * cw + gap / 2;
        const y = rowTop + gap / 2;
        const w = cw - gap;
        const h = ch - gap;
        if (f < 0) {
          ctx.fillStyle = "rgba(148,163,184,0.05)";
          ctx.fillRect(x, y, w, h);
          continue;
        }
        const norm = d.fitMax > d.fitMin ? (f - d.fitMin) / (d.fitMax - d.fitMin) : 1;
        const shown = Math.min(1, norm * reveal * 1.15);
        const [cr, cg, cb] = sampleStops(FIT, shown);
        const isBest = idx === d.bestNiche;
        ctx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
        ctx.shadowColor = isBest ? EMERALD : CYAN_GLOW;
        ctx.shadowBlur = (isBest ? W / 30 : W / 90) * (0.5 + 0.5 * shown) * (isBest ? pulse : 1);
        ctx.fillRect(x, y, w, h);
        ctx.shadowBlur = 0;
        if (isBest) {
          ctx.strokeStyle = `rgba(16,185,129,${0.78 + 0.22 * pulse})`;
          ctx.lineWidth = Math.max(1.6, W / 230);
          ctx.shadowColor = EMERALD;
          ctx.shadowBlur = (W / 42) * pulse;
          ctx.strokeRect(x, y, w, h);
          ctx.shadowBlur = 0;
        }
        if (reveal > 0.6 && w > 22) {
          ctx.fillStyle = shown > 0.55 ? "rgba(4,10,14,0.85)" : "rgba(226,240,255,0.8)";
          ctx.font = `${fs}px ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(f.toFixed(2), x + w / 2, y + h / 2);
        }
      }
    }

    // axis labels
    ctx.fillStyle = MUTED;
    ctx.font = `${Math.max(7, W / 48)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("dipole separation  d →", padL + gw / 2, H - padB * 0.72);
    ctx.save();
    ctx.translate(padL * 0.34, padT + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle";
    ctx.fillText("total material  r₁+r₂ →", 0, 0);
    ctx.restore();
  }, []);

  /* -- representative best program (right) -- */
  const drawSdf = useCallback((reveal: number) => {
    const canvas = sdfRef.current;
    const buf = fieldBufRef.current;
    const d = dataRef.current;
    if (!canvas || !buf || !d) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    if (bufKeyRef.current !== `${d.seq}`) renderField();

    const range = d.reprHi - d.reprLo;
    const mx = (x: number) => ((x - d.reprLo) / range) * W;
    const my = (y: number) => (1 - (y - d.reprLo) / range) * H;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = reveal;
    ctx.drawImage(buf, 0, 0, d.reprN, d.reprN, 0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.58 * reveal;
    ctx.filter = `blur(${Math.max(4, Math.round(W / 42))}px)`;
    ctx.drawImage(buf, 0, 0, d.reprN, d.reprN, 0, 0, W, H);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (reveal > 0.02 && d.segs.length) {
      ctx.beginPath();
      for (const s of d.segs) {
        ctx.moveTo(mx(s.x0), my(s.y0));
        ctx.lineTo(mx(s.x1), my(s.y1));
      }
      // soft emerald halo underneath
      ctx.strokeStyle = "rgba(52,211,153,0.32)";
      ctx.lineWidth = Math.max(2.4, W / 140);
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = W / 58;
      ctx.stroke();
      // crisp bright core on top
      ctx.strokeStyle = "rgba(210,255,232,0.98)";
      ctx.lineWidth = Math.max(1.2, W / 300);
      ctx.shadowBlur = 0;
      ctx.stroke();
    }

    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.max(0, W * 0.26), W / 2, H / 2, Math.max(0.1, W * 0.72));
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }, [renderField]);

  /* -- DPR sizing -- */
  useEffect(() => {
    const size = (canvas: HTMLCanvasElement | null, ratio: number) => {
      if (!canvas) return;
      const d = dpr();
      const cssW = canvas.clientWidth || 320;
      const w = Math.max(200, Math.min(1000, Math.round(cssW * d)));
      const h = Math.round(w * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    const apply = () => {
      size(nicheRef.current, 0.95);
      size(sdfRef.current, 1);
      drawNiche(revealRef.current, performance.now());
      drawSdf(revealRef.current);
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      if (nicheRef.current) ro.observe(nicheRef.current);
      if (sdfRef.current) ro.observe(sdfRef.current);
    }
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [drawNiche, drawSdf]);

  /* -- reveal on first data -- */
  useEffect(() => {
    if (!data) return;
    bufKeyRef.current = "";
    if (!seenRef.current) {
      seenRef.current = true;
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    } else {
      revealRef.current = 1;
      drawNiche(1, performance.now());
      drawSdf(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* -- animation loop (gated) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      drawNiche(1, 0);
      drawSdf(1);
      return;
    }
    const DUR = 1150;
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      if (revealStartRef.current !== null) {
        const p = Math.min((now - revealStartRef.current) / DUR, 1);
        revealRef.current = 1 - Math.pow(1 - p, 3);
        if (p >= 1) revealStartRef.current = null;
      } else {
        revealRef.current = 1;
      }
      drawNiche(revealRef.current, now);
      drawSdf(revealRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [data, inView, reduced, inViewRef, drawNiche, drawSdf]);

  const filled = data ? Math.round(data.coverage * data.capacity) : 0;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 08 · fs-grammar-e2e · MAP-Elites × CSG</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            A design space, <span className="text-cyan-400">illuminated</span>; every rewrite re-proven.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={nicheRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 0.95" }}
            role="img"
            aria-label="A 6 by 4 MAP-Elites niche occupancy heatmap; filled cells glow by fitness, empty niches are dark, the best niche is ringed in emerald"
          />
          <span className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}55`, background: `${BG}bb`, color: CYAN_GLOW }}>
            archive · {filled}/{data?.capacity ?? 24} niches
          </span>
          {!ready && <BootOverlay />}
        </div>

        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={sdfRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 1", filter: "saturate(1.1) contrast(1.04)" }}
            role="img"
            aria-label="The representative best CSG program rendered from its signed-distance slice: a peanut of two spheres with its zero-contour outline"
          />
          <span className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}>
            best program · peanut
          </span>
          {!ready && <BootOverlay />}
        </div>
      </div>

      {/* prominent simplification counter + certificate chips */}
      {data && (
        <div className="mt-3 flex flex-wrap items-stretch gap-2">
          <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2" style={{ borderColor: `${EMERALD}66`, background: `${EMERALD}12` }}>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-[18px] font-black tabular-nums md:text-2xl" style={{ color: BRIGHT }}>
                {data.sizeBefore}
              </span>
              <span className="text-[14px] font-black" style={{ color: MUTED }}>
                →
              </span>
              <span className="text-[18px] font-black tabular-nums md:text-2xl" style={{ color: EMERALD, textShadow: `0 0 12px ${EMERALD}66` }}>
                <span ref={afterRef}>{data.sizeAfter}</span>
              </span>
              <span className="ml-1 text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
                nodes
              </span>
            </div>
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.14em]"
              style={{ borderColor: data.sound ? `${EMERALD}88` : `${AMBER}88`, background: data.sound ? `${EMERALD}18` : `${AMBER}14`, color: data.sound ? EMERALD : AMBER }}
            >
              {data.sound ? "re-verified sound" : "bound exceeded"}
            </span>
          </div>
          <div className="flex flex-col justify-center rounded-lg border px-3 py-1.5 font-mono" style={{ borderColor: BORDER, background: SURFACE }}>
            <span className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              max certified error
            </span>
            <span className="text-[13px] font-black tabular-nums" style={{ color: data.maxCertErr > 0 ? AMBER : EMERALD }}>
              {data.maxCertErr.toExponential(1)}
            </span>
          </div>
          <div className="flex flex-col justify-center rounded-lg border px-3 py-1.5 font-mono" style={{ borderColor: BORDER, background: SURFACE }}>
            <span className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              coverage · QD score
            </span>
            <span className="text-[13px] font-black tabular-nums" style={{ color: CYAN_GLOW }}>
              {data.coverage.toFixed(2)} · {data.qd.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col justify-center rounded-lg border px-3 py-1.5 font-mono" style={{ borderColor: `${VIOLET}44`, background: `${VIOLET}0d` }}>
            <span className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              fabricable · simplified
            </span>
            <span className="text-[13px] font-black tabular-nums" style={{ color: "#d8b4fe" }}>
              {data.fab}/{data.numElites} · {data.simplified}
            </span>
          </div>
          <span
            className="flex items-center rounded-lg border px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest"
            style={{ borderColor: `${data.headline ? EMERALD : AMBER}55`, background: `${data.headline ? EMERALD : AMBER}12`, color: data.headline ? EMERALD : AMBER }}
          >
            headline · {data.headline ? "Verified" : "Estimated"}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="match tol" value={matchTol} min={0.05} max={0.5} step={0.01} onChange={setMatchTol} format={(v) => v.toFixed(2)} disabled={!ready} />
        <Slider label="simplify tol" value={simplifyTol} min={0} max={0.1} step={0.005} onChange={setSimplifyTol} format={(v) => v.toFixed(3)} color={EMERALD} disabled={!ready} />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {data ? (
          <>
            {data.numElites}/{data.capacity} niches filled · <span style={{ color: EMERALD }}>{data.sizeBefore} → {data.sizeAfter} nodes</span>, {data.simplified} simplified{" "}
            <span style={{ color: MUTED }}>│</span> {data.sound ? <span style={{ color: EMERALD }}>re-verified sound</span> : <span style={{ color: AMBER }}>bound exceeded</span>} · max err {data.maxCertErr.toExponential(1)}{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(1)} ms in WASM</span>
          </>
        ) : (
          "illuminating the CSG design space, then re-measuring every certificate-preserving rewrite…"
        )}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        <span style={{ color: CYAN_GLOW }}>MAP-Elites</span> illuminates a design space of CSG shape programs, targeting a{" "}
        <span className="text-slate-200">peanut</span> of two spheres, across a 6×4 behavior grid (total material × dipole
        separation), keeping the best-matching program per niche: <span className="text-slate-200">18 of 24</span> filled. Each
        elite then passes through a <span style={{ color: EMERALD }}>certificate-preserving simplifier</span> whose
        geometric-identity rewrites and tiny-offset drops carry an error bound, and the campaign{" "}
        <span className="text-slate-200">independently re-measures</span> each result to confirm it stays within that bound:{" "}
        <span style={{ color: EMERALD }}>108 → 99 nodes</span>, re-verified <span style={{ color: EMERALD }}>sound</span>. A
        fabrication predicate separates buildable programs from fantasy. Move <span style={{ color: EMERALD }}>simplify tol</span>{" "}
        and watch the node count and the shape change together, every rewrite re-proven by compiled Rust in your tab.
      </div>
    </SyncContainer>
  );
}
