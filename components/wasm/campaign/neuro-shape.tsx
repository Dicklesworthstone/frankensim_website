"use client";

/**
 * Campaign 07 · neuroshape(lift, ring_r, inner) · fs-neuroshape-e2e
 * "A neural shape, its topology proven, not sampled."
 *
 * A tiny neural network defines a signed-distance field over the square [-3,3]²; its
 * zero-level-set is a rounded blob. The headline is a TOPOLOGY CERTIFICATE built by
 * interval bound propagation (IBP): the network's sound interval enclosure proves that
 * a central box is strictly INSIDE (interval hi < 0) while the FOUR boundary strips of a
 * bounding box are each strictly OUTSIDE (interval lo > 0). Those strips tile the box
 * boundary into a CLOSED frame whose corners overlap, so {f<0} provably cannot cross it:
 * the interior is proven NON-EMPTY and BOUNDED. A closed barrier is a strictly stronger
 * certificate than spot-checking discrete ring boxes, which would leave angular gaps and
 * prove nothing about boundedness. A certified Lipschitz bound L underwrites safe
 * sphere-tracing; a Morse check confirms exactly one interior minimum.
 *
 * We render the SDF as a glowing implicit surface (emerald interior, faded cool exterior)
 * with a crisp marching-squares zero contour as the shape boundary, and overlay the central
 * certified-inside box together with the closed four-strip frame: the geometric heart of the
 * proof. Push the `lift` slider past ~8.23 and the interior empties: the shape vanishes, the
 * central box's interval crosses 0, and the certificate honestly flips Verified to Estimated.
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

type RGB = [number, number, number];
interface Seg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const PAD = 0.045; // window inset so the boundary frame near the edge stays visible
const STRIP_W = 0.4; // boundary-strip width — fixed in the kernel (fs-neuroshape-e2e)

/* diverging SDF ramps, centered at 0 */
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

/* marching squares at the zero level (world coords) */
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

interface NeuroData {
  n: number;
  winLo: number;
  winHi: number;
  L: number;
  origin: number;
  safeR: number;
  nearest: number;
  maxCross: number;
  insideLo: number;
  insideHi: number;
  certInside: boolean;
  boundaryCertified: number;
  boundarySegments: number;
  bounded: boolean;
  singleMin: boolean;
  crossings: number;
  topo: boolean;
  components: number;
  ringR: number;
  inner: number;
  field: Float64Array;
  insideScale: number;
  outsideScale: number;
  segs: Seg[];
  lift: number;
  ms: number;
  seq: number;
}

function decode(raw: Float64Array, lift: number, ms: number, seq: number): NeuroData {
  const n = raw[0] | 0;
  const winLo = raw[1];
  const winHi = raw[2];
  const field = raw.subarray(24, 24 + n * n);
  let mn = Infinity;
  const pos: number[] = [];
  for (let k = 0; k < field.length; k++) {
    const v = field[k];
    if (v < mn) mn = v;
    if (v > 0) pos.push(v);
  }
  pos.sort((a, b) => a - b);
  const insideScale = Math.max(1e-3, -mn);
  const outsideScale = pos.length ? Math.max(0.4, pos[Math.floor(0.82 * (pos.length - 1))]) : 1;
  return {
    n,
    winLo,
    winHi,
    L: raw[3],
    origin: raw[4],
    safeR: raw[5],
    nearest: raw[6],
    maxCross: raw[7],
    insideLo: raw[8],
    insideHi: raw[9],
    certInside: raw[10] > 0.5,
    boundaryCertified: Math.round(raw[11]), // strips certified strictly outside (of 4)
    boundarySegments: Math.round(raw[12]), // total boundary strips forming the closed frame
    bounded: raw[13] > 0.5,
    singleMin: raw[14] > 0.5,
    crossings: Math.round(raw[15]),
    topo: raw[16] > 0.5,
    components: Math.round(raw[17]),
    ringR: raw[18],
    inner: raw[19],
    field,
    insideScale,
    outsideScale,
    segs: contour(field, n, winLo, winHi),
    lift,
    ms,
    seq,
  };
}

