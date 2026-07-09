"use client";

/**
 * Deep Kernel 10 — betti_shapes(shape)
 * "Count the holes."
 *
 * The exact Betti numbers b₀..b₃ of a simplicial complex (a thin 3-D slab), plus
 * a harmonic 1-cochain representative for every independent loop — the actual
 * generator of H¹ the kernel computes via a discrete Hodge decomposition. Each
 * edge midpoint is projected from 3-D and lit by its harmonic value, so the
 * circulation around every tunnel glows as its own loop. b₁ and the number of
 * glowing loops always change together. Ties to the sheaf-cohomology tier.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SyncContainer } from "@/components/sync-elements";
import { motion, AnimatePresence } from "@/components/motion";
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
  MUTED,
  BRIGHT,
  dpr,
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Pill,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/frontier/_chrome";

const SHAPES = ["Disk", "Annulus", "Two holes"];
const HOLE_HUE: [number, number, number][] = [
  [34, 211, 238], // cyan
  [251, 191, 36], // amber
];
const TILT = 1.02; // radians

interface BettiData {
  betti: [number, number, number, number];
  mids: Float64Array; // E * [x,y,z]
  E: number;
  harmonics: Float64Array[]; // H arrays of length E
  H: number;
  gmax: number;
  center: [number, number, number];
  radius: number;
  ms: number;
  seq: number;
}

export default function BettiShapes() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [shape, setShape] = useState(1);
  const [selHole, setSelHole] = useState(-1); // -1 = all
  const [data, setData] = useState<BettiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<BettiData | null>(null);
  dataRef.current = data;
  const selHoleRef = useRef(selHole);
  selHoleRef.current = selHole;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("betti_shapes", shape);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const betti: [number, number, number, number] = [
          Math.round(raw[0]), Math.round(raw[1]), Math.round(raw[2]), Math.round(raw[3]),
        ];
        const E = Math.round(raw[4]);
        const mids = raw.subarray(5, 5 + E * 3).slice();
        let i = 5 + E * 3;
        const H = Math.round(raw[i++]);
        const harmonics: Float64Array[] = [];
        let gmax = 1e-9;
        for (let h = 0; h < H; h++) {
          const arr = raw.subarray(i, i + E).slice();
          i += E;
          for (let e = 0; e < E; e++) gmax = Math.max(gmax, Math.abs(arr[e]));
          harmonics.push(arr);
        }
        let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, minz = Infinity, maxz = -Infinity;
        for (let e = 0; e < E; e++) {
          const x = mids[e * 3], y = mids[e * 3 + 1], z = mids[e * 3 + 2];
          if (x < minx) minx = x; if (x > maxx) maxx = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
          if (z < minz) minz = z; if (z > maxz) maxz = z;
        }
        const center: [number, number, number] = [(minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2];
        let radius = 1e-6;
        for (let e = 0; e < E; e++) {
          radius = Math.max(radius, Math.hypot(mids[e * 3] - center[0], mids[e * 3 + 1] - center[1], mids[e * 3 + 2] - center[2]));
        }
        dataRef.current = { betti, mids, E, harmonics, H, gmax, center, radius, ms, seq: token };
        setData(dataRef.current);
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, shape, call]);

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

    const theta = reduced ? 0.5 : 0.5 + time * 0.00035;
    const ct = Math.cos(theta), st = Math.sin(theta);
    const cf = Math.cos(TILT), sf = Math.sin(TILT);
    const scale = (Math.min(W, H) * 0.42) / d.radius;
    const cxC = W / 2, cyC = H / 2;
    const [cx0, cy0, cz0] = d.center;
    const sel = selHoleRef.current;

    ctx.globalCompositeOperation = "lighter";
    for (let e = 0; e < d.E; e++) {
      const X = d.mids[e * 3] - cx0;
      const Y = d.mids[e * 3 + 1] - cy0;
      const Z = d.mids[e * 3 + 2] - cz0;
      // spin about vertical (world z), then tilt about screen-horizontal axis
      const x1 = X * ct - Y * st;
      const y1 = X * st + Y * ct;
      const y2 = y1 * cf - Z * sf;
      const depth = y1 * sf + Z * cf;
      const px = cxC + x1 * scale;
      const py = cyC - y2 * scale;
      const dfac = 0.8 + 0.2 * (depth / d.radius + 1) * 0.5;

      // harmonic value: dominant hole among the selected set
      let hue = [90, 120, 150];
      let intensity = 0;
      if (d.H > 0) {
        let best = -1, bestAbs = 0;
        for (let h = 0; h < d.H; h++) {
          if (sel >= 0 && h !== sel) continue;
          const v = Math.abs(d.harmonics[h][e]);
          if (v > bestAbs) { bestAbs = v; best = h; }
        }
        if (best >= 0) {
          intensity = Math.min(1, bestAbs / d.gmax);
          hue = HOLE_HUE[best % HOLE_HUE.length];
        }
      }

      const base = Math.max(1.1, W / 300);
      const glowR = base * (1 + 2.4 * intensity) * dfac * reveal;
      const a = (0.10 + 0.85 * intensity) * reveal;
      const g = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      g.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${a})`);
      g.addColorStop(0.5, `rgba(${hue[0]},${hue[1]},${hue[2]},${a * 0.5})`);
      g.addColorStop(1, `rgba(${hue[0]},${hue[1]},${hue[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, glowR, 0, Math.PI * 2);
      ctx.fill();
      // crisp core
      ctx.fillStyle = `rgba(${Math.min(255, hue[0] + 60)},${Math.min(255, hue[1] + 40)},${Math.min(255, hue[2] + 20)},${(0.35 + 0.6 * intensity) * reveal})`;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.8, base * 0.5) * dfac, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }, [reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const dd = dpr();
      const cssW = canvas.clientWidth || 420;
      const w = Math.max(240, Math.min(900, Math.round(cssW * dd)));
      if (canvas.width !== w || canvas.height !== w) {
        canvas.width = w;
        canvas.height = w;
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

  // reveal fade-in on every new shape; reset hole selection
  useEffect(() => {
    if (!data) return;
    setSelHole(-1);
    revealStartRef.current = performance.now();
    revealRef.current = 0;
  }, [data]);

  // redraw immediately when the hole selection changes while static
  useEffect(() => {
    if ((reduced || !inView) && dataRef.current) draw(revealRef.current, performance.now());
  }, [selHole, reduced, inView, draw]);

  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      draw(1, 0);
      return;
    }
    const DUR = 900;
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

  const bettiLabels = [
    { k: "b₀", label: "components", color: EMERALD },
    { k: "b₁", label: "loops", color: CYAN_GLOW },
    { k: "b₂", label: "voids", color: VIOLET },
  ];

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Deep Kernel 10 · Betti numbers · Hodge H¹</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Count the <span className="text-cyan-400">holes</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr]">
        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={canvasRef}
            className="block aspect-square w-full max-w-full"
            role="img"
            aria-label="Edge midpoints of a 3D simplicial complex, projected and lit by their harmonic cochain value so each topological loop glows"
          />
          <span className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}>
            {data ? `${data.E} edges · H¹ dim ${data.H}` : "harmonic 1-cochains"}
          </span>
          {!ready && <BootOverlay />}
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={shape}
              className="grid grid-cols-3 gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
            >
              {bettiLabels.map((bl, i) => (
                <div key={bl.k} className="rounded-lg border px-2 py-2.5 text-center" style={{ borderColor: BORDER, background: SURFACE }}>
                  <div className="font-mono text-[10px]" style={{ color: MUTED }}>{bl.k}</div>
                  <div className="font-mono text-3xl font-black tabular-nums" style={{ color: bl.color, textShadow: `0 0 14px ${bl.color}66` }}>
                    {data ? data.betti[i] : "—"}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>{bl.label}</div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>

          {data && data.H > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>loop</span>
              <Pill onClick={() => setSelHole(-1)} active={selHole === -1} ariaLabel="Show all harmonic loops">
                All
              </Pill>
              {Array.from({ length: data.H }, (_, h) => (
                <Pill
                  key={h}
                  onClick={() => setSelHole(h)}
                  active={selHole === h}
                  color={`rgb(${HOLE_HUE[h % HOLE_HUE.length].join(",")})`}
                  ariaLabel={`Isolate harmonic loop ${h + 1}`}
                >
                  #{h + 1}
                </Pill>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>shape</span>
        {SHAPES.map((s, i) => (
          <Pill key={s} onClick={() => setShape(i)} active={shape === i} ariaLabel={`Select shape ${s}`} disabled={!ready}>
            {s}
          </Pill>
        ))}
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {SHAPES[shape].toLowerCase()} · b₁ ={" "}
        <span style={{ color: CYAN_GLOW }}>{data ? data.betti[1] : "—"}</span> independent loops ·{" "}
        {data ? data.H : "—"} harmonic generator{data && data.H === 1 ? "" : "s"}
        {data ? (
          <>
            {" "}<span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>{data.ms.toFixed(2)} ms in WASM</span>
          </>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Topology in a browser: FrankenSim triangulates each shape into a real simplicial complex and computes its exact{" "}
        <span className="text-slate-200">Betti numbers</span> — b₀ connected pieces, b₁ independent loops, b₂ enclosed voids —
        from the ranks of the boundary operators. Then it runs a <span style={{ color: VIOLET }}>discrete Hodge decomposition</span>{" "}
        to extract one <span className="text-cyan-300">harmonic 1-cochain</span> per loop: the smoothest circulation that
        wraps that tunnel and nothing else. Each glowing ring you see is a genuine generator of H¹. Switch shapes and watch b₁
        and the number of loops move in lockstep — the concrete face of the sheaf-cohomology tier.
      </div>
    </SyncContainer>
  );
}
