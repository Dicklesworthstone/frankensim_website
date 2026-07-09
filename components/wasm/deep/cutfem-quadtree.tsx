"use client";

/**
 * Deep Kernel 08 — cutfem_quadtree(base, target, radius)
 * "FEM on a boundary never meshed."
 *
 * An adaptive quadtree refined against a circle signed-distance field, plus the
 * exact cut-cell quadrature the kernel builds to integrate over a curved boundary
 * the mesh never conforms to: interface points carry outward unit normals; bulk
 * points carry integration weights. The tree blooms outward and the cut cells
 * light up hugging the circle. Domain is the unit square [0,1]².
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

const PAD = 0.06;
const MAX_NEEDLES = 640;

interface CutData {
  leaves: Float64Array; // L * [cx,cy,size,class]
  L: number;
  inside: number;
  cut: number;
  outside: number;
  iface: Float64Array; // Qi * [x,y,nx,ny]
  Qi: number;
  needleIdx: number[];
  bulk: Float64Array; // Qb * [x,y,w]
  Qb: number;
  maxW: number;
  radius: number;
  ms: number;
  seq: number;
}

export default function CutfemQuadtree() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [base, setBase] = useState(3);
  const [target, setTarget] = useState(5);
  const [radius, setRadius] = useState(0.3);
  const [data, setData] = useState<CutData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseKeyRef = useRef("");
  const dataRef = useRef<CutData | null>(null);
  dataRef.current = data;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const msLabelRef = useRef<HTMLSpanElement>(null);

  if (baseCanvasRef.current === null && typeof document !== "undefined") {
    baseCanvasRef.current = document.createElement("canvas");
  }

  /* -- debounced compute (target/radius are heavy) -- */
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const token = ++tokenRef.current;
      setComputing(true);
      setError(null);
      (async () => {
        try {
          const t0 = performance.now();
          const raw = await call<Float64Array>("cutfem_quadtree", base, Math.max(base, target), radius);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          let i = 0;
          const L = Math.round(raw[i++]);
          const leaves = raw.subarray(i, i + L * 4).slice();
          i += L * 4;
          let inside = 0, cut = 0, outside = 0;
          for (let j = 0; j < L; j++) {
            const cls = leaves[j * 4 + 3];
            if (cls === 1) inside++;
            else if (cls === 2) cut++;
            else outside++;
          }
          const Qi = Math.round(raw[i++]);
          const iface = raw.subarray(i, i + Qi * 4).slice();
          i += Qi * 4;
          const Qb = Math.round(raw[i++]);
          const bulk = raw.subarray(i, i + Qb * 3).slice();
          i += Qb * 3;
          let maxW = 1e-12;
          for (let j = 0; j < Qb; j++) maxW = Math.max(maxW, bulk[j * 3 + 2]);
          const step = Math.max(1, Math.ceil(Qi / MAX_NEEDLES));
          const needleIdx: number[] = [];
          for (let j = 0; j < Qi; j += step) needleIdx.push(j);
          dataRef.current = { leaves, L, inside, cut, outside, iface, Qi, needleIdx, bulk, Qb, maxW, radius, ms, seq: token };
          setData(dataRef.current);
          if (msLabelRef.current) msLabelRef.current.textContent = ms.toFixed(1);
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 170);
    return () => clearTimeout(id);
  }, [ready, base, target, radius, call]);

  /* -- render the static scene (leaves + bulk + circle) to the offscreen buffer -- */
  const renderBase = useCallback(() => {
    const canvas = canvasRef.current;
    const buf = baseCanvasRef.current;
    const d = dataRef.current;
    if (!canvas || !buf || !d) return;
    const W = canvas.width;
    const H = canvas.height;
    if (buf.width !== W || buf.height !== H) {
      buf.width = W;
      buf.height = H;
    }
    const ctx = buf.getContext("2d");
    if (!ctx) return;
    const inner = W - 2 * PAD * W;
    const o = PAD * W;
    const mx = (x: number) => o + x * inner;
    const my = (y: number) => o + (1 - y) * inner;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // leaves
    ctx.lineWidth = Math.max(0.5, W / 900);
    for (let j = 0; j < d.L; j++) {
      const cx = d.leaves[j * 4];
      const cy = d.leaves[j * 4 + 1];
      const s = d.leaves[j * 4 + 2];
      const cls = d.leaves[j * 4 + 3];
      const px = mx(cx - s / 2);
      const py = my(cy + s / 2);
      const pw = s * inner;
      if (cls === 0) {
        ctx.strokeStyle = "rgba(120,140,160,0.07)";
        ctx.strokeRect(px, py, pw, pw);
      } else if (cls === 1) {
        ctx.fillStyle = "rgba(20,120,150,0.10)";
        ctx.fillRect(px, py, pw, pw);
        ctx.strokeStyle = "rgba(34,211,238,0.10)";
        ctx.strokeRect(px, py, pw, pw);
      } else {
        ctx.fillStyle = "rgba(34,211,238,0.14)";
        ctx.fillRect(px, py, pw, pw);
        ctx.strokeStyle = "rgba(34,211,238,0.55)";
        ctx.strokeRect(px, py, pw, pw);
      }
    }

    // bulk quadrature points (sized by weight)
    for (let j = 0; j < d.Qb; j++) {
      const x = mx(d.bulk[j * 3]);
      const y = my(d.bulk[j * 3 + 1]);
      const wq = Math.pow(d.bulk[j * 3 + 2] / d.maxW, 0.32);
      const sz = Math.max(0.6, wq * (W / 320));
      ctx.fillStyle = `rgba(16,185,129,${0.14 + 0.5 * wq})`;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }

    // circle SDF boundary
    ctx.beginPath();
    ctx.arc(mx(0.5), my(0.5), d.radius * inner, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(190,245,255,0.85)";
    ctx.lineWidth = Math.max(1.4, W / 340);
    ctx.shadowColor = CYAN_GLOW;
    ctx.shadowBlur = W / 120;
    ctx.stroke();
    ctx.shadowBlur = 0;

    baseKeyRef.current = `${d.seq}-${W}`;
  }, []);

  /* -- composite: bloom-reveal the base, then animate interface needles -- */
  const draw = useCallback((reveal: number, time: number) => {
    const canvas = canvasRef.current;
    const buf = baseCanvasRef.current;
    const d = dataRef.current;
    if (!canvas || !buf || !d) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    if (baseKeyRef.current !== `${d.seq}-${W}`) renderBase();

    const inner = W - 2 * PAD * W;
    const o = PAD * W;
    const mx = (x: number) => o + x * inner;
    const my = (y: number) => o + (1 - y) * inner;
    const ccx = mx(0.5);
    const ccy = my(0.5);
    const maxDist = Math.hypot(Math.max(ccx, W - ccx), Math.max(ccy, H - ccy));
    const bloomR = reveal * maxDist * 1.02;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (reveal < 1) {
      ctx.beginPath();
      ctx.arc(ccx, ccy, bloomR, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(buf, 0, 0);
    ctx.restore();

    // leading bloom ring
    if (reveal < 1 && reveal > 0.02) {
      ctx.beginPath();
      ctx.arc(ccx, ccy, bloomR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(190,245,255,0.5)";
      ctx.lineWidth = Math.max(1.5, W / 300);
      ctx.shadowColor = CYAN_GLOW;
      ctx.shadowBlur = W / 60;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // interface points + outward-normal needles (sweep-highlighted)
    const sweep = reduced ? 0 : time * 0.0006;
    const nlen = W * 0.022;
    ctx.lineWidth = Math.max(1, W / 520);
    for (const j of d.needleIdx) {
      const x = mx(d.iface[j * 4]);
      const y = my(d.iface[j * 4 + 1]);
      const dist = Math.hypot(x - ccx, y - ccy);
      if (dist > bloomR) continue;
      const nx = d.iface[j * 4 + 2];
      const ny = -d.iface[j * 4 + 3]; // flip y for screen
      const ang = Math.atan2(y - ccy, x - ccx);
      const near = reduced ? 0.5 : Math.max(0, Math.cos(ang - sweep));
      const bright = 0.4 + 0.6 * near * near;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + nx * nlen, y + ny * nlen);
      ctx.strokeStyle = `rgba(34,211,238,${bright})`;
      ctx.shadowColor = CYAN_GLOW;
      ctx.shadowBlur = near > 0.6 ? W / 90 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, W / 360), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,245,255,${0.5 + 0.5 * bright})`;
      ctx.fill();
    }
  }, [reduced, renderBase]);

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
        baseKeyRef.current = "";
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
    baseKeyRef.current = ""; // force base re-render for new tree
    if (!seenRef.current) {
      seenRef.current = true;
    }
    // every fresh tree blooms in
    revealStartRef.current = performance.now();
    revealRef.current = 0;
  }, [data]);

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

  const onBase = (v: number) => {
    const b = Math.round(v);
    setBase(b);
    if (target < b) setTarget(b);
  };

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Deep Kernel 08 · Cut-cell FEM · quadtree</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            FEM on a boundary <span className="text-cyan-400">never meshed</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          role="img"
          aria-label="An adaptive quadtree refined to a circle boundary, with cut cells glowing and cut-cell quadrature points shown as cyan needles"
        />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}>
            Quadtree · circle SDF
          </span>
          {data && (
            <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm font-mono" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
              <div className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>leaves</div>
              <div className="text-[13px] font-black tabular-nums" style={{ color: BRIGHT }}>{data.L.toLocaleString()}</div>
              <div className="mt-0.5 flex gap-2 text-[8px] tabular-nums">
                <span style={{ color: CYAN_GLOW }}>cut {data.cut}</span>
                <span style={{ color: EMERALD }}>in {data.inside}</span>
              </div>
            </div>
          )}
        </div>
        {!ready && <BootOverlay />}
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="base" value={base} min={2} max={4} step={1} onChange={onBase} format={(v) => String(Math.round(v))} disabled={!ready} />
        <Slider label="depth" value={target} min={base} max={7} step={1} onChange={(v) => setTarget(Math.round(v))} format={(v) => String(Math.round(v))} color={EMERALD} disabled={!ready} />
        <Slider label="radius" value={radius} min={0.15} max={0.45} step={0.01} onChange={setRadius} format={(v) => v.toFixed(2)} color={VIOLET} disabled={!ready} />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {data ? (
          <>
            <span style={{ color: EMERALD }}>{data.cut} cut cells</span> · {data.Qi.toLocaleString()} interface pts · {data.Qb.toLocaleString()} bulk pts{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}><span ref={msLabelRef}>{data.ms.toFixed(1)}</span> ms in WASM</span>
          </>
        ) : (
          <>adaptive refinement to depth {target} · unit square domain</>
        )}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Classic FEM demands a mesh that conforms to your geometry. <span className="text-slate-200">CutFEM</span> refuses:
        it lays a plain quadtree over the domain, lets the circle&apos;s signed-distance field slice straight through cells,
        and builds <span style={{ color: VIOLET }}>exact cut-cell quadrature</span> to integrate anyway — interface points
        with genuine outward normals (the cyan needles), bulk points carrying weights. The tree{" "}
        <span className="text-cyan-300">blooms to hug the curve</span> it never meshed. Every leaf classification, normal
        and weight is computed by compiled Rust in your browser.
      </div>
    </SyncContainer>
  );
}
