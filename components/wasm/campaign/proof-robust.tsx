"use client";

/**
 * Campaign 01 — proofrobust(alpha, sigma, n)  ·  fs-robustopt-e2e
 * "The proven optimum is not the robust one."
 *
 * Three design families, each a convex parabola p(x) = a·x² + b·x + c whose global
 * minimum is PROVEN by an executable sum-of-squares certificate (fs-sos) — the
 * certified enclosure [lo, hi] of the optimum is real, live output. Then every
 * family is re-ranked by its worst-case CVaR cost under a ±σ manufacturing-
 * tolerance grid (fs-robust). The lowest-nominal family ("champion", cost 1.2) is
 * the steeper one, so as σ grows its cost balloons and the flatter "flat" family
 * (nominal 2.0) wins the robust ranking. All three optima stay SOS-Verified, yet
 * the honest headline for the CVaR ranking is only Estimated — no proof laundering.
 *
 * Left: the three parabolas with their proven minima (emerald rings) and a ±σ
 * tolerance band showing how the steep family's cost balloons. Right: a nominal→
 * robust cost slopegraph whose two winners' lines visibly CROSS as σ opens the gap.
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

/* Fixed family metadata — the demo_families() curvatures are structural constants
   of the campaign (like the names); every VALUE below (vertex, costs, certified
   interval) comes from the live wasm output. */
const META: { name: string; a: number; color: string; rgba: (al: number) => string }[] = [
  { name: "champion", a: 1.0, color: CYAN_GLOW, rgba: (al) => `rgba(34,211,238,${al})` },
  { name: "flat", a: 0.5, color: AMBER, rgba: (al) => `rgba(251,191,36,${al})` },
  { name: "sharp", a: 2.0, color: VIOLET, rgba: (al) => `rgba(168,85,247,${al})` },
];

const RANK: Record<number, { t: string; c: string }> = {
  2: { t: "Verified", c: EMERALD },
  1: { t: "Validated", c: CYAN_GLOW },
  0: { t: "Estimated", c: AMBER },
};

interface Fam {
  name: string;
  a: number;
  color: string;
  rgba: (al: number) => string;
  xStar: number;
  nominal: number;
  robust: number;
  verified: boolean;
  certLo: number;
  certHi: number;
}
interface PRData {
  fams: Fam[];
  certified: number;
  reorders: boolean;
  rankCode: number;
  nomIdx: number;
  robIdx: number;
  sigma: number;
  alpha: number;
  ms: number;
}

