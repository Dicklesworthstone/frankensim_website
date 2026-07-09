"use client";

/**
 * Campaign 02 — metamatcert(n, points, rmax)  ·  fs-metamat-e2e
 * "Every point on the frontier is certified."
 *
 * A holed-plate metamaterial. Numerical homogenization (fs-lattice) gives each
 * porosity an effective Voigt tensor and density; every point is PROVEN
 * positive-definite / PSD-stable (fs-sos::is_psd) AND Voigt-admissible
 * (fs-lattice::voigt_bound: C₁₁ ≤ ρ·c_solid). As the holes grow the axial
 * stiffness C₁₁ falls monotonically from c_solid toward ~0.8, and the whole
 * stiffness–density frontier carries a single Verified color.
 *
 * Left: the frontier in (density → C₁₁) space, each node glowing emerald when its
 * dual certificate holds, hugging beneath the Voigt upper-bound line. Right: an
 * inset of the tiled holed unit cell whose hole grows as the selection sweeps the
 * frontier (hover a node to pin it).
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
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Slider,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/deep/_chrome";

interface CellPt {
  r: number;
  density: number;
  c11: number;
  specific: number;
  stable: boolean;
  admissible: boolean;
}
interface MMData {
  pts: CellPt[];
  cSolid: number;
  allStable: boolean;
  allAdmissible: boolean;
  monotone: boolean;
  solidOptimal: boolean;
  colorVerified: boolean;
  ms: number;
}

const nodeColor = (p: CellPt): string => (p.stable && p.admissible ? EMERALD : p.stable ? AMBER : ROSE);

export default function MetamatFrontier() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [n, setN] = useState(10);
  const [points, setPoints] = useState(6);
  const [rmax, setRmax] = useState(0.4);
  const [data, setData] = useState<MMData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const frontRef = useRef<HTMLCanvasElement>(null);
  const cellRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<MMData | null>(null);
  dataRef.current = data;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);
  const pointerSelRef = useRef(-1);

  const cSolidRef = useEasedText<HTMLSpanElement>(data?.cSolid ?? 0, reduced, (v) => v.toFixed(3), {
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
        const raw = await call<Float64Array>("metamatcert", n, points, rmax);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const P = Math.round(raw[0]);
        const cSolid = raw[1];
        const allStable = raw[2] > 0.5;
        const allAdmissible = raw[3] > 0.5;
        const monotone = raw[4] > 0.5;
        const solidOptimal = raw[5] > 0.5;
        const colorVerified = raw[6] > 0.5;
        const pts: CellPt[] = [];
        for (let i = 0; i < P; i++) {
          const b = 7 + 6 * i;
          pts.push({
            r: raw[b],
            density: raw[b + 1],
            c11: raw[b + 2],
            specific: raw[b + 3],
            stable: raw[b + 4] > 0.5,
            admissible: raw[b + 5] > 0.5,
          });
        }
        pointerSelRef.current = -1;
        setData({ pts, cSolid, allStable, allAdmissible, monotone, solidOptimal, colorVerified, ms });
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, n, points, rmax, call]);

  const selFloat = useCallback((d: MMData, now: number): number => {
    if (pointerSelRef.current >= 0) return Math.min(d.pts.length - 1, pointerSelRef.current);
    if (reducedRef.current || d.pts.length <= 1) return d.pts.length - 1;
    const period = 7000;
    const ph = (now % period) / period;
    const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    return tri * (d.pts.length - 1);
  }, []);

  /* -- frontier (left) -- */
  const drawFrontier = useCallback(
    (reveal: number, time: number) => {
      const canvas = frontRef.current;
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
      const padR = W * 0.05;
      const padT = H * 0.08;
      const padB = H * 0.13;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const fs = Math.max(8, W / 46);

      let dLo = Infinity;
      let dHi = -Infinity;
      let cLo = Infinity;
      for (const p of d.pts) {
        dLo = Math.min(dLo, p.density);
        dHi = Math.max(dHi, p.density);
        cLo = Math.min(cLo, p.c11);
      }
      dHi = Math.max(dHi, 1.0);
      const xLo = Math.max(0, dLo - (dHi - dLo) * 0.12 - 0.02);
      const xHi = dHi + (dHi - dLo) * 0.06 + 0.02;
      const yLo = Math.max(0, cLo - (d.cSolid - cLo) * 0.12);
      const yHi = d.cSolid * xHi * 1.02;

      const X = (x: number) => padL + ((x - xLo) / (xHi - xLo)) * plotW;
      const Y = (y: number) => padT + (1 - (y - yLo) / (yHi - yLo)) * plotH;

      // grid + axis labels
      ctx.strokeStyle = "rgba(148,163,184,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const gy = padT + (plotH * i) / 4;
        ctx.moveTo(padL, gy);
        ctx.lineTo(W - padR, gy);
      }
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("density ρ →", padL + plotW / 2, H - padB * 0.55);
      ctx.save();
      ctx.translate(padL * 0.34, padT + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = "middle";
      ctx.fillText("axial stiffness C₁₁", 0, 0);
      ctx.restore();

      // Voigt upper-bound line  C11 = ρ·c_solid
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = `${TEAL}aa`;
      ctx.lineWidth = Math.max(1.2, W / 420);
      ctx.beginPath();
      ctx.moveTo(X(xLo), Y(Math.min(yHi, d.cSolid * xLo)));
      ctx.lineTo(X(xHi), Y(Math.min(yHi, d.cSolid * xHi)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = TEAL;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("Voigt bound  C₁₁ ≤ ρ·c_solid", W - padR - 2, Y(Math.min(yHi, d.cSolid * xHi)) + fs * 1.2);

      // progressive frontier polyline (solid → porous)
      const prog = reveal * (d.pts.length - 1);
      const kFull = Math.floor(prog + 1e-6);
      ctx.beginPath();
      for (let i = 0; i <= Math.min(kFull, d.pts.length - 1); i++) {
        const px = X(d.pts[i].density);
        const py = Y(d.pts[i].c11);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      if (kFull < d.pts.length - 1) {
        const frac = prog - kFull;
        const a = d.pts[kFull];
        const b = d.pts[kFull + 1];
        ctx.lineTo(X(a.density + (b.density - a.density) * frac), Y(a.c11 + (b.c11 - a.c11) * frac));
      }
      ctx.strokeStyle = "rgba(16,185,129,0.7)";
      ctx.lineWidth = Math.max(1.6, W / 300);
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const sel = selFloat(d, time);
      const selIdx = Math.round(sel);

      // nodes
      for (let i = 0; i <= Math.min(kFull, d.pts.length - 1); i++) {
        const p = d.pts[i];
        const px = X(p.density);
        const py = Y(p.c11);
        const col = nodeColor(p);
        const hot = i === selIdx;
        const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 0.004 + i);
        if (hot) {
          ctx.beginPath();
          ctx.arc(px, py, Math.max(6, W / 70), 0, Math.PI * 2);
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1.3, W / 300);
          ctx.shadowColor = col;
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(px, py, Math.max(3, W / 130), 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = (hot ? 16 : 8) * pulse;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    },
    [reduced, selFloat],
  );

  /* -- tiled holed unit cell (right) -- */
  const drawCell = useCallback(
    (reveal: number, time: number) => {
      const canvas = cellRef.current;
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

      const sel = selFloat(d, time);
      const lo = Math.floor(sel);
      const hi = Math.min(d.pts.length - 1, lo + 1);
      const frac = sel - lo;
      const rNow = d.pts[lo].r + (d.pts[hi].r - d.pts[lo].r) * frac;
      const selIdx = Math.round(sel);
      const p = d.pts[selIdx];
      const col = nodeColor(p);

      const margin = W * 0.1;
      const side = Math.min(W, H) - margin * 2;
      const ox = (W - side) / 2;
      const oy = (H - side) / 2;
      const tiles = 3;
      const cs = side / tiles;
      const holeR = rNow * cs * reveal; // r is in unit-cell coords (cell side = 1)

      const shimmer = reduced ? 1 : 0.9 + 0.1 * Math.sin(time * 0.003);
      for (let ty = 0; ty < tiles; ty++) {
        for (let tx = 0; tx < tiles; tx++) {
          const cx0 = ox + tx * cs;
          const cy0 = oy + ty * cs;
          const cx = cx0 + cs / 2;
          const cy = cy0 + cs / 2;
          // solid material
          const grad = ctx.createLinearGradient(cx0, cy0, cx0 + cs, cy0 + cs);
          grad.addColorStop(0, "rgba(20,184,166,0.30)");
          grad.addColorStop(1, "rgba(16,185,129,0.16)");
          ctx.fillStyle = grad;
          ctx.fillRect(cx0 + 0.5, cy0 + 0.5, cs - 1, cs - 1);
          ctx.strokeStyle = "rgba(148,163,184,0.18)";
          ctx.lineWidth = 1;
          ctx.strokeRect(cx0 + 0.5, cy0 + 0.5, cs - 1, cs - 1);
          // hole (void)
          if (holeR > 0.5) {
            ctx.beginPath();
            ctx.arc(cx, cy, holeR, 0, Math.PI * 2);
            ctx.fillStyle = BG;
            ctx.fill();
            ctx.strokeStyle = `${col}cc`;
            ctx.lineWidth = Math.max(1, W / 300);
            ctx.shadowColor = col;
            ctx.shadowBlur = 8 * shimmer;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }

      // labels
      ctx.font = `${Math.max(8, W / 30)}px ui-monospace, monospace`;
      ctx.fillStyle = col;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`r = ${p.r.toFixed(3)}`, ox, oy - Math.max(11, W / 22));
      ctx.fillStyle = MUTED;
      ctx.textAlign = "right";
      ctx.fillText(`ρ ${p.density.toFixed(3)}`, ox + side, oy - Math.max(11, W / 22));
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = CYAN_GLOW;
      ctx.fillText(`C₁₁ ${p.c11.toFixed(3)}`, ox, oy + side + Math.max(13, W / 20));
      ctx.textAlign = "right";
      ctx.fillStyle = p.stable && p.admissible ? EMERALD : AMBER;
      ctx.fillText(p.stable && p.admissible ? "PSD ✓ · Voigt ✓" : "check", ox + side, oy + side + Math.max(13, W / 20));
    },
    [reduced, selFloat],
  );

  /* -- DPR sizing + redraw -- */
  const redrawStatic = useCallback(() => {
    drawFrontier(revealRef.current, performance.now());
    drawCell(revealRef.current, performance.now());
  }, [drawFrontier, drawCell]);

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
      size(frontRef.current, 0.8);
      size(cellRef.current, 0.92);
      redrawStatic();
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      if (frontRef.current) ro.observe(frontRef.current);
      if (cellRef.current) ro.observe(cellRef.current);
    }
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [redrawStatic]);

  /* -- pointer: pin the nearest frontier node -- */
  useEffect(() => {
    const canvas = frontRef.current;
    if (!canvas) return;
    const onMove = (ev: PointerEvent) => {
      const d = dataRef.current;
      if (!d) return;
      const rect = canvas.getBoundingClientRect();
      const fx = (ev.clientX - rect.left) / Math.max(1, rect.width);
      let best = 0;
      let bestErr = Infinity;
      // map pointer x back through the same density axis used in draw
      let dLo = Infinity;
      let dHi = -Infinity;
      for (const p of d.pts) {
        dLo = Math.min(dLo, p.density);
        dHi = Math.max(dHi, p.density);
      }
      dHi = Math.max(dHi, 1.0);
      const xLo = Math.max(0, dLo - (dHi - dLo) * 0.12 - 0.02);
      const xHi = dHi + (dHi - dLo) * 0.06 + 0.02;
      const padFracL = 0.13;
      const padFracR = 0.05;
      const dens = xLo + ((fx - padFracL) / (1 - padFracL - padFracR)) * (xHi - xLo);
      d.pts.forEach((p, i) => {
        const e = Math.abs(p.density - dens);
        if (e < bestErr) {
          bestErr = e;
          best = i;
        }
      });
      pointerSelRef.current = best;
      if (reducedRef.current || !inViewRef.current) redrawStatic();
    };
    const onLeave = () => {
      pointerSelRef.current = -1;
      if (reducedRef.current || !inViewRef.current) redrawStatic();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [redrawStatic, inViewRef]);

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
      drawFrontier(1, 0);
      drawCell(1, 0);
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
      drawFrontier(revealRef.current, now);
      drawCell(revealRef.current, now);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [data, inView, reduced, inViewRef, drawFrontier, drawCell]);

  const chip = (label: string, ok: boolean) => (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest"
      style={{ borderColor: `${ok ? EMERALD : ROSE}55`, background: `${ok ? EMERALD : ROSE}12`, color: ok ? EMERALD : ROSE }}
    >
      {label} {ok ? "✓" : "✗"}
    </span>
  );

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 02 · fs-metamat-e2e · homogenization</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Every point on the frontier is <span className="text-emerald-400">certified</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1.25fr_0.75fr]">
        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={frontRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 0.8" }}
            role="img"
            aria-label="A stiffness-density frontier with each point glowing emerald where its PSD-stable and Voigt-admissible certificate holds, beneath the Voigt upper-bound line"
          />
          <span
            className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}
          >
            certified frontier
          </span>
          {!ready && <BootOverlay />}
        </div>

        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={cellRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 0.92" }}
            role="img"
            aria-label="A tiled holed unit cell whose circular void grows as the selection sweeps along the frontier"
          />
          <span
            className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${TEAL}66`, background: `${BG}bb`, color: TEAL }}
          >
            unit cell
          </span>
          {!ready && <BootOverlay />}
        </div>
      </div>

      {/* certificate chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chip("PSD-stable", data?.allStable ?? false)}
        {chip("Voigt-admissible", data?.allAdmissible ?? false)}
        {chip("monotone", data?.monotone ?? false)}
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest"
          style={{
            borderColor: `${data?.colorVerified ? EMERALD : AMBER}55`,
            background: `${data?.colorVerified ? EMERALD : AMBER}12`,
            color: data?.colorVerified ? EMERALD : AMBER,
          }}
        >
          frontier · {data?.colorVerified ? "Verified" : "unverified"}
        </span>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="cell n" value={n} min={6} max={14} step={1} onChange={(v) => setN(Math.round(v))} format={(v) => `${Math.round(v)}²`} disabled={!ready} />
        <Slider label="points" value={points} min={2} max={12} step={1} onChange={(v) => setPoints(Math.round(v))} format={(v) => String(Math.round(v))} color={VIOLET} disabled={!ready} />
        <Slider label="r_max" value={rmax} min={0.05} max={0.45} step={0.01} onChange={setRmax} format={(v) => v.toFixed(2)} color={TEAL} disabled={!ready} />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> c_solid = <span style={{ color: TEAL }}><span ref={cSolidRef}>{data ? data.cSolid.toFixed(3) : "—"}</span></span> ·{" "}
        {data ? data.pts.length : "—"}-point frontier ·{" "}
        <span style={{ color: EMERALD }}>{data && data.allStable && data.allAdmissible ? "all points certified" : "checking"}</span>
        {data ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(2)} ms in WASM</span>
          </>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A <span className="text-slate-200">metamaterial</span>: a plate perforated with a lattice of holes. FrankenSim{" "}
        <span style={{ color: TEAL }}>homogenizes</span> each porosity into an effective stiffness tensor and density, then proves
        two things about every point — that the tensor is <span style={{ color: EMERALD }}>positive-definite</span> (physically
        stable) and that it obeys the <span style={{ color: TEAL }}>Voigt bound</span> C₁₁ ≤ ρ·c_solid (no microstructure can beat
        the rule of mixtures). As the holes grow, axial stiffness <span className="text-slate-200">C₁₁</span> slides monotonically
        down the frontier, each node hugging just beneath the dashed bound. Both certificates hold at every point, so the whole
        frontier earns a single <span style={{ color: EMERALD }}>Verified</span> color — real fs-lattice homogenization and fs-sos
        proofs, compiled to WASM.
      </div>
    </SyncContainer>
  );
}
