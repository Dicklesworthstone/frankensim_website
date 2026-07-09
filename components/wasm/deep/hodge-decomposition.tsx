"use client";

/**
 * Deep Kernel 01 — "The field, split three ways."
 *
 * Drives the real `hodge_decomposition(shape)` kernel: a discrete Hodge–Helmholtz
 * decomposition on an oriented 3-D tetrahedral complex (fs-feec). Every edge of the
 * complex carries a 1-cochain whose value splits, exactly and orthogonally, into an
 * EXACT (gradient) part, a COEXACT (curl) part, and a HARMONIC remainder. We draw the
 * complex's edges as a slowly-rotating glowing point cloud (one glyph per edge
 * midpoint), each layer tinted and sized by that edge's component value.
 *
 * The payoff: on the disk the harmonic layer is machine-zero; switch to the annulus
 * or the two-holes shape and it IGNITES — its dimension equals b₁, the number of
 * holes. That is exact discrete de Rham (d∘d = 0) made visible in a browser tab.
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
  AMBER,
  EMERALD,
  MUTED,
  BRIGHT,
  hexRgb,
  useReducedMotionSafe,
  useCanvasDpr,
  PanelHeader,
  Pill,
  ErrorNote,
  BootOverlay,
  Readout,
  Caption,
} from "./_chrome";

/* ------------------------------------------------------------------ */
/*  Kernel decode                                                      */
/* ------------------------------------------------------------------ */

type LayerKey = "exact" | "coexact" | "harmonic";

interface HodgeData {
  shape: number;
  betti: [number, number, number, number];
  resid: number; // worst orthogonality residual
  energy: Record<LayerKey, number>;
  edges: number;
  mx: Float64Array;
  my: Float64Array;
  mz: Float64Array;
  comp: Record<LayerKey, Float64Array>;
  center: [number, number, number];
  radius: number;
  globalMax: number;
  ms: number;
}

function decode(raw: Float64Array, shape: number, ms: number): HodgeData {
  const betti: [number, number, number, number] = [raw[1], raw[2], raw[3], raw[4]];
  const resid = Math.max(Math.abs(raw[5]), Math.abs(raw[6]), Math.abs(raw[7]));
  const energy: Record<LayerKey, number> = { exact: raw[8], coexact: raw[9], harmonic: raw[10] };
  const E = raw[11] | 0;
  const mx = new Float64Array(E);
  const my = new Float64Array(E);
  const mz = new Float64Array(E);
  const ex = new Float64Array(E);
  const co = new Float64Array(E);
  const ha = new Float64Array(E);
  let sx = 0,
    sy = 0,
    sz = 0,
    gmax = 0;
  for (let e = 0; e < E; e++) {
    const o = 12 + e * 6;
    mx[e] = raw[o];
    my[e] = raw[o + 1];
    mz[e] = raw[o + 2];
    ex[e] = raw[o + 3];
    co[e] = raw[o + 4];
    ha[e] = raw[o + 5];
    sx += mx[e];
    sy += my[e];
    sz += mz[e];
    gmax = Math.max(gmax, Math.abs(ex[e]), Math.abs(co[e]), Math.abs(ha[e]));
  }
  const center: [number, number, number] = [sx / E, sy / E, sz / E];
  let radius = 1e-6;
  for (let e = 0; e < E; e++) {
    const dx = mx[e] - center[0];
    const dy = my[e] - center[1];
    const dz = mz[e] - center[2];
    radius = Math.max(radius, Math.hypot(dx, dy, dz));
  }
  return {
    shape,
    betti,
    resid,
    energy,
    edges: E,
    mx,
    my,
    mz,
    comp: { exact: ex, coexact: co, harmonic: ha },
    center,
    radius,
    globalMax: gmax || 1,
    ms,
  };
}

/* ------------------------------------------------------------------ */
/*  Glow sprite (radial, whitening core)                               */
/* ------------------------------------------------------------------ */

function makeSprite(color: string, px = 96): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = px;
  c.height = px;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const [r, g, b] = hexRgb(color);
  const grd = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  grd.addColorStop(0.0, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.14, `rgba(${r},${g},${b},0.8)`);
  grd.addColorStop(0.45, `rgba(${r},${g},${b},0.26)`);
  grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, px, px);
  return c;
}

const LAYER_META: { key: LayerKey; label: string; color: string; symbol: string }[] = [
  { key: "exact", label: "Exact · dφ", color: CYAN, symbol: "d" },
  { key: "coexact", label: "Coexact · δβ", color: VIOLET, symbol: "δ" },
  { key: "harmonic", label: "Harmonic · ℋ", color: AMBER, symbol: "ℋ" },
];

const SHAPES = [
  { id: 0, label: "Disk" },
  { id: 1, label: "Annulus" },
  { id: 2, label: "Two holes" },
];

