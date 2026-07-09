"use client";

/**
 * Deep Kernel 09 — ffd_deform(grid, controls, amp, mode)
 * "Sculpt the field."
 *
 * A shape point-cloud pushed through a Bernstein free-form-deformation control
 * lattice. The kernel returns each sample's original position and displacement,
 * the cage nodes, and — crucially — the minimum Jacobian determinant across the
 * map. When a twist or pinch drives that determinant negative the map folds the
 * material through itself; we flash the shape rose and raise a FOLDOVER warning.
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
  ROSE,
  MUTED,
  BRIGHT,
  dpr,
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Pill,
  Slider,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/frontier/_chrome";

const MODES = ["Shear", "Bulge", "Twist", "Pinch"];

interface FfdData {
  samples: Float64Array; // P * [ox,oy,dx,dy]
  P: number;
  gdim: number;
  cage: Float64Array; // C * [ox,oy,dx,dy]
  C: number;
  cdim: number;
  maxDisp: number;
  foldover: boolean;
  minDet: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  ms: number;
  seq: number;
}

export default function FfdDeform() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [grid, setGrid] = useState(14);
  const [controls, setControls] = useState(3);
  const [amp, setAmp] = useState(1);
  const [mode, setMode] = useState(1);
  const [data, setData] = useState<FfdData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<FfdData | null>(null);
  dataRef.current = data;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const morphStartRef = useRef<number | null>(null);
  const morphRef = useRef(1);
  const detLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("ffd_deform", grid, controls, amp, mode);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        let i = 0;
        const P = Math.round(raw[i++]);
        const samples = raw.subarray(i, i + P * 4).slice();
        i += P * 4;
        const C = Math.round(raw[i++]);
        const cage = raw.subarray(i, i + C * 4).slice();
        i += C * 4;
        const foldover = raw[i] > 0.5;
        const minDet = raw[i + 1];
        let maxDisp = 1e-9;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const scan = (arr: Float64Array, count: number) => {
          for (let j = 0; j < count; j++) {
            const ox = arr[j * 4], oy = arr[j * 4 + 1], dx = arr[j * 4 + 2], dy = arr[j * 4 + 3];
            maxDisp = Math.max(maxDisp, Math.hypot(dx, dy));
            const x = ox + dx, y = oy + dy;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        };
        scan(samples, P);
        scan(cage, C);
        dataRef.current = {
          samples, P, gdim: Math.round(Math.sqrt(P)),
          cage, C, cdim: Math.round(Math.sqrt(C)),
          maxDisp, foldover, minDet,
          bounds: { minX, maxX, minY, maxY }, ms, seq: token,
        };
        setData(dataRef.current);
        if (detLabelRef.current) detLabelRef.current.textContent = minDet.toFixed(3);
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, grid, controls, amp, mode, call]);

  const draw = useCallback((morph: number, time: number) => {
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

    const breathe = reduced ? 1 : 0.99 + 0.01 * Math.sin(time * 0.0018);
    const t = morph * breathe;
    const b = d.bounds;
    const spanX = Math.max(1e-6, b.maxX - b.minX);
    const spanY = Math.max(1e-6, b.maxY - b.minY);
    const pad = W * 0.12;
    const inner = W - 2 * pad;
    const scale = Math.min(inner / spanX, inner / spanY);
    const ox0 = pad + (inner - spanX * scale) / 2;
    const oy0 = pad + (inner - spanY * scale) / 2;
    const mx = (x: number) => ox0 + (x - b.minX) * scale;
    const my = (y: number) => oy0 + (b.maxY - y) * scale; // y up

    const sx = (i: number) => mx(d.samples[i * 4] + d.samples[i * 4 + 2] * t);
    const sy = (i: number) => my(d.samples[i * 4 + 1] + d.samples[i * 4 + 3] * t);

    const folded = d.foldover;
    const g = d.gdim;

    // filled quads (the shape body)
    for (let r = 0; r < g - 1; r++) {
      for (let c = 0; c < g - 1; c++) {
        const a = r * g + c, bb = r * g + c + 1, cc = (r + 1) * g + c + 1, dd = (r + 1) * g + c;
        const mag = Math.hypot(d.samples[a * 4 + 2], d.samples[a * 4 + 3]) / d.maxDisp;
        ctx.beginPath();
        ctx.moveTo(sx(a), sy(a));
        ctx.lineTo(sx(bb), sy(bb));
        ctx.lineTo(sx(cc), sy(cc));
        ctx.lineTo(sx(dd), sy(dd));
        ctx.closePath();
        ctx.fillStyle = folded
          ? `rgba(244,63,94,${0.06 + 0.16 * mag})`
          : `rgba(34,211,238,${0.05 + 0.14 * mag})`;
        ctx.fill();
      }
    }

    // mesh lines
    ctx.lineWidth = Math.max(0.6, W / 640);
    ctx.strokeStyle = folded ? "rgba(244,63,94,0.35)" : "rgba(34,211,238,0.28)";
    ctx.beginPath();
    for (let r = 0; r < g; r++) {
      for (let c = 0; c < g; c++) {
        const idx = r * g + c;
        if (c < g - 1) { ctx.moveTo(sx(idx), sy(idx)); ctx.lineTo(sx(idx + 1), sy(idx + 1)); }
        if (r < g - 1) { ctx.moveTo(sx(idx), sy(idx)); ctx.lineTo(sx(idx + g), sy(idx + g)); }
      }
    }
    ctx.stroke();

    // sample dots (glow by displacement)
    for (let i = 0; i < d.P; i++) {
      const mag = Math.hypot(d.samples[i * 4 + 2], d.samples[i * 4 + 3]) / d.maxDisp;
      const rad = Math.max(1, W / 300) * (0.6 + 0.9 * mag);
      const col = folded
        ? `rgba(251,113,133,${0.5 + 0.5 * mag})`
        : `rgba(${Math.round(34 + 134 * mag)},${Math.round(211 - 126 * mag)},${Math.round(238 + 9 * mag)},${0.5 + 0.5 * mag})`;
      ctx.beginPath();
      ctx.arc(sx(i), sy(i), rad, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.shadowColor = folded ? ROSE : CYAN_GLOW;
      ctx.shadowBlur = mag > 0.4 ? W / 120 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // FFD control cage
    const cx = (i: number) => mx(d.cage[i * 4] + d.cage[i * 4 + 2] * t);
    const cy = (i: number) => my(d.cage[i * 4 + 1] + d.cage[i * 4 + 3] * t);
    const cd = d.cdim;
    ctx.lineWidth = Math.max(1, W / 420);
    ctx.strokeStyle = "rgba(168,85,247,0.6)";
    ctx.beginPath();
    for (let r = 0; r < cd; r++) {
      for (let c = 0; c < cd; c++) {
        const idx = r * cd + c;
        if (c < cd - 1) { ctx.moveTo(cx(idx), cy(idx)); ctx.lineTo(cx(idx + 1), cy(idx + 1)); }
        if (r < cd - 1) { ctx.moveTo(cx(idx), cy(idx)); ctx.lineTo(cx(idx + cd), cy(idx + cd)); }
      }
    }
    ctx.stroke();
    for (let i = 0; i < d.C; i++) {
      const s = Math.max(3, W / 120);
      ctx.fillStyle = "#d8b4fe";
      ctx.shadowColor = VIOLET;
      ctx.shadowBlur = W / 130;
      ctx.fillRect(cx(i) - s / 2, cy(i) - s / 2, s, s);
      ctx.shadowBlur = 0;
    }
  }, [reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const d = dpr();
      const cssW = canvas.clientWidth || 420;
      const w = Math.max(240, Math.min(900, Math.round(cssW * d)));
      if (canvas.width !== w || canvas.height !== w) {
        canvas.width = w;
        canvas.height = w;
      }
      draw(morphRef.current, performance.now());
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

  // morph replays only on discrete mode change or first load
  const seenRef = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (!seenRef.current) {
      seenRef.current = true;
      morphStartRef.current = performance.now();
      morphRef.current = 0;
    }
  }, [data]);

  const pickMode = (m: number) => {
    if (m === mode) return;
    setMode(m);
    morphStartRef.current = performance.now();
    morphRef.current = 0;
  };

  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      morphRef.current = 1;
      morphStartRef.current = null;
      draw(1, 0);
      return;
    }
    const DUR = 720;
    const tick = (now: number) => {
      if (morphStartRef.current !== null) {
        const p = Math.min((now - morphStartRef.current) / DUR, 1);
        morphRef.current = 1 - Math.pow(1 - p, 3);
        if (p >= 1) morphStartRef.current = null;
      } else {
        morphRef.current = 1;
      }
      draw(morphRef.current, now);
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
          <Eyebrow>Deep Kernel 09 · Free-form deformation</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Sculpt the <span className="text-cyan-400">field</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full max-w-full"
          role="img"
          aria-label="A shape point cloud warped through a free-form-deformation control cage, glowing cyan, turning rose when the map folds over"
        />
        <AnimatePresence>
          {data?.foldover && !reduced && (
            <motion.div
              key="fold"
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="absolute inset-0"
                animate={{ opacity: [0.0, 0.22, 0.0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ background: `radial-gradient(circle at 50% 50%, ${ROSE}55, transparent 65%)` }}
              />
              <div
                className="absolute right-3 top-3 rounded-md border px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ borderColor: ROSE, background: "rgba(4,9,13,0.8)", color: "#fda4af", textShadow: `0 0 8px ${ROSE}` }}
              >
                ⚠ Foldover · J &lt; 0
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {data?.foldover && reduced && (
          <div className="absolute right-3 top-3 rounded-md border px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.2em]" style={{ borderColor: ROSE, background: "rgba(4,9,13,0.8)", color: "#fda4af" }}>
            ⚠ Foldover · J &lt; 0
          </div>
        )}
        {!ready && <BootOverlay />}
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>mode</span>
        {MODES.map((m, i) => (
          <Pill key={m} onClick={() => pickMode(i)} active={mode === i} ariaLabel={`Deformation mode ${m}`} disabled={!ready}>
            {m}
          </Pill>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        <Slider label="amp" value={amp} min={-1.5} max={1.5} step={0.05} onChange={setAmp} format={(v) => v.toFixed(2)} color={amp < 0 ? VIOLET : CYAN} disabled={!ready} />
        <Slider label="grid" value={grid} min={4} max={20} step={1} onChange={(v) => setGrid(Math.round(v))} format={(v) => `${Math.round(v)}²`} disabled={!ready} />
        <Slider label="cage" value={controls} min={2} max={5} step={1} onChange={(v) => setControls(Math.round(v))} format={(v) => `${Math.round(v)}²`} color={VIOLET} disabled={!ready} />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {MODES[mode].toLowerCase()} · amp {amp.toFixed(2)} · min det J ={" "}
        <span style={{ color: data && data.foldover ? ROSE : EMERALD }}><span ref={detLabelRef}>{data ? data.minDet.toFixed(3) : "—"}</span></span>
        {data ? (
          <>
            {" "}<span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>{data.ms.toFixed(2)} ms in WASM</span>
          </>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Free-form deformation embeds a shape in a <span className="text-slate-200">Bernstein-polynomial control lattice</span>
        {" "}(the violet cage) and drags its nodes; every material point moves as a smooth tensor-product Bézier blend of them.
        FrankenSim also tracks the <span style={{ color: VIOLET }}>Jacobian determinant</span> of that map everywhere. Push a{" "}
        <span className="text-cyan-300">twist</span> or <span className="text-cyan-300">pinch</span> far enough and the minimum
        determinant crosses zero — the deformation folds the material through itself, physically invalid, and the whole cloud
        flares <span style={{ color: ROSE }}>rose</span>. Real Bézier evaluation and real det-J monitoring, compiled to WASM.
      </div>
    </SyncContainer>
  );
}
