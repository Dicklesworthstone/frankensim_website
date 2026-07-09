"use client";

/**
 * Deep Kernel 07 — krylov_convergence(n, maxit)
 * "Three ways to converge."
 *
 * The same SPD 2D Laplacian (m = n² unknowns) solved by three Krylov methods —
 * CG, MINRES, GMRES — each returning its relative-residual history. We draw the
 * plunge on a log y-axis: whoever hits machine precision in the fewest steps wins
 * the race. GMRES cliff-drops in a couple of restart cycles; CG and MINRES take
 * the scenic route. All residuals are the real compiled-Rust solver output.
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
} from "@/components/wasm/frontier/_chrome";

const TOL = 1e-8;
const TOP_EXP = 1; // 10^1
const BOT_EXP = -16; // 10^-16

interface Curve {
  name: string;
  color: string;
  rgba: (a: number) => string;
  vals: Float64Array;
  tolIdx: number; // first index at or below TOL, or -1
}
interface KryData {
  m: number;
  curves: Curve[];
  maxLen: number;
  ms: number;
  seq: number;
}

function firstBelow(v: Float64Array, tol: number): number {
  for (let i = 0; i < v.length; i++) if (v[i] <= tol) return i;
  return -1;
}
const clampV = (v: number) => (v < 1e-16 ? 1e-16 : v > 10 ? 10 : v);
const yFrac = (v: number) => (TOP_EXP - Math.log10(clampV(v))) / (TOP_EXP - BOT_EXP);

export default function KrylovConvergence() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [n, setN] = useState(16);
  const [maxit, setMaxit] = useState(500);
  const [data, setData] = useState<KryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<KryData | null>(null);
  dataRef.current = data;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const msLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("krylov_convergence", n, maxit);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        let i = 0;
        const m = Math.round(raw[i++]);
        const readSection = () => {
          const L = Math.round(raw[i++]);
          const v = raw.subarray(i, i + L).slice();
          i += L;
          return v;
        };
        const cg = readSection();
        const minres = readSection();
        const gmres = readSection();
        const curves: Curve[] = [
          { name: "CG", color: CYAN_GLOW, rgba: (a) => `rgba(34,211,238,${a})`, vals: cg, tolIdx: firstBelow(cg, TOL) },
          { name: "MINRES", color: VIOLET, rgba: (a) => `rgba(168,85,247,${a})`, vals: minres, tolIdx: firstBelow(minres, TOL) },
          { name: "GMRES", color: AMBER, rgba: (a) => `rgba(251,191,36,${a})`, vals: gmres, tolIdx: firstBelow(gmres, TOL) },
        ];
        const maxLen = Math.max(cg.length, minres.length, gmres.length, 2);
        dataRef.current = { m, curves, maxLen, ms, seq: token };
        setData(dataRef.current);
        if (msLabelRef.current) msLabelRef.current.textContent = ms.toFixed(2);
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, n, maxit, call]);

  const draw = useCallback((reveal: number, time: number) => {
    const canvas = canvasRef.current;
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

    const padL = W * 0.13;
    const padR = W * 0.04;
    const padT = H * 0.07;
    const padB = H * 0.13;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const px = (idx: number) => padL + (d.maxLen > 1 ? idx / (d.maxLen - 1) : 0) * plotW;
    const py = (v: number) => padT + yFrac(v) * plotH;
    const fs = Math.max(8, W / 52);

    // decade gridlines + labels
    ctx.font = `${fs}px ui-monospace, monospace`;
    ctx.textBaseline = "middle";
    for (let e = TOP_EXP; e >= BOT_EXP; e -= 2) {
      const y = py(Math.pow(10, e));
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.strokeStyle = e === 0 ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.textAlign = "right";
      ctx.fillText(`10${e < 0 ? "⁻" : ""}${String(Math.abs(e))}`, padL - W * 0.015, y);
    }

    // tolerance line
    const yTol = py(TOL);
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yTol);
    ctx.lineTo(W - padR, yTol);
    ctx.strokeStyle = "rgba(16,185,129,0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = EMERALD;
    ctx.textAlign = "left";
    ctx.fillText("tol 1e-8", padL + 4, yTol - fs * 0.9);

    // x-axis label
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.fillText("iteration / restart cycle →", padL + plotW / 2, H - padB * 0.35);

    // reveal clip (curves draw left→right together)
    const clipX = padL + reveal * plotW + 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clipX, H);
    ctx.clip();

    for (const c of d.curves) {
      const L = c.vals.length;
      if (L === 0) continue;
      // lead-in plunge from residual ~1 at x0 (esp. dramatic for GMRES)
      ctx.beginPath();
      ctx.moveTo(px(0), py(1));
      for (let k = 0; k < L; k++) ctx.lineTo(px(k), py(c.vals[k]));
      ctx.strokeStyle = c.rgba(0.95);
      ctx.lineWidth = Math.max(1.6, W / 300);
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // point markers
      for (let k = 0; k < L; k++) {
        ctx.beginPath();
        ctx.arc(px(k), py(c.vals[k]), Math.max(1.5, W / 320), 0, Math.PI * 2);
        ctx.fillStyle = c.rgba(0.9);
        ctx.fill();
      }
    }
    ctx.restore();

    // tolerance-crossing markers (only once revealed past them)
    ctx.textAlign = "center";
    for (const c of d.curves) {
      if (c.tolIdx < 0) continue;
      const x = px(c.tolIdx);
      if (x > clipX) continue;
      const y = py(c.vals[c.tolIdx]);
      const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(time * 0.005);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3.5, W / 130) * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = c.color;
      ctx.fillText(String(c.tolIdx), x, y - fs * 1.2);
    }
  }, [reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const d = dpr();
      const cssW = canvas.clientWidth || 480;
      const w = Math.max(240, Math.min(1100, Math.round(cssW * d)));
      const h = Math.round(w * 0.6);
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

  const seenRef = useRef(false);
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

  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      draw(1, 0);
      return;
    }
    const DUR = 1600;
    const tick = (now: number) => {
      if (revealStartRef.current !== null) {
        const p = Math.min((now - revealStartRef.current) / DUR, 1);
        revealRef.current = 1 - Math.pow(1 - p, 3);
        if (p >= 1) revealStartRef.current = null;
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
  }, [data, inView, reduced, draw]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Deep Kernel 07 · Krylov · SPD Laplacian</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Three ways to <span className="text-cyan-400">converge</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full"
          style={{ aspectRatio: "1 / 0.6" }}
          role="img"
          aria-label="Log-scale plot of relative residual versus iteration for CG, MINRES and GMRES converging to machine precision"
        />
        {!ready && <BootOverlay />}
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px]">
        {(data?.curves ?? [
          { name: "CG", color: CYAN_GLOW, vals: new Float64Array(), tolIdx: -1 },
          { name: "MINRES", color: VIOLET, vals: new Float64Array(), tolIdx: -1 },
          { name: "GMRES", color: AMBER, vals: new Float64Array(), tolIdx: -1 },
        ] as { name: string; color: string; vals: Float64Array; tolIdx: number }[]).map((c) => (
          <span key={c.name} className="inline-flex items-center gap-1.5" style={{ color: c.color }}>
            <span className="h-2 w-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
            {c.name}
            <span style={{ color: MUTED }}>
              {c.vals.length ? `· ${c.vals.length} step${c.vals.length === 1 ? "" : "s"}${c.tolIdx >= 0 ? ` · tol@${c.tolIdx}` : ""}` : ""}
            </span>
          </span>
        ))}
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="n" value={n} min={4} max={24} step={1} onChange={(v) => setN(Math.round(v))} format={(v) => `${Math.round(v)}²`} disabled={!ready} />
        <Slider label="maxit" value={maxit} min={20} max={1500} step={10} onChange={(v) => setMaxit(Math.round(v))} format={(v) => String(Math.round(v))} color={VIOLET} disabled={!ready} />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> SPD 2D Laplacian · m = {n}² = <span style={{ color: EMERALD }}>{n * n} unknowns</span> · relative residual → machine ε
        {data ? (
          <>
            {" "}<span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}><span ref={msLabelRef}>{data.ms.toFixed(2)}</span> ms in WASM</span>
          </>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        One symmetric-positive-definite system, <span className="text-slate-200">−Δu = b</span> on an {n}×{n} grid, handed to
        three Krylov solvers at once. <span style={{ color: CYAN_GLOW }}>CG</span> exploits symmetry with a short recurrence;{" "}
        <span style={{ color: VIOLET }}>MINRES</span> minimises the residual norm monotonically; <span style={{ color: AMBER }}>GMRES</span>{" "}
        builds a full Krylov basis and plunges to machine precision in a couple of restart cycles. Each dot is a genuine
        residual from the compiled-Rust solver — no scripted curve. Watch them race down sixteen orders of magnitude to the
        emerald tolerance line.
      </div>
    </SyncContainer>
  );
}