const FIT = 0.84; // fraction of the half-min-dim the cloud fills
const YAW_SPEED = 0.16; // rad / s
const PITCH = -0.5; // fixed tilt (rad)

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HodgeDecomposition() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [shape, setShape] = useState(1); // annulus by default → harmonic is alive
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ exact: true, coexact: true, harmonic: true });
  const [rotating, setRotating] = useState(true);
  const [data, setData] = useState<HodgeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokenRef = useRef(0);
  const thetaRef = useRef(0.7);
  const rafRef = useRef<number | null>(null);
  const dataRef = useRef<HodgeData | null>(null);
  dataRef.current = data;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const spritesRef = useRef<Record<LayerKey, HTMLCanvasElement> | null>(null);
  const drawRef = useRef<() => void>(() => {});

  if (spritesRef.current === null && typeof document !== "undefined") {
    spritesRef.current = {
      exact: makeSprite(CYAN),
      coexact: makeSprite(VIOLET),
      harmonic: makeSprite(AMBER),
    };
  }

  /* -- compute (once per shape) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("hodge_decomposition", shape);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        setData(decode(raw, shape, ms));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, shape, call]);

  /* -- draw a frame at the current yaw -- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const sprites = spritesRef.current;
    const d = dataRef.current;
    if (!canvas || !sprites) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    if (!d) return;

    const theta = thetaRef.current;
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);
    const cp = Math.cos(PITCH);
    const sp = Math.sin(PITCH);
    const [cx, cy, cz] = d.center;
    const scale = (Math.min(W, H) * 0.5 * FIT) / d.radius;
    const ox = W / 2;
    const oy = H / 2;

    // project (world-centered) → screen; returns [sx, sy, depth]
    const project = (x: number, y: number, z: number): [number, number, number] => {
      const X = x - cx;
      const Y = y - cy;
      const Z = z - cz;
      const x1 = X * cs + Z * sn;
      const z1 = -X * sn + Z * cs;
      const y2 = Y * cp - z1 * sp;
      const z2 = Y * sp + z1 * cp;
      return [ox + x1 * scale, oy - y2 * scale, z2];
    };

    // faint floor grid in the mid-plane for depth context
    ctx.lineWidth = Math.max(0.6, W / 900);
    ctx.strokeStyle = "rgba(34,211,238,0.07)";
    ctx.beginPath();
    const half = d.radius + 0.6;
    const step = 0.5;
    for (let g = -Math.ceil(half / step) * step; g <= half; g += step) {
      const a = project(cx + g, cy - half, cz);
      const b = project(cx + g, cy + half, cz);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      const c = project(cx - half, cy + g, cz);
      const e = project(cx + half, cy + g, cz);
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(e[0], e[1]);
    }
    ctx.stroke();

    // additive glow cloud, one layer at a time
    ctx.globalCompositeOperation = "lighter";
    const baseR = Math.min(W, H) * 0.055;
    const inv = 1 / d.globalMax;
    const lyr = layersRef.current;
    for (const meta of LAYER_META) {
      if (!lyr[meta.key]) continue;
      const comp = d.comp[meta.key];
      const sprite = sprites[meta.key];
      for (let e = 0; e < d.edges; e++) {
        const w = Math.min(1, Math.abs(comp[e]) * inv);
        if (w < 0.02) continue;
        const [sx, sy, depth] = project(d.mx[e], d.my[e], d.mz[e]);
        const depthF = 0.78 + 0.5 * (depth / d.radius); // nearer = larger/brighter
        const r = baseR * (0.32 + 0.95 * Math.sqrt(w)) * depthF;
        ctx.globalAlpha = Math.min(1, (0.16 + 0.84 * w) * (0.65 + 0.5 * depthF));
        ctx.drawImage(sprite, sx - r, sy - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.74);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }, []);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const stableRedraw = useCallback(() => drawRef.current(), []);
  useCanvasDpr(canvasRef, stableRedraw);

  // redraw immediately when data or layer toggles change
  useEffect(() => {
    draw();
  }, [draw, data, layers]);

  /* -- rotation loop (gated by view + reduced-motion + pause) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !rotating || !inView) {
      draw();
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      thetaRef.current += dt * YAW_SPEED;
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, reduced, rotating, inView, draw]);

  const toggle = useCallback((k: LayerKey) => {
    setLayers((p) => ({ ...p, [k]: !p[k] }));
  }, []);

  const harmonicAlive = !!data && data.energy.harmonic > 0.05;
  const fmtE = useMemo(() => (v: number) => (Math.abs(v) < 5e-4 ? "0.000" : v.toFixed(3)), []);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <PanelHeader
        eyebrow="Deep 01 · fs-feec"
        title={
          <>
            The field, <span className="text-cyan-400">split three ways</span>.
          </>
        }
        computing={computing}
      />

      {/* canvas */}
      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          style={{ filter: "saturate(1.12) contrast(1.05)" }}
          role="img"
          aria-label="A rotating 3D tetrahedral complex whose edges glow by their exact, coexact and harmonic Hodge components"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {!ready && <BootOverlay />}

        {/* instrument HUD */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            REAL fs-feec · d∘d = 0
          </span>
          {data && (
            <div
              className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm"
              style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  edges
                </span>
                <span
                  className="font-mono text-[13px] font-black tabular-nums"
                  style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}
                >
                  {data.edges}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  ⊥ residual
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD }}>
                  {data.resid.toExponential(0)}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>
                solved in {data.ms.toFixed(1)} ms
              </div>
            </div>
          )}
        </div>

        {/* Betti + harmonic-ignition seal */}
        {data && (
          <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
            <div
              className="rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm"
              style={{ borderColor: `${VIOLET}44`, background: "rgba(4,9,13,0.72)" }}
            >
              <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                Betti
              </div>
              <div className="font-mono text-[12px] font-black tabular-nums" style={{ color: "#d8b4fe" }}>
                b₀={data.betti[0]} · b₁={data.betti[1]}
              </div>
            </div>
            {harmonicAlive && (
              <div
                className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.15em] backdrop-blur-sm animate-pulse"
                style={{ borderColor: `${AMBER}88`, background: `${AMBER}14`, color: AMBER, textShadow: `0 0 10px ${AMBER}` }}
              >
                dim ℋ = b₁ = {data.betti[1]}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* energies */}
      {data && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {LAYER_META.map((m) => {
            const v = data.energy[m.key];
            const ignite = m.key === "harmonic" && harmonicAlive;
            return (
              <div
                key={m.key}
                className="rounded-lg border px-2.5 py-2"
                style={{
                  borderColor: ignite ? `${m.color}99` : `${m.color}33`,
                  background: ignite ? `${m.color}12` : "rgba(255,255,255,0.02)",
                }}
              >
                <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
                  ‖{m.symbol}‖²
                </div>
                <div
                  className="font-mono text-[15px] font-black tabular-nums md:text-lg"
                  style={{ color: m.color, textShadow: ignite ? `0 0 14px ${m.color}` : "none" }}
                >
                  {fmtE(v)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          shape
        </span>
        {SHAPES.map((s) => (
          <Pill key={s.id} onClick={() => setShape(s.id)} active={shape === s.id} ariaLabel={`Domain: ${s.label}`} disabled={!ready}>
            {s.label}
          </Pill>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          layers
        </span>
        {LAYER_META.map((m) => (
          <Pill
            key={m.key}
            onClick={() => toggle(m.key)}
            active={layers[m.key]}
            color={m.color}
            ariaLabel={`Toggle ${m.label} layer`}
            disabled={!ready}
          >
            {m.label}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill
          onClick={() => setRotating((r) => !r)}
          active={rotating && !reduced}
          color={EMERALD}
          ariaLabel={rotating ? "Pause rotation" : "Rotate"}
          disabled={!ready || reduced}
        >
          {rotating && !reduced ? "Pause" : "Rotate"}
        </Pill>
      </div>

      <Readout>
        {data ? (
          <>
            {SHAPES[shape].label} · {data.edges}-edge tet complex · Hodge split{" "}
            <span style={{ color: CYAN }}>exact</span> ⊕ <span style={{ color: VIOLET }}>coexact</span> ⊕{" "}
            <span style={{ color: AMBER }}>harmonic</span> <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>{data.ms.toFixed(1)} ms in WASM</span>
          </>
        ) : (
          "decomposing 1-cochain into exact ⊕ coexact ⊕ harmonic…"
        )}
      </Readout>

      <Caption>
        A genuine <span className="text-slate-200">discrete Hodge–Helmholtz decomposition</span> on an oriented
        tetrahedral complex, computed by <span className="text-cyan-300">fs-feec</span>. Any field on the edges splits{" "}
        exactly and orthogonally (⊥ residual ~10⁻¹⁷) into a <span style={{ color: CYAN }}>gradient</span>, a{" "}
        <span style={{ color: VIOLET }}>curl</span>, and a <span style={{ color: AMBER }}>harmonic</span> remainder — the
        part no potential can explain. On the <span className="text-slate-200">disk</span> that remainder is machine-zero;
        switch to the <span className="text-slate-200">annulus</span> or <span className="text-slate-200">two holes</span>{" "}
        and it ignites, because the dimension of the harmonic space equals{" "}
        <span style={{ color: AMBER }}>b₁</span>, the number of holes. This is exact discrete de Rham (d∘d = 0), the same
        cochain algebra the native workspace runs, made visible in your tab.
      </Caption>
    </SyncContainer>
  );
}
