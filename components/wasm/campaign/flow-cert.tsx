"use client";

/**
 * Campaign 10 — flowcert(steps, tol)  ·  fs-flowcert-e2e
 * "It tells you where to trust the answer."
 *
 * A lattice-Boltzmann channel solver (D2Q9 BGK) is run across a sweep of Reynolds numbers
 * × grid resolutions. Each operating point is machine-checked against the analytic
 * Poiseuille solution AND a regime-stability criterion, producing a CREDIBILITY MAP that
 * separates trustworthy points from flagged ones. Re=20 is credible at every resolution
 * (error 0.0008–0.0036); Re=120 is flagged everywhere (error 0.05–0.22, unstable regime).
 *
 * Left: a 3×3 credibility grid (Re {20,60,120} × ny {16,24,32}) — each cell colored by its
 * verdict (fully-credible = emerald, accurate-but-unstable = amber, inaccurate = rose) with
 * its max error printed. Right: the two spotlight velocity profiles overlaid on the analytic
 * Poiseuille parabola — the credible one (Re=20) hugging the curve, the flagged one (Re=120)
 * visibly falling short. Every answer comes with a certificate of where to trust it.
 *
 * NOTE: this kernel is heavy (~0.3–1 s); the sweep recomputes only when a slider is released.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";
import {
  BG,
  SURFACE,
  BORDER,
  CYAN,
  CYAN_GLOW,
  EMERALD,
  AMBER,
  ROSE,
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

interface Point {
  re: number;
  ny: number;
  maxErr: number;
  accurate: boolean;
  stable: boolean;
  cred: boolean;
  tau: number;
  visc: number;
}
interface Spot {
  re: number;
  ny: number;
  uNum: Float64Array;
  uAna: Float64Array;
}
interface FCData {
  coverage: number;
  qd: number;
  numNiches: number;
  bestError: number;
  stableFraction: number;
  allAccurate: boolean;
  mapRank: number;
  points: Point[];
  res: number[];
  nys: number[];
  spots: Spot[];
  uMax: number;
  steps: number;
  tol: number;
  ms: number;
  seq: number;
}

function verdictColor(p: Point): string {
  if (p.cred) return EMERALD;
  if (p.accurate && !p.stable) return AMBER;
  return ROSE;
}
function verdictWord(p: Point): string {
  if (p.cred) return "credible";
  if (p.accurate && !p.stable) return "unstable";
  return "inaccurate";
}

function decode(raw: Float64Array, steps: number, tol: number, ms: number, seq: number): FCData {
  let i = 0;
  const P = raw[i++] | 0;
  const coverage = raw[i++];
  const qd = raw[i++];
  const numNiches = raw[i++];
  const bestError = raw[i++];
  const stableFraction = raw[i++];
  const allAccurate = raw[i++] > 0.5;
  const mapRank = Math.round(raw[i++]);
  const points: Point[] = [];
  for (let p = 0; p < P; p++) {
    const b = i + p * 8;
    points.push({
      re: raw[b],
      ny: raw[b + 1],
      maxErr: raw[b + 2],
      accurate: raw[b + 3] > 0.5,
      stable: raw[b + 4] > 0.5,
      cred: raw[b + 5] > 0.5,
      tau: raw[b + 6],
      visc: raw[b + 7],
    });
  }
  i += P * 8;
  const S = raw[i++] | 0;
  const spots: Spot[] = [];
  let uMax = 1e-6;
  for (let s = 0; s < S; s++) {
    const re = raw[i++];
    const ny = raw[i++] | 0;
    const uNum = new Float64Array(ny);
    const uAna = new Float64Array(ny);
    for (let k = 0; k < ny; k++) {
      uNum[k] = raw[i++];
      uAna[k] = raw[i++];
      if (uNum[k] > uMax) uMax = uNum[k];
      if (uAna[k] > uMax) uMax = uAna[k];
    }
    spots.push({ re, ny, uNum, uAna });
  }
  const res = Array.from(new Set(points.map((p) => p.re))).sort((a, b) => a - b);
  const nys = Array.from(new Set(points.map((p) => p.ny))).sort((a, b) => a - b);
  return { coverage, qd, numNiches, bestError, stableFraction, allAccurate, mapRank, points, res, nys, spots, uMax, steps, tol, ms, seq };
}

const RANK_META: Record<number, { t: string; c: string }> = {
  2: { t: "trust the map", c: EMERALD },
  1: { t: "mixed credibility", c: AMBER },
  0: { t: "flagged", c: ROSE },
};

export default function FlowCert() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [steps, setSteps] = useState(12000);
  const [stepsCommitted, setStepsCommitted] = useState(12000);
  const [tol, setTol] = useState(0.03);
  const [tolCommitted, setTolCommitted] = useState(0.03);
  const [data, setData] = useState<FCData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const mapRef = useRef<HTMLCanvasElement>(null);
  const profRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<FCData | null>(null);
  dataRef.current = data;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  /* -- compute the sweep (only on committed slider values; kernel is heavy) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("flowcert", stepsCommitted, tolCommitted);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        setData(decode(raw, stepsCommitted, tolCommitted, ms, token));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, stepsCommitted, tolCommitted, call]);

  /* -- 3×3 credibility grid (left) -- */
  const drawMap = useCallback((reveal: number, time: number) => {
    const canvas = mapRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const padL = W * 0.16;
    const padT = H * 0.13;
    const padR = W * 0.04;
    const padB = H * 0.05;
    const gw = W - padL - padR;
    const gh = H - padT - padB;
    const nCol = d.nys.length || 3;
    const nRow = d.res.length || 3;
    const cw = gw / nCol;
    const ch = gh / nRow;
    const gap = Math.max(2, W / 200);
    const pulse = reducedRef.current ? 1 : 0.7 + 0.3 * Math.sin(time * 0.004);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of d.points) {
      const row = d.res.indexOf(p.re); // Re ascending downward
      const col = d.nys.indexOf(p.ny);
      if (row < 0 || col < 0) continue;
      const x = padL + col * cw + gap / 2;
      const y = padT + row * ch + gap / 2;
      const w = cw - gap;
      const h = ch - gap;
      const col0 = verdictColor(p);
      const [cr, cg, cb] = col0 === EMERALD ? [16, 185, 129] : col0 === AMBER ? [251, 191, 36] : [244, 63, 94];
      const a = 0.16 + 0.2 * reveal;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.7 * reveal})`;
      ctx.lineWidth = Math.max(1, W / 320);
      ctx.shadowColor = col0;
      ctx.shadowBlur = (W / 150) * reveal;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // spotlight halo on the two profiled points (Re & ny both matched)
      const isSpot = d.spots.some((s) => s.re === p.re && s.ny === p.ny);
      if (isSpot && reveal > 0.5) {
        ctx.strokeStyle = `rgba(226,240,255,${0.5 + 0.4 * pulse})`;
        ctx.setLineDash([Math.max(3, W / 120), Math.max(3, W / 120)]);
        ctx.lineWidth = Math.max(1.2, W / 300);
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
        ctx.setLineDash([]);
      }

      if (reveal > 0.55) {
        ctx.fillStyle = col0;
        ctx.shadowColor = col0;
        ctx.shadowBlur = W / 120;
        ctx.font = `${Math.max(10, W / 24)}px ui-monospace, monospace`;
        ctx.fillText(p.maxErr.toFixed(4), x + w / 2, y + h * 0.42);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(226,240,255,0.62)";
        ctx.font = `${Math.max(7, W / 40)}px ui-monospace, monospace`;
        ctx.fillText(verdictWord(p), x + w / 2, y + h * 0.7);
      }
    }

    // axis labels
    ctx.fillStyle = MUTED;
    ctx.font = `${Math.max(8, W / 34)}px ui-monospace, monospace`;
    ctx.textBaseline = "middle";
    for (let c = 0; c < nCol; c++) {
      ctx.textAlign = "center";
      ctx.fillText(`ny ${d.nys[c]}`, padL + c * cw + cw / 2, padT * 0.5);
    }
    for (let r = 0; r < nRow; r++) {
      ctx.textAlign = "right";
      ctx.fillText(`Re ${d.res[r]}`, padL * 0.82, padT + r * ch + ch / 2);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(148,163,184,0.7)";
    ctx.font = `${Math.max(7, W / 42)}px ui-monospace, monospace`;
    ctx.textBaseline = "top";
    ctx.fillText("resolution →", padL, padT * 0.06);
  }, []);

  /* -- spotlight velocity profiles (right) -- */
  const drawProfiles = useCallback((reveal: number) => {
    const canvas = profRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const padL = W * 0.11;
    const padR = W * 0.05;
    const padT = H * 0.12;
    const padB = H * 0.13;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const yMax = d.uMax * 1.12;
    const X = (t: number) => padL + t * plotW; // channel position 0..1
    const Y = (u: number) => padT + (1 - u / yMax) * plotH; // velocity up

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = 0; g <= 4; g++) {
      const gy = padT + (plotH * g) / 4;
      ctx.moveTo(padL, gy);
      ctx.lineTo(W - padR, gy);
    }
    ctx.stroke();

    // analytic Poiseuille parabola (reference, from the certified analytic profile)
    const ana = d.spots[0]?.uAna;
    if (ana) {
      const ny = ana.length;
      ctx.beginPath();
      for (let k = 0; k < ny; k++) {
        const t = (k + 0.5) / ny;
        const px = X(t);
        const py = Y(ana[k]);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.setLineDash([Math.max(3, W / 90), Math.max(3, W / 120)]);
      ctx.strokeStyle = "rgba(233,244,255,0.72)";
      ctx.lineWidth = Math.max(1.4, W / 260);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // the two numeric spotlight profiles
    const clip = padL + reveal * plotW + 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clip, H);
    ctx.clip();
    d.spots.forEach((s, si) => {
      const p = d.points.find((q) => q.re === s.re && q.ny === s.ny);
      const col = p ? verdictColor(p) : si === 0 ? EMERALD : ROSE;
      const ny = s.uNum.length;
      ctx.beginPath();
      for (let k = 0; k < ny; k++) {
        const t = (k + 0.5) / ny;
        const px = X(t);
        const py = Y(s.uNum[k]);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1.8, W / 190);
      ctx.shadowColor = col;
      ctx.shadowBlur = 13;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // markers
      for (let k = 0; k < ny; k += Math.max(1, Math.round(ny / 12))) {
        const t = (k + 0.5) / ny;
        ctx.beginPath();
        ctx.arc(X(t), Y(s.uNum[k]), Math.max(0.1, Math.max(1.6, W / 220)), 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    });
    ctx.restore();

    // axes + labels
    ctx.strokeStyle = "rgba(148,163,184,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(W - padR, padT + plotH);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = `${Math.max(8, W / 40)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("channel position", padL + plotW / 2, padT + plotH + plotH * 0.03);
    ctx.save();
    ctx.translate(padL * 0.34, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle";
    ctx.fillText("velocity u", 0, 0);
    ctx.restore();

    // legend
    if (reveal > 0.6) {
      const lx = W - padR - W * 0.3;
      let ly = padT + plotH * 0.04;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(7, W / 44)}px ui-monospace, monospace`;
      const legend: [string, string][] = [["rgba(226,240,255,0.75)", "analytic"], ...d.spots.map((s): [string, string] => {
        const p = d.points.find((q) => q.re === s.re && q.ny === s.ny);
        return [p ? verdictColor(p) : ROSE, `Re ${s.re}`];
      })];
      for (const [c, label] of legend) {
        ctx.strokeStyle = c;
        ctx.lineWidth = Math.max(1.6, W / 220);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + W * 0.05, ly);
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.fillText(label, lx + W * 0.065, ly);
        ly += Math.max(11, W / 26);
      }
    }
  }, []);

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
      size(mapRef.current, 1);
      size(profRef.current, 0.92);
      drawMap(revealRef.current, performance.now());
      drawProfiles(revealRef.current);
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      if (mapRef.current) ro.observe(mapRef.current);
      if (profRef.current) ro.observe(profRef.current);
    }
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [drawMap, drawProfiles]);

  /* -- reveal on first data -- */
  useEffect(() => {
    if (!data) return;
    if (!seenRef.current) {
      seenRef.current = true;
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    } else {
      revealRef.current = 1;
      drawMap(1, performance.now());
      drawProfiles(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* -- animation loop (gated) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      drawMap(1, 0);
      drawProfiles(1);
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
      drawMap(revealRef.current, now);
      drawProfiles(revealRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [data, inView, reduced, inViewRef, drawMap, drawProfiles]);

  const rank = RANK_META[data?.mapRank ?? 0] ?? RANK_META[0];
  const credCount = data ? data.points.filter((p) => p.cred).length : 0;
  const dirty = steps !== stepsCommitted || tol !== tolCommitted;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 10 · fs-flowcert-e2e · credibility map</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            It tells you <span className="text-emerald-300">where to trust</span> the answer.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={mapRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 1" }}
            role="img"
            aria-label="A 3 by 3 credibility grid over Reynolds number and grid resolution; each cell is colored emerald for fully credible, amber for accurate-but-unstable, rose for inaccurate, with its max error printed"
          />
          <span className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}55`, background: `${BG}bb`, color: CYAN_GLOW }}>
            credibility map · {credCount}/{data?.points.length ?? 9}
          </span>
          {(!ready || (computing && !data)) && <BootOverlay />}
        </div>

        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={profRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 0.92" }}
            role="img"
            aria-label="Two spotlight velocity profiles overlaid on the analytic Poiseuille parabola; the credible Re=20 profile hugs the curve, the flagged Re=120 profile falls short"
          />
          <span className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}>
            profiles vs Poiseuille
          </span>
          {(!ready || (computing && !data)) && <BootOverlay />}
        </div>
      </div>

      {/* verdict chips */}
      {data && (
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px]">
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest" style={{ borderColor: `${rank.c}55`, background: `${rank.c}12`, color: rank.c }}>
            map verdict · {rank.t}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest" style={{ borderColor: `${EMERALD}44`, background: `${EMERALD}0d`, color: EMERALD }}>
            best error {data.bestError.toExponential(1)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest" style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d`, color: CYAN_GLOW }}>
            stable {(data.stableFraction * 100).toFixed(0)}%
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest"
            style={{ borderColor: `${data.allAccurate ? EMERALD : AMBER}55`, background: `${data.allAccurate ? EMERALD : AMBER}12`, color: data.allAccurate ? EMERALD : AMBER }}
          >
            {data.allAccurate ? "all accurate" : "not all accurate"}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider
          label="steps"
          value={steps}
          min={2000}
          max={12000}
          step={500}
          onChange={setSteps}
          onCommit={(v) => setStepsCommitted(Math.round(v))}
          format={(v) => String(Math.round(v))}
          disabled={!ready}
        />
        <Slider
          label="tol"
          value={tol}
          min={0.005}
          max={0.1}
          step={0.005}
          onChange={setTol}
          onCommit={(v) => setTolCommitted(v)}
          format={(v) => v.toFixed(3)}
          color={EMERALD}
          disabled={!ready}
        />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {computing ? (
          <span style={{ color: AMBER }}>solving the LBM sweep · {steps} steps × 9 operating points…</span>
        ) : data ? (
          <>
            {credCount}/{data.points.length} points credible · Re 20{" "}
            <span style={{ color: EMERALD }}>hugs Poiseuille</span> · Re 120 <span style={{ color: ROSE }}>flagged</span>{" "}
            <span style={{ color: MUTED }}>│</span> best err {data.bestError.toExponential(1)}{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(0)} ms in WASM</span>
            {dirty ? <span style={{ color: AMBER }}> · release to recompute</span> : null}
          </>
        ) : (
          "sweeping Reynolds number × grid resolution, certifying each point…"
        )}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A <span className="text-slate-200">lattice-Boltzmann</span> channel solver (D2Q9 BGK) is swept across Reynolds number ×
        grid resolution. Each operating point is machine-checked against the analytic{" "}
        <span style={{ color: EMERALD }}>Poiseuille</span> solution <span className="text-slate-200">and</span> a
        regime-stability criterion, producing a <span style={{ color: CYAN_GLOW }}>credibility map</span> that separates the
        trustworthy from the flagged. <span style={{ color: EMERALD }}>Re=20</span> is credible at every resolution (error
        ~10⁻³); <span style={{ color: ROSE }}>Re=120</span> is flagged everywhere; the profile visibly falls short of the
        parabola. FrankenSim returns a <span className="text-slate-200">certified</span>{" "}
        answer, telling you exactly where to trust the CFD. Every solve, error and verdict is compiled Rust, run when you
        release the slider.
      </div>
    </SyncContainer>
  );
}