export default function ProofRobust() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [alpha, setAlpha] = useState(0.9);
  const [sigma, setSigma] = useState(2.0);
  const [n, setN] = useState(41);
  const [data, setData] = useState<PRData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const fieldRef = useRef<HTMLCanvasElement>(null);
  const slopeRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<PRData | null>(null);
  dataRef.current = data;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  const certRef = useEasedText<HTMLSpanElement>(data?.certified ?? 0, reduced, (v) => String(Math.round(v)), {
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
        const raw = await call<Float64Array>("proofrobust", alpha, sigma, n);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const F = Math.round(raw[0]);
        const certified = Math.round(raw[1]);
        const reorders = raw[2] > 0.5;
        const rankCode = Math.round(raw[3]);
        const nomIdx = Math.round(raw[4]);
        const robIdx = Math.round(raw[5]);
        const fams: Fam[] = [];
        for (let i = 0; i < F; i++) {
          const b = 6 + 6 * i;
          const meta = META[i] ?? META[META.length - 1];
          fams.push({
            name: meta.name,
            a: meta.a,
            color: meta.color,
            rgba: meta.rgba,
            xStar: raw[b],
            nominal: raw[b + 1],
            robust: raw[b + 2],
            verified: raw[b + 3] > 0.5,
            certLo: raw[b + 4],
            certHi: raw[b + 5],
          });
        }
        setData({ fams, certified, reorders, rankCode, nomIdx, robIdx, sigma, alpha, ms });
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, alpha, sigma, n, call]);

  /* -- parabola field (left) -- */
  const drawField = useCallback(
    (reveal: number, time: number) => {
      const canvas = fieldRef.current;
      const d = dataRef.current;
      if (!canvas || !d) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      const padL = W * 0.11;
      const padR = W * 0.05;
      const padT = H * 0.09;
      const padB = H * 0.12;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const fs = Math.max(8, W / 46);

      const xc = d.fams.reduce((s, f) => s + f.xStar, 0) / Math.max(1, d.fams.length);
      const Dvis = Math.max(1.35 * d.sigma, 1.6);
      const xLo = xc - Dvis;
      const xHi = xc + Dvis;
      const p = (f: Fam, x: number) => f.nominal + f.a * (x - f.xStar) * (x - f.xStar);
      let yMin = Infinity;
      let yMax = -Infinity;
      for (const f of d.fams) {
        yMin = Math.min(yMin, f.nominal);
        yMax = Math.max(yMax, p(f, xHi));
      }
      const yPad = (yMax - yMin) * 0.08 || 1;
      yMin -= yPad;
      yMax += yPad;

      const X = (x: number) => padL + ((x - xLo) / (xHi - xLo)) * plotW;
      const Y = (y: number) => padT + (1 - (y - yMin) / (yMax - yMin)) * plotH;

      // grid
      ctx.strokeStyle = "rgba(148,163,184,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const gy = padT + (plotH * i) / 4;
        ctx.moveTo(padL, gy);
        ctx.lineTo(W - padR, gy);
      }
      ctx.stroke();

      // ±σ tolerance band
      if (d.sigma > 0.02) {
        const bx0 = X(xc - d.sigma);
        const bx1 = X(xc + d.sigma);
        ctx.fillStyle = "rgba(148,163,184,0.07)";
        ctx.fillRect(bx0, padT, bx1 - bx0, plotH);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(148,163,184,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx0, padT);
        ctx.lineTo(bx0, padT + plotH);
        ctx.moveTo(bx1, padT);
        ctx.lineTo(bx1, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = MUTED;
        ctx.font = `${fs}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`±σ = ${d.sigma.toFixed(2)}`, (bx0 + bx1) / 2, padT + 2);
      }

      const clipX = padL + reveal * plotW + 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipX, H);
      ctx.clip();

      // parabolas
      const N = 120;
      for (const f of d.fams) {
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const x = xLo + ((xHi - xLo) * i) / N;
          const px = X(x);
          const py = Y(Math.min(yMax, p(f, x)));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = f.rgba(0.9);
        ctx.lineWidth = Math.max(1.5, W / 320);
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // worst-case-in-band drop (how far cost balloons over ±σ)
        if (d.sigma > 0.02) {
          const xe = xc + d.sigma;
          const worst = p(f, xe);
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = f.rgba(0.5);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(X(xe), Y(f.nominal));
          ctx.lineTo(X(xe), Y(Math.min(yMax, worst)));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();

      // proven minima markers (emerald ring = SOS-Verified) + labels
      ctx.font = `${fs}px ui-monospace, monospace`;
      for (const f of d.fams) {
        const mx = X(f.xStar);
        const my = Y(f.nominal);
        if (mx > clipX) continue;
        const pulse = reduced ? 1 : 0.82 + 0.18 * Math.sin(time * 0.004);
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(3, W / 150), 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 10 * pulse;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (f.verified) {
          ctx.beginPath();
          ctx.arc(mx, my, Math.max(5.5, W / 90), 0, Math.PI * 2);
          ctx.strokeStyle = EMERALD;
          ctx.lineWidth = Math.max(1.2, W / 420);
          ctx.stroke();
        }
        ctx.fillStyle = f.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(f.name, mx, my - Math.max(9, W / 60));
      }

      // axis label
      ctx.fillStyle = MUTED;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("design parameter x  ·  cost ↑", padL + plotW / 2, H - padB * 0.18);
    },
    [reduced],
  );

  /* -- nominal → robust cost slopegraph (right) -- */
  const drawSlope = useCallback(
    (reveal: number, time: number) => {
      const canvas = slopeRef.current;
      const d = dataRef.current;
      if (!canvas || !d) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      const padT = H * 0.16;
      const padB = H * 0.1;
      const plotH = H - padT - padB;
      const colL = W * 0.26;
      const colR = W * 0.74;
      const fs = Math.max(8, W / 34);

      let cMin = Infinity;
      let cMax = -Infinity;
      for (const f of d.fams) {
        cMin = Math.min(cMin, f.nominal, f.robust);
        cMax = Math.max(cMax, f.nominal, f.robust);
      }
      const cPad = (cMax - cMin) * 0.14 || 0.4;
      cMin -= cPad;
      cMax += cPad;
      const Y = (c: number) => padT + ((c - cMin) / (cMax - cMin)) * plotH; // lower cost → higher

      // axes
      ctx.strokeStyle = "rgba(148,163,184,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colL, padT);
      ctx.lineTo(colL, padT + plotH);
      ctx.moveTo(colR, padT);
      ctx.lineTo(colR, padT + plotH);
      ctx.stroke();

      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.fillStyle = MUTED;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      ctx.fillText("NOMINAL", colL, padT - H * 0.03);
      ctx.fillStyle = AMBER;
      ctx.fillText("ROBUST", colR, padT - H * 0.03);
      ctx.fillStyle = MUTED;
      ctx.font = `${Math.max(7, W / 46)}px ui-monospace, monospace`;
      ctx.textBaseline = "top";
      ctx.fillText("SOS-proven", colL, padT + plotH + H * 0.01);
      ctx.fillText(`CVaR@${d.alpha.toFixed(2)}`, colR, padT + plotH + H * 0.01);

      // best/lowest = up arrow hint
      ctx.font = `${fs}px ui-monospace, monospace`;
      for (const f of d.fams) {
        const yL = Y(f.nominal);
        const yR = Y(f.robust);
        const xR = colL + (colR - colL) * reveal;
        const yRr = yL + (yR - yL) * reveal;
        // connecting line
        ctx.beginPath();
        ctx.moveTo(colL, yL);
        ctx.lineTo(xR, yRr);
        ctx.strokeStyle = f.rgba(0.85);
        ctx.lineWidth = Math.max(1.6, W / 200);
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // endpoints + winner rings + value labels
      const drawNode = (x: number, y: number, f: Fam, winner: boolean, ringColor: string) => {
        if (winner) {
          const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(time * 0.005);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6, W / 60) * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = Math.max(1.4, W / 260);
          ctx.shadowColor = ringColor;
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(x, y, Math.max(3.2, W / 120), 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      };

      ctx.font = `${Math.max(8, W / 40)}px ui-monospace, monospace`;
      d.fams.forEach((f, i) => {
        const yL = Y(f.nominal);
        drawNode(colL, yL, f, i === d.nomIdx, EMERALD);
        // family name + nominal value left of the left column
        ctx.fillStyle = f.color;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${f.nominal.toFixed(2)}`, colL - W * 0.03, yL);
        if (reveal > 0.98) {
          const yR = Y(f.robust);
          drawNode(colR, yR, f, i === d.robIdx, AMBER);
          ctx.fillStyle = f.color;
          ctx.textAlign = "left";
          ctx.fillText(`${f.robust.toFixed(2)}`, colR + W * 0.03, yR);
        }
      });
    },
    [reduced],
  );

  /* -- DPR sizing + redraw -- */
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
      size(fieldRef.current, 0.78);
      size(slopeRef.current, 0.92);
      drawField(revealRef.current, performance.now());
      drawSlope(revealRef.current, performance.now());
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      if (fieldRef.current) ro.observe(fieldRef.current);
      if (slopeRef.current) ro.observe(slopeRef.current);
    }
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [drawField, drawSlope]);

  /* -- reveal on first data -- */
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

  /* -- animation loop (gated) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      drawField(1, 0);
      drawSlope(1, 0);
      return;
    }
    const DUR = 1200;
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
      drawField(revealRef.current, now);
      drawSlope(revealRef.current, now);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [data, inView, reduced, inViewRef, drawField, drawSlope]);

  const rank = RANK[data?.rankCode ?? 0] ?? RANK[0];

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 01 · fs-robustopt-e2e · SOS × CVaR</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            The proven optimum is not the <span className="text-amber-300">robust</span> one.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1.2fr_0.8fr]">
        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={fieldRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 0.78" }}
            role="img"
            aria-label="Three convex parabolas with their proven minima marked and a plus/minus sigma tolerance band showing how the steeper family's cost balloons"
          />
          <span
            className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}
          >
            SOS-proven minima
          </span>
          {!ready && <BootOverlay />}
        </div>

        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={slopeRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 0.92" }}
            role="img"
            aria-label="A nominal-to-robust cost slopegraph whose two winning families cross as sigma grows"
          />
          <span
            className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${AMBER}55`, background: `${BG}bb`, color: AMBER }}
          >
            rank swap
          </span>
          {!ready && <BootOverlay />}
        </div>
      </div>

      {/* certificate chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px]">
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest"
          style={{ borderColor: `${EMERALD}55`, background: `${EMERALD}12`, color: EMERALD }}
        >
          <span ref={certRef}>{data?.certified ?? "—"}</span>/{data?.fams.length ?? 3} SOS-proven
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest"
          style={{
            borderColor: `${data?.reorders ? AMBER : MUTED}55`,
            background: `${data?.reorders ? AMBER : MUTED}12`,
            color: data?.reorders ? AMBER : MUTED,
          }}
        >
          {data?.reorders ? "robust ≠ nominal" : "no reorder"}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest"
          style={{ borderColor: `${rank.c}55`, background: `${rank.c}12`, color: rank.c }}
        >
          headline · {rank.t}
        </span>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="α" value={alpha} min={0.5} max={0.999} step={0.001} onChange={setAlpha} format={(v) => v.toFixed(3)} disabled={!ready} />
        <Slider label="σ" value={sigma} min={0} max={5} step={0.05} onChange={setSigma} format={(v) => v.toFixed(2)} color={AMBER} disabled={!ready} />
        <Slider label="grid n" value={n} min={3} max={201} step={2} onChange={(v) => setN(Math.round(v))} format={(v) => String(Math.round(v))} color={VIOLET} disabled={!ready} />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {data ? (
          <>
            nominal winner <span style={{ color: META[data.nomIdx]?.color ?? BRIGHT }}>{data.fams[data.nomIdx]?.name}</span> · robust winner{" "}
            <span style={{ color: AMBER }}>{data.fams[data.robIdx]?.name}</span> · certified {data.certified}/{data.fams.length}
            {data.fams[data.robIdx]?.verified ? (
              <>
                {" "}
                <span style={{ color: MUTED }}>│</span>{" "}
                <span style={{ color: EMERALD }}>
                  {data.fams[data.robIdx].name} min ∈ [{data.fams[data.robIdx].certLo.toFixed(4)}, {data.fams[data.robIdx].certHi.toFixed(4)}]
                </span>
              </>
            ) : null}{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(2)} ms in WASM</span>
          </>
        ) : (
          "proving each global minimum with sum-of-squares, then ranking by worst-case CVaR…"
        )}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Three design families, each a convex parabola whose global minimum is <span className="text-slate-200">proven</span> by an
        executable <span style={{ color: EMERALD }}>sum-of-squares certificate</span> — the emerald ring is a real{" "}
        <span className="text-slate-200">[lo, hi]</span> enclosure of the optimum, not a guess. <span style={{ color: CYAN_GLOW }}>champion</span>{" "}
        has the lowest nominal cost but a steeper bowl; under a <span style={{ color: AMBER }}>±σ manufacturing tolerance</span> its
        cost balloons, and the flatter <span style={{ color: AMBER }}>flat</span> family wins the worst-case{" "}
        <span className="text-slate-200">CVaR</span> ranking instead — watch the two winners&apos; lines cross as you open σ. The
        honest part: the proofs stay <span style={{ color: EMERALD }}>Verified</span>, but the CVaR ranking is a sample statistic, so
        the headline is only <span style={{ color: AMBER }}>Estimated</span>. Compiled Rust, certified live in your tab.
      </div>
    </SyncContainer>
  );
}
