"use client";

/**
 * Campaign 05 — trusspath(nx, ny, gap_tol)  ·  fs-truss-e2e (fs-truss × fs-tropical)
 * "The optimal cantilever, distilled from a cloud of bars."
 *
 * A Michell GROUND STRUCTURE: every candidate bar on an nx×ny grid over the
 * cantilever domain [0,4]×[0,2] (43 candidates at the default). A first-order PDHG
 * LP (fs-truss) sizes them to minimum material under equilibrium and emits a
 * machine-checkable relative duality GAP (~7.8e-5 — the certificate of near-
 * optimality); only a handful of bars survive (6 active at the default). Then a
 * max-plus TROPICAL critical LOAD PATH (fs-tropical) finds the single chain that
 * carries the most material from the load down to the supports, and names its
 * bottleneck bar.
 *
 * We draw all candidates as a faint cloud; the active bars bright with width ∝ |force|
 * (tension cyan / compression rose); the critical path glowing emerald and animating
 * load → support; the left-edge supports as anchors and the loaded corner with a
 * downward force arrow. A real optimized truss, emerging from noise, live in the tab.
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

interface Member {
  a: number;
  b: number;
  force: number;
  volume: number;
  active: boolean;
}
interface TrussData {
  M: number;
  numActive: number;
  totalVol: number;
  gap: number;
  eqResidual: number;
  iters: number;
  certified: boolean;
  P: number;
  cpVol: number;
  bottleneck: number;
  Nn: number;
  loadNode: number;
  nodes: [number, number][];
  members: Member[];
  path: number[]; // original member indices, load → support
  pathSet: Set<number>;
  supports: number[];
  maxForce: number;
  ms: number;
  seq: number;
}

function decode(raw: Float64Array, ms: number, seq: number): TrussData {
  const M = Math.round(raw[0]);
  const Nn = Math.round(raw[10]);
  const nodes: [number, number][] = [];
  const nbase = 12;
  for (let k = 0; k < Nn; k++) nodes.push([raw[nbase + 2 * k], raw[nbase + 2 * k + 1]]);
  const mbase = nbase + 2 * Nn;
  const members: Member[] = [];
  let maxForce = 1e-12;
  for (let k = 0; k < M; k++) {
    const o = mbase + 5 * k;
    const m: Member = {
      a: Math.round(raw[o]),
      b: Math.round(raw[o + 1]),
      force: raw[o + 2],
      volume: raw[o + 3],
      active: raw[o + 4] > 0.5,
    };
    members.push(m);
    if (m.active) maxForce = Math.max(maxForce, Math.abs(m.force));
  }
  const P = Math.round(raw[7]);
  const pbase = mbase + 5 * M;
  const path: number[] = [];
  for (let k = 0; k < P; k++) path.push(Math.round(raw[pbase + k]));
  // supports = left-edge nodes (x ≈ min x)
  let minX = Infinity;
  for (const [x] of nodes) minX = Math.min(minX, x);
  const supports = nodes.map((_, i) => i).filter((i) => nodes[i][0] - minX < 1e-6);
  return {
    M,
    numActive: Math.round(raw[1]),
    totalVol: raw[2],
    gap: raw[3],
    eqResidual: raw[4],
    iters: Math.round(raw[5]),
    certified: raw[6] > 0.5,
    P,
    cpVol: raw[8],
    bottleneck: Math.round(raw[9]),
    Nn,
    loadNode: Math.round(raw[11]),
    nodes,
    members,
    path,
    pathSet: new Set(path),
    supports,
    maxForce,
    ms,
    seq,
  };
}

export default function TrussPath() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [nx, setNx] = useState(4);
  const [ny, setNy] = useState(3);
  const [gapTol, setGapTol] = useState(1e-4);
  const [data, setData] = useState<TrussData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<TrussData | null>(null);
  dataRef.current = data;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  const activeRef = useEasedText<HTMLSpanElement>(data?.numActive ?? 0, reduced, (v) => String(Math.round(v)), {
    enabled: !!data,
    inViewRef,
  });
  const volRef = useEasedText<HTMLSpanElement>(data?.totalVol ?? 0, reduced, (v) => v.toFixed(2), {
    enabled: !!data,
    inViewRef,
  });
  const cpVolRef = useEasedText<HTMLSpanElement>(data?.cpVol ?? 0, reduced, (v) => v.toFixed(2), {
    enabled: !!data,
    inViewRef,
  });

  /* -- debounced compute (the LP is the heavy part) -- */
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const token = ++tokenRef.current;
      setComputing(true);
      setError(null);
      (async () => {
        try {
          const t0 = performance.now();
          const raw = await call<Float64Array>("trusspath", nx, ny, gapTol);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          setData(decode(raw, ms, token));
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 180);
    return () => clearTimeout(id);
  }, [ready, nx, ny, gapTol, call]);

  /* -- draw the ground structure + optimized truss + critical load path -- */
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
    if (!d || d.nodes.length === 0) return;
    const rm = reducedRef.current;

    // fit the [minX,maxX]×[minY,maxY] domain, preserving aspect
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [x, y] of d.nodes) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const domW = Math.max(1e-6, maxX - minX);
    const domH = Math.max(1e-6, maxY - minY);
    const padL = W * 0.06;
    const padR = W * 0.06;
    const padT = H * 0.14;
    const padB = H * 0.17;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const scale = Math.min(plotW / domW, plotH / domH);
    const ox = padL + (plotW - domW * scale) / 2;
    const oy = padT + (plotH - domH * scale) / 2;
    const mapX = (x: number) => ox + (x - minX) * scale;
    const mapY = (y: number) => oy + (maxY - y) * scale; // domain y-up → screen y-down
    const P = (i: number): [number, number] => [mapX(d.nodes[i][0]), mapY(d.nodes[i][1])];
    const wOf = (f: number) => {
      const t = Math.min(1, Math.abs(f) / d.maxForce);
      return Math.max(1.4, W / 620) + t * Math.max(4.6, W / 95);
    };
    const distSupport = (i: number) => {
      let dmin = Infinity;
      for (const s of d.supports) dmin = Math.min(dmin, Math.hypot(d.nodes[i][0] - d.nodes[s][0], d.nodes[i][1] - d.nodes[s][1]));
      return dmin;
    };

    // 1) candidate cloud — every ground-structure bar, ghostly
    ctx.lineCap = "round";
    for (const m of d.members) {
      if (m.active) continue;
      const [ax, ay] = P(m.a);
      const [bx, by] = P(m.b);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = "rgba(120,140,160,0.10)";
      ctx.lineWidth = Math.max(0.6, W / 1100);
      ctx.stroke();
    }

    // 2) active bars (not on the critical path) — tension cyan / compression rose
    for (let idx = 0; idx < d.members.length; idx++) {
      const m = d.members[idx];
      if (!m.active || d.pathSet.has(idx)) continue;
      const tension = m.force >= 0;
      const col = tension ? CYAN_GLOW : ROSE;
      const [ax, ay] = P(m.a);
      const [bx, by] = P(m.b);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = rgba(col, 0.9);
      ctx.lineWidth = wOf(m.force);
      ctx.shadowColor = col;
      ctx.shadowBlur = W / 240;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 3) critical load path — emerald, revealed load → support, width ∝ |force|
    for (let k = 0; k < d.path.length; k++) {
      const idx = d.path[k];
      const m = d.members[idx];
      if (!m) continue;
      const local = Math.max(0, Math.min(1, (reveal - k / Math.max(1, d.path.length)) * Math.max(1, d.path.length)));
      if (local <= 0) continue;
      // grow from the load-side endpoint (farther from support) toward the support
      const da = distSupport(m.a);
      const db = distSupport(m.b);
      const start = da >= db ? m.a : m.b;
      const end = da >= db ? m.b : m.a;
      const [sx, sy] = P(start);
      const [ex, ey] = P(end);
      const cxp = sx + (ex - sx) * local;
      const cyp = sy + (ey - sy) * local;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(cxp, cyp);
      ctx.strokeStyle = rgba(EMERALD, 0.96);
      ctx.lineWidth = wOf(m.force) + Math.max(1, W / 400);
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = W / 70;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // bottleneck bar: pulsing halo
      if (idx === d.bottleneck && local >= 1) {
        const pulse = rm ? 1 : 0.6 + 0.4 * Math.sin(time * 0.005);
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(6, W / 60) * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(EMERALD, 0.7);
        ctx.lineWidth = Math.max(1.2, W / 360);
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = (W / 80) * pulse;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // 4) traveling pulse along the fully-revealed load path
    if (!rm && reveal >= 0.999 && d.path.length > 0) {
      const frac = (time * 0.00035) % 1;
      const seg = Math.min(d.path.length - 1, Math.floor(frac * d.path.length));
      const m = d.members[d.path[seg]];
      if (m) {
        const da = distSupport(m.a);
        const db = distSupport(m.b);
        const start = da >= db ? m.a : m.b;
        const end = da >= db ? m.b : m.a;
        const localT = frac * d.path.length - seg;
        const [sx, sy] = P(start);
        const [ex, ey] = P(end);
        ctx.beginPath();
        ctx.arc(sx + (ex - sx) * localT, sy + (ey - sy) * localT, Math.max(2.5, W / 200), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(209,250,229,0.95)";
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = W / 45;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 5) joints
    for (let i = 0; i < d.nodes.length; i++) {
      const [x, y] = P(i);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.6, W / 360), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(203,213,225,0.6)";
      ctx.fill();
    }

    // 6) supports (left-edge anchors) — pin triangles + ground hatch
    const tri = Math.max(6, W / 62);
    for (const s of d.supports) {
      const [x, y] = P(s);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - tri, y - tri * 0.62);
      ctx.lineTo(x - tri, y + tri * 0.62);
      ctx.closePath();
      ctx.fillStyle = rgba(EMERALD, 0.18);
      ctx.strokeStyle = rgba(EMERALD, 0.85);
      ctx.lineWidth = Math.max(1, W / 480);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = rgba(EMERALD, 0.5);
      ctx.lineWidth = Math.max(0.8, W / 600);
      for (let h = 0; h < 4; h++) {
        const hy = y - tri * 0.62 + (tri * 1.24 * h) / 3;
        ctx.beginPath();
        ctx.moveTo(x - tri, hy);
        ctx.lineTo(x - tri - tri * 0.42, hy + tri * 0.42);
        ctx.stroke();
      }
    }

    // 7) load arrow at the loaded corner (unit downward force)
    if (d.loadNode >= 0 && d.loadNode < d.nodes.length) {
      const [lx, ly] = P(d.loadNode);
      const len = Math.max(20, H * 0.13);
      const tipY = ly + len;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, tipY);
      ctx.strokeStyle = rgba(AMBER, 0.95);
      ctx.lineWidth = Math.max(1.6, W / 300);
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = W / 120;
      ctx.stroke();
      const ah = Math.max(5, W / 110);
      ctx.beginPath();
      ctx.moveTo(lx, tipY + ah * 0.5);
      ctx.lineTo(lx - ah * 0.6, tipY - ah * 0.5);
      ctx.lineTo(lx + ah * 0.6, tipY - ah * 0.5);
      ctx.closePath();
      ctx.fillStyle = AMBER;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(AMBER, 0.95);
      ctx.font = `${Math.max(8, W / 56)}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("load", lx + ah, tipY);
    }
  }, []);

  /* -- DPR sizing + redraw -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const dp = dpr();
      const cssW = canvas.clientWidth || 480;
      const w = Math.max(240, Math.min(1200, Math.round(cssW * dp)));
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

  /* -- reveal on each fresh truss -- */
  useEffect(() => {
    if (!data) return;
    if (!seenRef.current) seenRef.current = true;
    revealStartRef.current = performance.now();
    revealRef.current = 0;
  }, [data]);

  /* -- animation loop (gated) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      draw(1, 0);
      return;
    }
    const DUR = 1150;
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

  const onNx = (v: number) => setNx(Math.round(v));
  const onNy = (v: number) => setNy(Math.round(v));

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 05 · fs-truss-e2e · LP × tropical</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            The optimal cantilever, distilled from a <span className="text-cyan-300">cloud of bars</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* truss canvas */}
      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full"
          style={{ aspectRatio: "1 / 0.6" }}
          role="img"
          aria-label="A Michell ground structure of candidate bars sized by an LP; active bars are bright by tension/compression and the critical load path glows emerald from the loaded corner to the supports"
        />
        <span
          className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
          style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}
        >
          ground structure · min-volume LP
        </span>

        {/* certified seal */}
        {data && (
          <div
            className="pointer-events-none absolute right-3 top-3 flex flex-col items-end rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm"
            style={{ borderColor: `${(data.certified ? EMERALD : AMBER)}44`, background: "rgba(4,9,13,0.72)" }}
          >
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              duality gap
            </span>
            <span
              className="font-mono text-[15px] font-black leading-none tabular-nums"
              style={{ color: data.certified ? "#d1fae5" : AMBER, textShadow: `0 0 12px ${(data.certified ? EMERALD : AMBER)}66` }}
            >
              {data.gap.toExponential(1)}
            </span>
            <span
              className="mt-1 rounded-full border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em]"
              style={
                data.certified
                  ? { borderColor: `${EMERALD}88`, background: `${EMERALD}14`, color: EMERALD }
                  : { borderColor: `${AMBER}66`, background: `${AMBER}12`, color: AMBER }
              }
            >
              {data.certified ? "Verified optimal" : "iterating"}
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

      {/* stat tiles */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${CYAN}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            bars kept
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: CYAN_GLOW }}>
            <span ref={activeRef}>{data?.numActive ?? "—"}</span>
            <span style={{ color: MUTED }}> / {data?.M ?? "—"}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${VIOLET}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            total volume
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: VIOLET }}>
            <span ref={volRef}>{data ? data.totalVol.toFixed(2) : "—"}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${EMERALD}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            path volume
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: EMERALD }}>
            <span ref={cpVolRef}>{data ? data.cpVol.toFixed(2) : "—"}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${EMERALD}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            bottleneck bar
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: EMERALD }}>
            {data && data.bottleneck >= 0 ? `#${data.bottleneck}` : "—"}
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]" style={{ color: MUTED }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: CYAN_GLOW }} /> tension
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: ROSE }} /> compression
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: EMERALD }} /> critical load path
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: "rgba(120,140,160,0.3)" }} /> candidate
        </span>
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="grid nx" value={nx} min={2} max={5} step={1} onChange={onNx} format={(v) => String(Math.round(v))} disabled={!ready} />
        <Slider label="grid ny" value={ny} min={2} max={4} step={1} onChange={onNy} format={(v) => String(Math.round(v))} color={VIOLET} disabled={!ready} />
        <Slider
          label="gap tol"
          value={gapTol}
          min={1e-4}
          max={1e-2}
          step={1e-4}
          onChange={setGapTol}
          format={(v) => v.toExponential(0)}
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
            <span style={{ color: CYAN_GLOW }}>{data.M}</span> candidates →{" "}
            <span style={{ color: EMERALD }}>{data.numActive} active</span> · gap{" "}
            <span style={{ color: data.certified ? EMERALD : AMBER }}>{data.gap.toExponential(1)}</span>
            {data.certified ? <span style={{ color: EMERALD }}> ✓ optimal</span> : null}{" "}
            <span style={{ color: MUTED }}>│</span> load path{" "}
            <span style={{ color: EMERALD }}>{data.path.length} bars</span>, bottleneck{" "}
            <span style={{ color: EMERALD }}>#{data.bottleneck}</span> <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>{data.iters.toLocaleString()} PDHG iters · {data.ms.toFixed(1)} ms</span>
          </>
        ) : (
          "sizing every candidate bar with a certified LP, then tracing the tropical critical load path…"
        )}
      </div>

      {/* caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Every faint line is a <span className="text-slate-200">candidate bar</span> in a Michell ground structure over the
        cantilever. A first-order <span style={{ color: VIOLET }}>PDHG linear program</span> (
        <span className="text-cyan-300">fs-truss</span>) sizes them to minimum material under equilibrium and emits a
        machine-checkable relative <span style={{ color: EMERALD }}>duality gap</span> — the certificate that the answer is
        within that gap of optimal. Only a handful survive:{" "}
        <span style={{ color: CYAN_GLOW }}>tension</span> bars in cyan, <span style={{ color: ROSE }}>compression</span> in
        rose, width set by force. A max-plus <span style={{ color: EMERALD }}>tropical critical path</span> (
        <span className="text-cyan-300">fs-tropical</span>) then finds the single chain carrying the most material from the{" "}
        <span style={{ color: AMBER }}>loaded corner</span> down to the supports, and names its{" "}
        <span style={{ color: EMERALD }}>bottleneck bar</span>. A real optimized truss, emerging from the noise — compiled
        Rust, live in your tab.
      </div>
    </SyncContainer>
  );
}