export default function NeuroShape() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [lift, setLift] = useState(6.5);
  const [ringR, setRingR] = useState(2.5);
  const [inner, setInner] = useState(0.3);
  const [data, setData] = useState<NeuroData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldBufRef = useRef<HTMLCanvasElement | null>(null);
  const fieldImgRef = useRef<ImageData | null>(null);
  const bufKeyRef = useRef("");
  const dataRef = useRef<NeuroData | null>(null);
  dataRef.current = data;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  const topo = !!data && data.certInside && data.topo && data.components === 1;
  const originRef = useEasedText<HTMLSpanElement>(data?.origin ?? 0, reduced, (v) => v.toFixed(3), {
    enabled: !!data,
    inViewRef,
  });
  const hiRef = useEasedText<HTMLSpanElement>(data?.insideHi ?? 0, reduced, (v) => v.toFixed(3), {
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

  /* -- compute (latest-wins; kernel is ~1 ms) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("neuroshape", lift, ringR, inner);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        setData(decode(raw, lift, ms, token));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, lift, ringR, inner, call]);

  /* -- render the SDF field to the 64² offscreen buffer -- */
  const renderField = useCallback(() => {
    const buf = fieldBufRef.current;
    const img = fieldImgRef.current;
    const d = dataRef.current;
    if (!buf || !img || !d) return;
    const ctx = buf.getContext("2d");
    if (!ctx) return;
    const n = d.n;
    const px = img.data;
    for (let r = 0; r < n; r++) {
      const j = n - 1 - r; // flip: high y at top
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
    ctx.putImageData(img, 0, 0);
    bufKeyRef.current = `${d.seq}`;
  }, []);

  /* -- composite: field + bloom + zero contour + certificate boxes -- */
  const draw = useCallback((reveal: number, time: number) => {
    const canvas = canvasRef.current;
    const buf = fieldBufRef.current;
    const d = dataRef.current;
    if (!canvas || !buf) return;
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
    if (!d) return;
    if (bufKeyRef.current !== `${d.seq}`) renderField();

    const inset = PAD * W;
    const span = W - 2 * inset;
    const range = d.winHi - d.winLo;
    const mx = (x: number) => inset + ((x - d.winLo) / range) * span;
    const my = (y: number) => inset + (1 - (y - d.winLo) / range) * (H - 2 * PAD * H);

    // scaled field
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = reveal;
    ctx.drawImage(buf, 0, 0, d.n, d.n, inset, PAD * H, span, H - 2 * PAD * H);

    // interior bloom
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.62 * reveal;
    ctx.filter = `blur(${Math.max(4, Math.round(W / 46))}px)`;
    ctx.drawImage(buf, 0, 0, d.n, d.n, inset, PAD * H, span, H - 2 * PAD * H);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // zero contour — the shape boundary
    if (reveal > 0.02 && d.segs.length) {
      ctx.beginPath();
      for (const s of d.segs) {
        ctx.moveTo(mx(s.x0), my(s.y0));
        ctx.lineTo(mx(s.x1), my(s.y1));
      }
      // soft emerald halo underneath
      ctx.strokeStyle = "rgba(52,211,153,0.32)";
      ctx.lineWidth = Math.max(2.4, W / 150);
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = W / 64;
      ctx.stroke();
      // crisp bright core on top
      ctx.strokeStyle = "rgba(210,255,232,0.98)";
      ctx.lineWidth = Math.max(1.2, W / 330);
      ctx.shadowBlur = 0;
      ctx.stroke();
    }

    // certificate geometry (the geometric heart of the proof)
    const pulse = reducedRef.current ? 1 : 0.72 + 0.28 * Math.sin(time * 0.004);
    const box = (cx: number, cy: number, half: number, col: string, glow: number) => {
      const x0 = mx(cx - half);
      const y0 = my(cy + half);
      const w = (2 * half * span) / range;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1.1, W / 360);
      ctx.lineJoin = "round";
      ctx.shadowColor = col;
      ctx.shadowBlur = glow;
      ctx.strokeRect(x0, y0, w, w);
      ctx.shadowBlur = 0;
    };
    // a world-coords axis-aligned rect -> canvas [px, py, w, h] (py at top)
    const worldRect = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => {
      const px = mx(x0);
      const py = my(y1); // larger y maps to the smaller pixel (top)
      return [px, py, mx(x1) - px, my(y0) - py];
    };

    if (reveal > 0.35) {
      // The closed boundary frame — the four edge strips of the box [-r, r]² each
      // certified strictly OUTSIDE (interval lo > 0). Tiled together (corners
      // overlap) they wall off the interior, so {f<0} provably cannot escape:
      // a proof of boundedness, not eight spot checks.
      const r = Math.max(0.1, d.ringR);
      const inr = Math.max(0.05, r - STRIP_W); // inner edge of the frame band
      const walled = d.bounded; // every strip certified -> closed barrier
      const frameCol = walled ? CYAN : AMBER;
      const frameFill = walled ? "rgba(34,211,238,0.09)" : "rgba(251,191,36,0.08)";
      const frameStroke = walled ? `rgba(34,211,238,${0.5 + 0.38 * pulse})` : `rgba(251,191,36,${0.6 + 0.3 * pulse})`;

      const [ox, oy, ow, oh] = worldRect(-r, -r, r, r);
      const [ix, iy, iw, ih] = worldRect(-inr, -inr, inr, inr);

      // fill the frame band (outer box minus inner box) as one closed region
      ctx.fillStyle = frameFill;
      ctx.beginPath();
      ctx.rect(ox, oy, ow, oh);
      ctx.rect(ix, iy, iw, ih);
      ctx.fill("evenodd");

      // glow walls: the outer and inner edges of the closed barrier
      ctx.strokeStyle = frameStroke;
      ctx.lineWidth = Math.max(1.1, W / 300);
      ctx.lineJoin = "round";
      ctx.shadowColor = frameCol;
      ctx.shadowBlur = (W / 110) * pulse;
      ctx.strokeRect(ox, oy, ow, oh);
      ctx.strokeRect(ix, iy, iw, ih);
      ctx.shadowBlur = 0;

      // central box — strictly INSIDE (interval hi < 0) when certified
      const inCol = topo ? EMERALD : d.insideHi > 0 ? ROSE : AMBER;
      const inRgba = topo ? `rgba(16,185,129,${0.6 + 0.35 * pulse})` : inCol === ROSE ? `rgba(244,63,94,${0.7 + 0.25 * pulse})` : `rgba(251,191,36,${0.7 + 0.25 * pulse})`;
      ctx.fillStyle = topo ? "rgba(16,185,129,0.1)" : "rgba(251,191,36,0.08)";
      const cx0 = mx(-d.inner);
      const cy0 = my(d.inner);
      const cw = (2 * d.inner * span) / range;
      ctx.fillRect(cx0, cy0, cw, cw);
      box(0, 0, d.inner, inRgba, (W / 70) * pulse);
    }

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.max(0, W * 0.28), W / 2, H / 2, Math.max(0.1, W * 0.74));
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }, [renderField, topo]);

  /* -- DPR sizing -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const d = dpr();
      const cssW = canvas.clientWidth || 480;
      const w = Math.max(240, Math.min(900, Math.round(cssW * d)));
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

  /* -- reveal on first data; snap after -- */
  useEffect(() => {
    if (!data) return;
    bufKeyRef.current = "";
    if (!seenRef.current) {
      seenRef.current = true;
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    } else {
      revealRef.current = 1;
      draw(1, performance.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const DUR = 1100;
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
      draw(revealRef.current, now);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [data, inView, reduced, inViewRef, draw]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 07 · fs-neuroshape-e2e · IBP × Lipschitz</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            A neural shape whose topology is <span className="text-emerald-300">proven</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          style={{ filter: "saturate(1.1) contrast(1.04)" }}
          role="img"
          aria-label="A neural signed-distance field rendered as a glowing emerald blob with its zero-contour boundary, a central certified-inside box, and a closed four-strip frame certified strictly outside that walls off the interior"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

        {!ready && <BootOverlay />}

        {/* instrument HUD */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}
          >
            REAL fs-neuro · IBP enclosure
          </span>
          {data && (
            <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm font-mono" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  Lipschitz L
                </span>
                <span className="text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${EMERALD}55` }}>
                  {data.L.toFixed(1)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                  f(0)
                </span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: data.origin < 0 ? EMERALD : AMBER }}>
                  <span ref={originRef}>{data.origin.toFixed(3)}</span>
                </span>
              </div>
              <div className="mt-0.5 text-[8px] tabular-nums" style={{ color: MUTED }}>
                solved in {data.ms.toFixed(1)} ms
              </div>
            </div>
          )}
        </div>

        {/* topology seal */}
        {data && (
          <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
            <div
              className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.15em] backdrop-blur-sm"
              style={{
                borderColor: topo ? `${EMERALD}88` : `${AMBER}88`,
                background: topo ? `${EMERALD}14` : `${AMBER}14`,
                color: topo ? EMERALD : AMBER,
                textShadow: topo ? `0 0 10px ${EMERALD}` : "none",
              }}
            >
              {topo ? "Topology · Verified" : "Interior empty · Estimated"}
            </div>
            <div className="rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm font-mono" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
              <div className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
                components
              </div>
              <div className="text-[12px] font-black tabular-nums" style={{ color: topo ? EMERALD : MUTED }}>
                {data.components} · {data.singleMin ? "1 min" : "no min"}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* certificate chips: the interval proof */}
      {data && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: topo ? `${EMERALD}66` : `${AMBER}55`, background: topo ? `${EMERALD}12` : "rgba(255,255,255,0.02)" }}>
            <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
              central box · inside
            </div>
            <div className="font-mono text-[13px] font-black tabular-nums" style={{ color: topo ? EMERALD : data.insideHi > 0 ? ROSE : AMBER }}>
              [{data.insideLo.toFixed(2)}, <span ref={hiRef}>{data.insideHi.toFixed(2)}</span>]
            </div>
            <div className="font-mono text-[8px] tracking-wide" style={{ color: MUTED }}>
              {data.insideHi < 0 ? "hi < 0 ⇒ strictly inside" : "hi ≥ 0 ⇒ box escapes"}
            </div>
          </div>
          <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d` }}>
            <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
              boundary strips · outside
            </div>
            <div className="font-mono text-[13px] font-black tabular-nums" style={{ color: data.bounded ? CYAN_GLOW : AMBER }}>
              {data.boundaryCertified}/{data.boundarySegments} · lo &gt; 0
            </div>
            <div className="font-mono text-[8px] tracking-wide" style={{ color: MUTED }}>
              {data.bounded ? "closed frame · barrier proven" : "frame open · barrier unproven"}
            </div>
          </div>
          <div className="col-span-2 rounded-lg border px-2.5 py-2 sm:col-span-1" style={{ borderColor: `${EMERALD}44`, background: "rgba(255,255,255,0.02)" }}>
            <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
              safe sphere-trace r
            </div>
            <div className="font-mono text-[13px] font-black tabular-nums" style={{ color: EMERALD }}>
              {data.safeR.toFixed(3)}
            </div>
            <div className="font-mono text-[8px] tracking-wide" style={{ color: MUTED }}>
              {data.crossings} surface crossings · {data.bounded ? "bounded" : "unbounded"}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="lift" value={lift} min={5.5} max={9.5} step={0.01} onChange={setLift} format={(v) => v.toFixed(2)} color={EMERALD} disabled={!ready} />
        <Slider label="frame r" value={ringR} min={1.5} max={3.5} step={0.02} onChange={setRingR} format={(v) => v.toFixed(2)} disabled={!ready} />
        <Slider label="box r" value={inner} min={0.15} max={0.6} step={0.01} onChange={setInner} format={(v) => v.toFixed(2)} color={CYAN} disabled={!ready} />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {data ? (
          <>
            {topo ? (
              <span style={{ color: EMERALD }}>single bounded component · closed frame proven by interval enclosure</span>
            ) : (
              <span style={{ color: AMBER }}>interior empties · central box interval crosses 0 → Estimated</span>
            )}{" "}
            <span style={{ color: MUTED }}>│</span> L={data.L.toFixed(0)} · {data.boundaryCertified}/{data.boundarySegments} strips{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(1)} ms in WASM</span>
          </>
        ) : (
          "propagating the network's sound interval enclosure over the certificate boxes…"
        )}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A tiny neural network <span className="text-slate-200">is</span> the geometry: its output is a{" "}
        <span style={{ color: EMERALD }}>signed-distance field</span> whose zero-contour is this rounded blob. The headline is
        not the picture but the <span className="text-slate-200">topology certificate</span>. By propagating the network&apos;s{" "}
        <span style={{ color: CYAN_GLOW }}>sound interval enclosure</span> (IBP), the kernel proves a central box is strictly{" "}
        <span style={{ color: EMERALD }}>inside</span> (interval hi &lt; 0), then proves each of the{" "}
        <span style={{ color: CYAN_GLOW }}>four boundary strips</span> of a bounding box is strictly{" "}
        <span style={{ color: CYAN_GLOW }}>outside</span> (lo &gt; 0). Those strips tile the box edge into a{" "}
        <span className="text-slate-200">closed frame</span> the interior cannot cross, so the shape is provably a{" "}
        <span className="text-slate-200">single bounded connected component</span>. A closed wall is a proof of boundedness, not
        eight spot checks. A certified Lipschitz bound underwrites safe sphere-tracing; a Morse check confirms one interior
        minimum. Raise <span style={{ color: EMERALD }}>lift</span> past ~8.23 and the interior empties: the shape vanishes and
        the proof honestly downgrades <span style={{ color: EMERALD }}>Verified</span> to{" "}
        <span style={{ color: AMBER }}>Estimated</span>. Every strip, bound and normal is compiled Rust, live in your tab.
      </div>
    </SyncContainer>
  );
}
