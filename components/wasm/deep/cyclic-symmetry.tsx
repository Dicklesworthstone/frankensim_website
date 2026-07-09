"use client";

/**
 * Deep Kernel 06 — cyclic_symmetry(n, stiffness)
 * "Solve one wedge, get the whole wheel."
 *
 * An N-fold symmetric structure whose stiffness operator is a circulant matrix.
 * The kernel block-diagonalises that circulant with the DFT: instead of solving
 * one big n×n system it solves n independent 1×1 harmonic blocks and reassembles
 * the ring displacement. We draw the glowing ring (each sector displaced by its
 * solution value) next to the per-harmonic DFT spectrum that produced it.
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
  Pill,
  Slider,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/frontier/_chrome";

interface RingData {
  n: number;
  sol: Float64Array;
  harm: Float64Array;
  solNorm: number;
  harmNorm: number;
  loadIdx: number;
  dominant: number;
  ms: number;
  seq: number;
}

/* Linear cyan→violet ramp keyed by harmonic index k. */
function harmColor(t: number): string {
  const a = [34, 211, 238];
  const b = [168, 85, 247];
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const c = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${c})`;
}

export default function CyclicSymmetry() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [n, setN] = useState(16);
  const [stiffness, setStiffness] = useState(1);
  const [data, setData] = useState<RingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const ringRef = useRef<HTMLCanvasElement>(null);
  const specRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<RingData | null>(null);
  dataRef.current = data;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const msLabelRef = useRef<HTMLSpanElement>(null);

  /* -- compute (latest-wins) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("cyclic_symmetry", n, stiffness);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const nn = Math.round(raw[0]);
        const rhs = raw.subarray(1 + nn, 1 + 2 * nn);
        const sol = raw.subarray(1 + 2 * nn, 1 + 3 * nn).slice();
        const harm = raw.subarray(1 + 3 * nn, 1 + 4 * nn).slice();
        let solNorm = 1e-12;
        let loadIdx = 0;
        let loadMax = -Infinity;
        for (let i = 0; i < nn; i++) {
          solNorm = Math.max(solNorm, Math.abs(sol[i]));
          if (Math.abs(rhs[i]) > loadMax) {
            loadMax = Math.abs(rhs[i]);
            loadIdx = i;
          }
        }
        let harmNorm = 1e-12;
        let dominant = 0;
        let hMax = -Infinity;
        for (let k = 0; k < nn; k++) {
          harmNorm = Math.max(harmNorm, harm[k]);
          if (harm[k] > hMax) {
            hMax = harm[k];
            dominant = k;
          }
        }
        dataRef.current = { n: nn, sol, harm, solNorm, harmNorm, loadIdx, dominant, ms, seq: token };
        setData(dataRef.current);
        if (msLabelRef.current) msLabelRef.current.textContent = ms.toFixed(2);
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, n, stiffness, call]);

  /* -- draw ring -- */
  const drawRing = useCallback((reveal: number, time: number) => {
    const canvas = ringRef.current;
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

    const cx = W / 2;
    const cy = H / 2;
    const R0 = Math.min(W, H) * 0.31;
    const petalMax = Math.min(W, H) * 0.16;
    const rIn = R0 * 0.82;

    // faint reference ring
    ctx.beginPath();
    ctx.arc(cx, cy, R0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(148,163,184,0.18)";
    ctx.lineWidth = Math.max(1, W / 600);
    ctx.stroke();

    const half = (Math.PI / d.n) * 0.8;
    ctx.lineCap = "round";
    for (let i = 0; i < d.n; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / d.n;
      const raw = d.sol[i] / d.solNorm; // typically 0..1, keep sign-safe
      const mag = Math.min(1, Math.abs(raw));
      const shimmer = reduced ? 1 : 0.86 + 0.14 * Math.sin(time * 0.0024 + i * 0.7);
      const outer = rIn + petalMax + petalMax * 1.7 * mag * reveal;
      const hue = raw < 0 ? VIOLET : CYAN_GLOW;

      // wedge
      ctx.beginPath();
      ctx.arc(cx, cy, rIn, a - half, a + half);
      ctx.arc(cx, cy, outer, a + half, a - half, true);
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, rIn, cx, cy, outer);
      grad.addColorStop(0, `rgba(8,60,80,${0.35 + 0.2 * mag})`);
      grad.addColorStop(1, raw < 0 ? `rgba(168,85,247,${0.35 + 0.6 * mag * shimmer})` : `rgba(34,211,238,${0.35 + 0.6 * mag * shimmer})`);
      ctx.fillStyle = grad;
      ctx.shadowColor = hue;
      ctx.shadowBlur = (6 + 22 * mag) * shimmer;
      ctx.fill();
      ctx.shadowBlur = 0;

      // bright cap arc
      ctx.beginPath();
      ctx.arc(cx, cy, outer, a - half, a + half);
      ctx.strokeStyle = raw < 0 ? "rgba(224,170,255,0.95)" : "rgba(190,245,255,0.95)";
      ctx.lineWidth = Math.max(1.4, W / 260);
      ctx.globalAlpha = 0.5 + 0.5 * mag;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // node dot on reference ring
      ctx.beginPath();
      ctx.arc(cx + R0 * Math.cos(a), cy + R0 * Math.sin(a), Math.max(1.2, W / 320), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(148,163,184,0.6)";
      ctx.fill();
    }

    // load marker (the impulse sector)
    const la = -Math.PI / 2 + (2 * Math.PI * d.loadIdx) / d.n;
    ctx.beginPath();
    ctx.arc(cx + rIn * 0.7 * Math.cos(la), cy + rIn * 0.7 * Math.sin(la), Math.max(3, W / 120), 0, Math.PI * 2);
    ctx.fillStyle = AMBER;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, rIn * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(4,9,13,0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(34,211,238,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [reduced]);

  /* -- draw spectrum -- */
  const drawSpec = useCallback((reveal: number, time: number) => {
    const canvas = specRef.current;
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

    const padL = W * 0.06;
    const padR = W * 0.04;
    const padT = H * 0.12;
    const y0 = H * 0.84;
    const plotW = W - padL - padR;
    const plotH = y0 - padT;
    const bw = plotW / d.n;

    // baseline
    ctx.beginPath();
    ctx.moveTo(padL, y0);
    ctx.lineTo(W - padR, y0);
    ctx.strokeStyle = "rgba(148,163,184,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    for (let k = 0; k < d.n; k++) {
      const h = d.harm[k] / d.harmNorm;
      const shimmer = reduced ? 1 : 0.9 + 0.1 * Math.sin(time * 0.003 + k);
      const bh = h * plotH * reveal * shimmer;
      const x = padL + k * bw + bw * 0.14;
      const w = bw * 0.72;
      const col = harmColor(d.n > 1 ? k / (d.n - 1) : 0);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = k === d.dominant ? 16 : 6;
      ctx.globalAlpha = k === d.dominant ? 1 : 0.82;
      ctx.fillRect(x, y0 - bh, w, bh);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      // bright cap
      ctx.fillStyle = "rgba(230,245,255,0.9)";
      ctx.fillRect(x, y0 - bh - 1.5, w, 1.5);
    }

    // ticks
    ctx.fillStyle = MUTED;
    ctx.font = `${Math.max(8, W / 46)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    const ticks = [0, Math.floor(d.n / 2), d.n - 1];
    for (const k of ticks) {
      const x = padL + k * bw + bw * 0.5;
      ctx.fillText(`k${k}`, x, y0 + H * 0.11);
    }
    ctx.textAlign = "left";
  }, [reduced]);

  /* -- DPR sizing + redraw -- */
  useEffect(() => {
    const size = (canvas: HTMLCanvasElement | null, ratio: number) => {
      if (!canvas) return;
      const d = dpr();
      const cssW = canvas.clientWidth || 320;
      const w = Math.max(200, Math.min(900, Math.round(cssW * d)));
      const h = Math.round(w * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    const apply = () => {
      size(ringRef.current, 1);
      size(specRef.current, 0.68);
      drawRing(revealRef.current, performance.now());
      drawSpec(revealRef.current, performance.now());
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      if (ringRef.current) ro.observe(ringRef.current);
      if (specRef.current) ro.observe(specRef.current);
    }
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [drawRing, drawSpec]);

  /* -- reveal on first data -- */
  const seenRef = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (!seenRef.current) {
      seenRef.current = true;
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    } else {
      revealRef.current = 1; // slider changes snap to full (no flicker)
    }
  }, [data]);

  /* -- animation loop (gated off-screen / reduced) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      drawRing(1, 0);
      drawSpec(1, 0);
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
      drawRing(revealRef.current, now);
      drawSpec(revealRef.current, now);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [data, inView, reduced, drawRing, drawSpec]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Deep Kernel 06 · Circulant · DFT block-diag</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Solve one wedge, get the <span className="text-cyan-400">whole wheel</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1.05fr_1fr]">
        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={ringRef}
            className="block aspect-square w-full max-w-full"
            role="img"
            aria-label="An N-fold symmetric ring whose sectors are displaced radially by the solution value, glowing cyan"
          />
          <span
            className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            Ring response · {n} sectors
          </span>
          {!ready && <BootOverlay />}
        </div>

        <div className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <canvas
            ref={specRef}
            className="block w-full max-w-full"
            style={{ aspectRatio: "1 / 0.68" }}
            role="img"
            aria-label="Bar spectrum of the per-harmonic magnitudes, the DFT block content of the circulant solve"
          />
          <span
            className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${VIOLET}55`, background: `${BG}bb`, color: "#d8b4fe" }}
          >
            |X̂ₖ| · DFT harmonic blocks
          </span>
          {!ready && <BootOverlay />}
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="N" value={n} min={4} max={64} step={1} onChange={(v) => setN(Math.round(v))} format={(v) => String(Math.round(v))} disabled={!ready} />
        <Slider label="κ" value={stiffness} min={0.05} max={4} step={0.05} onChange={setStiffness} format={(v) => v.toFixed(2)} color={VIOLET} disabled={!ready} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>N</span>
          {[6, 8, 12, 24, 48].map((p) => (
            <Pill key={p} onClick={() => setN(p)} active={n === p} ariaLabel={`Set sectors to ${p}`} disabled={!ready}>
              {p}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> circulant {n}×{n} · κ={stiffness.toFixed(2)} · <span style={{ color: EMERALD }}>{n} independent DFT harmonic blocks</span> · dominant k=
        {data ? data.dominant : "—"}
        {data ? (
          <>
            {" "}<span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}><span ref={msLabelRef}>{data.ms.toFixed(2)}</span> ms in WASM</span>
          </>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A structure with <span className="text-slate-200">N-fold rotational symmetry</span> — a turbine disk, a gear, a
        ring of coupled oscillators — has a stiffness operator that is <span className="text-cyan-300">circulant</span>.
        The DFT diagonalises every circulant, so FrankenSim never assembles the big system: it solves {n} tiny{" "}
        <span style={{ color: VIOLET }}>per-harmonic blocks</span> and inverse-transforms them back into the physical ring
        displacement you see glowing on the left. The bar spectrum on the right is exactly that harmonic content{" "}
        <span className="text-slate-200">|X̂ₖ|</span>. One impulse load (amber) at a single sector, the entire wheel&apos;s
        response reconstructed — compiled Rust, live in your tab.
      </div>
    </SyncContainer>
  );
}
