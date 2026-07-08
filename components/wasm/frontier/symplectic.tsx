"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";
import {
  BG,
  BORDER,
  BRIGHT,
  BootOverlay,
  CYAN,
  CYAN_GLOW,
  EMERALD,
  ErrorNote,
  Eyebrow,
  LiveBadge,
  MUTED,
  Pill,
  ROSE,
  SURFACE,
  VIOLET,
  dpr,
  useReducedMotionSafe,
} from "./_chrome";

const REPLAY_SECONDS = 9.0;
const DT_OPTS = [
  { dt: 0.008, steps: 2600, label: "0.008" },
  { dt: 0.02, steps: 1800, label: "0.02" },
  { dt: 0.05, steps: 1400, label: "0.05" },
  { dt: 0.1, steps: 1200, label: "0.10" },
];

interface Data {
  raw: Float64Array;
  steps: number;
  symXY: number;
  eulXY: number;
  symH: number;
  eulH: number;
  viewHalf: number;
  hMin: number;
  hMax: number;
  ms: number;
}

export default function Symplectic() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [dtIdx, setDtIdx] = useState(1);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stat, setStat] = useState<{ ms: number; driftE: number; driftS: number; dt: number; steps: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<Data | null>(null);
  const tokenRef = useRef(0);
  const reducedRef = useRef(false);
  const clockRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const drawRef = useRef<() => void>(() => {});

  reducedRef.current = reduced;

  /* -- compute -- */
  useEffect(() => {
    if (!ready) return;
    const { dt, steps } = DT_OPTS[dtIdx];
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("symplectic_vs_euler", steps, dt);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const st = Math.round(raw[0]);
        const symXY = 1;
        const eulXY = 1 + 2 * st;
        const symH = 1 + 4 * st;
        const eulH = 1 + 5 * st;

        let symHalf = 0, eulHalf = 0;
        for (let i = 0; i < st; i++) {
          symHalf = Math.max(symHalf, Math.abs(raw[symXY + 2 * i]), Math.abs(raw[symXY + 2 * i + 1]));
          eulHalf = Math.max(eulHalf, Math.abs(raw[eulXY + 2 * i]), Math.abs(raw[eulXY + 2 * i + 1]));
        }
        // clamp a runaway Euler so the stable ellipse stays legible
        const viewHalf = Math.min(Math.max(symHalf, eulHalf), symHalf * 3.0) * 1.14;

        let hMin = Infinity, hMax = -Infinity;
        for (let i = 0; i < st; i++) {
          const a = raw[symH + i], b = raw[eulH + i];
          if (isFinite(a)) { hMin = Math.min(hMin, a); hMax = Math.max(hMax, a); }
          if (isFinite(b)) { hMin = Math.min(hMin, b); hMax = Math.max(hMax, b); }
        }
        const pad = (hMax - hMin) * 0.12 || 0.1;
        hMin -= pad; hMax += pad;

        dataRef.current = { raw, steps: st, symXY, eulXY, symH, eulH, viewHalf, hMin, hMax, ms };
        clockRef.current = 0;
        lastTsRef.current = null;
        setStat({
          ms,
          driftE: raw[eulH + st - 1] - raw[eulH],
          driftS: raw[symH + st - 1] - raw[symH],
          dt,
          steps: st,
        });
        drawRef.current();
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, dtIdx, call]);

  /* -- draw a frame up to step `cur` -- */
  const draw = useCallback((cur: number) => {
    const canvas = canvasRef.current;
    const data = dataRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const { raw, steps, symXY, eulXY, symH, eulH, viewHalf, hMin, hMax } = data;
    const px = dpr();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.42, W * 0.05, W / 2, H * 0.42, W * 0.7);
    vg.addColorStop(0, "rgba(10,20,28,0.6)");
    vg.addColorStop(1, "rgba(2,5,8,0.9)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    const insetH = H * 0.26;
    const orbCX = W / 2;
    const orbCY = (H - insetH) / 2;
    const scale = (Math.min(W, H - insetH) * 0.5 * 0.86) / viewHalf;
    const sx = (wx: number) => orbCX + wx * scale;
    const sy = (wy: number) => orbCY - wy * scale;

    const N = Math.max(1, Math.min(steps, Math.floor(cur) + 1));

    // central mass at focus (origin)
    const mg = ctx.createRadialGradient(sx(0), sy(0), 0, sx(0), sy(0), 26 * px);
    mg.addColorStop(0, "rgba(255,246,214,1)");
    mg.addColorStop(0.35, "rgba(251,191,36,0.85)");
    mg.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), 26 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), 3.2 * px, 0, Math.PI * 2);
    ctx.fill();

    const trail = (off: number, color: string, glow: string) => {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowBlur = 10 * px;
      ctx.shadowColor = glow;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.1 * px;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = sx(raw[off + 2 * i]);
        const y = sy(raw[off + 2 * i + 1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };
    // Euler first (behind), then symplectic on top
    trail(eulXY, "rgba(251,113,133,0.9)", ROSE);
    trail(symXY, "rgba(34,211,238,0.95)", CYAN_GLOW);

    const head = (off: number, fill: string, glow: string, i: number) => {
      const x = sx(raw[off + 2 * i]), y = sy(raw[off + 2 * i + 1]);
      ctx.shadowBlur = 16 * px;
      ctx.shadowColor = glow;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, 4.6 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(x, y, 1.8 * px, 0, Math.PI * 2);
      ctx.fill();
    };
    const hi = N - 1;
    head(eulXY, ROSE, ROSE, hi);
    head(symXY, CYAN_GLOW, CYAN_GLOW, hi);

    /* -- energy inset -- */
    const ix = 10 * px, iy = H - insetH + 6 * px, iw = W - 20 * px, ih = insetH - 16 * px;
    ctx.fillStyle = "rgba(4,9,13,0.72)";
    ctx.strokeStyle = "rgba(34,211,238,0.22)";
    ctx.lineWidth = 1 * px;
    roundRect(ctx, ix, iy, iw, ih, 8 * px);
    ctx.fill();
    ctx.stroke();

    const px0 = ix + 8 * px, py0 = iy + 8 * px, pw = iw - 16 * px, ph = ih - 16 * px;
    const hy = (h: number) => py0 + ph - ((h - hMin) / (hMax - hMin)) * ph;
    const hx = (i: number) => px0 + (i / Math.max(1, steps - 1)) * pw;

    // zero-drift reference (initial H)
    const h0 = raw[symH];
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.setLineDash([4 * px, 4 * px]);
    ctx.beginPath();
    ctx.moveTo(px0, hy(h0));
    ctx.lineTo(px0 + pw, hy(h0));
    ctx.stroke();
    ctx.setLineDash([]);

    const eline = (off: number, color: string, glow: string) => {
      ctx.strokeStyle = color;
      ctx.shadowBlur = 5 * px;
      ctx.shadowColor = glow;
      ctx.lineWidth = 1.6 * px;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = hx(i), y = hy(raw[off + i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    eline(eulH, "rgba(251,113,133,0.95)", ROSE);
    eline(symH, "rgba(34,211,238,0.95)", CYAN_GLOW);

    ctx.fillStyle = "rgba(148,163,184,0.85)";
    ctx.font = `${9 * px}px ui-monospace, monospace`;
    ctx.fillText("H = ½|v|² − 1/|r|   (energy vs time)", px0, iy + 12 * px);
  }, []);

  useEffect(() => {
    drawRef.current = () => {
      const data = dataRef.current;
      if (!data) return;
      const cur = reducedRef.current ? data.steps - 1 : Math.floor(clockRef.current * (data.steps / REPLAY_SECONDS)) % data.steps;
      draw(cur);
    };
  }, [draw]);

  /* -- DPR-aware backing store -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const px = dpr();
      const cssW = canvas.clientWidth || 640;
      const cssH = canvas.clientHeight || Math.round((cssW * 10) / 16);
      const w = Math.max(320, Math.round(cssW * px));
      const h = Math.max(200, Math.round(cssH * px));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        drawRef.current();
      }
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
  }, []);

  /* -- animation loop -- */
  useEffect(() => {
    if (reduced) {
      drawRef.current();
      return;
    }
    if (!inView) {
      drawRef.current();
      return;
    }
    const tick = (ts: number) => {
      const last = lastTsRef.current;
      const dt = last === null ? 0 : Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;
      clockRef.current += dt;
      drawRef.current();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [reduced, inView]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Frontier 05 · fs-math integrator</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Physics that <span className="text-cyan-400">conserves</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas ref={canvasRef} className="block aspect-[16/10] w-full max-w-full" role="img" aria-label="Kepler two-body orbit: a symplectic integrator traces a stable cyan ellipse while explicit Euler spirals outward in rose, with a live energy-versus-time plot" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        {!ready && <BootOverlay />}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}>
            REAL fs-math · Störmer–Verlet vs explicit Euler
          </span>
          <div className="flex items-center gap-3 rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
            <span className="flex items-center gap-1 font-mono text-[9px]" style={{ color: CYAN_GLOW }}>
              <span className="h-2 w-2 rounded-full" style={{ background: CYAN_GLOW, boxShadow: `0 0 6px ${CYAN_GLOW}` }} /> symplectic
            </span>
            <span className="flex items-center gap-1 font-mono text-[9px]" style={{ color: ROSE }}>
              <span className="h-2 w-2 rounded-full" style={{ background: ROSE, boxShadow: `0 0 6px ${ROSE}` }} /> Euler
            </span>
          </div>
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>time step dt</span>
        {DT_OPTS.map((o, i) => (
          <Pill key={o.label} onClick={() => setDtIdx(i)} active={dtIdx === i} ariaLabel={`Time step ${o.label}`} disabled={!ready}>
            {o.label}
          </Pill>
        ))}
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {stat ? (
          <>
            {stat.steps.toLocaleString()} steps · dt={stat.dt} <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: CYAN_GLOW }}>symplectic ΔH={stat.driftS >= 0 ? "+" : ""}{stat.driftS.toExponential(1)}</span>{" "}
            <span style={{ color: MUTED }}>vs</span>{" "}
            <span style={{ color: ROSE }}>Euler ΔH={stat.driftE >= 0 ? "+" : ""}{stat.driftE.toFixed(3)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{stat.ms.toFixed(1)} ms in WASM</span>
          </>
        ) : (
          "integrating…"
        )}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Same Kepler two-body problem, two integrators. The{" "}
        <span style={{ color: CYAN_GLOW }}>symplectic Störmer–Verlet</span> scheme conserves the Hamiltonian
        bit-tight, so its orbit is a stable closed ellipse and its energy line stays flat. Explicit{" "}
        <span style={{ color: ROSE }}>Euler</span>, stepping the very same forces, injects fake energy every step: the orbit
        spirals outward and H climbs without bound. This is <span style={{ color: VIOLET }}>structure-preserving integration</span>,{" "}
        FrankenSim&apos;s Decalogue P5, and it is why simulating a solar system calls for symplectic methods rather than
        ever-smaller Euler steps.
      </div>
    </SyncContainer>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
