"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as T from "three";
import { motion, useReducedMotion } from "@/components/motion";
import { cn } from "@/lib/utils";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const AMBER = "#fbbf24";
const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

const STEPS = 45000;
const DT = 0.006;

/* ------------------------------------------------------------------ */
/*  Reduced-motion (hydration-safe)                                    */
/* ------------------------------------------------------------------ */

function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted ? !!rm : false;
}

/* ------------------------------------------------------------------ */
/*  Shared chrome                                                      */
/* ------------------------------------------------------------------ */

function LiveBadge({ computing }: { computing: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.2em]"
      style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d`, color: CYAN_GLOW }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full animate-pulse"
        style={{ background: computing ? AMBER : EMERALD, boxShadow: "0 0 6px currentColor" }}
      />
      Computed live in WASM
    </span>
  );
}

function Pill({
  onClick,
  active,
  color = CYAN,
  children,
  ariaLabel,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  color?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/5",
      )}
      style={{
        borderColor: active ? color : `${color}55`,
        color: active ? BG : color,
        background: active ? color : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}
    >
      kernel error: {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Path colouring: cyan → teal → violet along the trajectory          */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const C_A: RGB = [0.13, 0.83, 0.93]; // cyan-glow
const C_B: RGB = [0.08, 0.72, 0.65]; // teal
const C_C: RGB = [0.66, 0.33, 0.97]; // violet
function pathColor(t: number): RGB {
  if (t < 0.5) {
    const u = t / 0.5;
    return [C_A[0] + (C_B[0] - C_A[0]) * u, C_A[1] + (C_B[1] - C_A[1]) * u, C_A[2] + (C_B[2] - C_A[2]) * u];
  }
  const u = (t - 0.5) / 0.5;
  return [C_B[0] + (C_C[0] - C_B[0]) * u, C_B[1] + (C_C[1] - C_B[1]) * u, C_B[2] + (C_C[2] - C_B[2]) * u];
}

/* A soft radial sprite for the moving comet head. */
function makeGlowTexture(THREE: typeof import("three")): T.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(190,245,255,0.9)");
  g.addColorStop(0.55, "rgba(34,211,238,0.5)");
  g.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Geometry data (recentred + scaled, mapped so Lorenz z is "up")     */
/* ------------------------------------------------------------------ */

interface PathData {
  positions: Float32Array; // three-space, count*3
  colors: Float32Array; // count*3
  count: number;
  ms: number;
  rho: number;
}

function buildPath(raw: Float64Array, rho: number, ms: number): PathData {
  const count = Math.floor(raw.length / 3);
  let minx = Infinity, miny = Infinity, minz = Infinity;
  let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = raw[i * 3], y = raw[i * 3 + 1], z = raw[i * 3 + 2];
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
    if (z < minz) minz = z; if (z > maxz) maxz = z;
  }
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, cz = (minz + maxz) / 2;
  const ext = Math.max(maxx - minx, maxy - miny, maxz - minz, 1e-6);
  const s = 44 / ext;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = raw[i * 3], y = raw[i * 3 + 1], z = raw[i * 3 + 2];
    // map (x,y,z)_sim -> (x, z, y)_three so the vertical axis is Lorenz-z.
    positions[i * 3] = (x - cx) * s;
    positions[i * 3 + 1] = (z - cz) * s;
    positions[i * 3 + 2] = (y - cy) * s;
    const [r, g, b] = pathColor(count > 1 ? i / (count - 1) : 0);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  return { positions, colors, count, ms, rho };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Lorenz() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [rho, setRho] = useState(28);
  const [rhoApplied, setRhoApplied] = useState(28);
  const [playing, setPlaying] = useState(true);
  const [data, setData] = useState<PathData | null>(null);
  const [seq, setSeq] = useState(0);
  const [built, setBuilt] = useState(false);
  const [glFailed, setGlFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  // three refs
  const rendererRef = useRef<T.WebGLRenderer | null>(null);
  const sceneRef = useRef<T.Scene | null>(null);
  const cameraRef = useRef<T.PerspectiveCamera | null>(null);
  const groupRef = useRef<T.Group | null>(null);
  const ghostRef = useRef<T.Line | null>(null);
  const headRef = useRef<T.Line | null>(null);
  const tipRef = useRef<T.Sprite | null>(null);
  const geomRef = useRef<T.BufferGeometry | null>(null);
  const headGeomRef = useRef<T.BufferGeometry | null>(null);
  const threeRef = useRef<typeof import("three") | null>(null);
  const dataRef = useRef<PathData | null>(null);
  dataRef.current = data;

  const drawHeadRef = useRef(0); // float, current comet position (vertex idx)
  const rafRef = useRef<number | null>(null);
  const computeTokenRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Debounce rho -> rhoApplied so dragging the slider does not spam the kernel.
  useEffect(() => {
    const id = setTimeout(() => setRhoApplied(rho), 180);
    return () => clearTimeout(id);
  }, [rho]);

  const timingRef = useRef<HTMLSpanElement>(null);

  /* -- compute trajectory (latest-wins) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++computeTokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("lorenz_points", STEPS, DT, rhoApplied);
        const ms = performance.now() - t0;
        if (computeTokenRef.current !== token) return;
        const pd = buildPath(raw, rhoApplied, ms);
        dataRef.current = pd;
        setData(pd);
        setSeq((s) => s + 1);
      } catch (e) {
        if (computeTokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (computeTokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, rhoApplied, call]);

  /* -- build the three.js scene once -- */
  useEffect(() => {
    let cancelled = false;
    let disposed = false;
    (async () => {
      const THREE = await import("three");
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      let renderer: T.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        setGlFailed(true);
        return;
      }
      if (!renderer.getContext()) {
        setGlFailed(true);
        return;
      }
      threeRef.current = THREE;
      renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2));
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
      camera.position.set(0, 6, 96);
      camera.lookAt(0, 0, 0);

      const group = new THREE.Group();
      group.rotation.x = -0.18;
      scene.add(group);

      const tipTex = makeGlowTexture(THREE);
      const tipMat = new THREE.SpriteMaterial({
        map: tipTex,
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      const tip = new THREE.Sprite(tipMat);
      tip.scale.set(7, 7, 1);
      tip.visible = false;
      group.add(tip);

      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      groupRef.current = group;
      tipRef.current = tip;

      // size now
      const applySize = () => {
        const r = rendererRef.current;
        const cam = cameraRef.current;
        if (!r || !cam) return;
        const w = canvas.clientWidth || 480;
        const h = canvas.clientHeight || 480;
        r.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      };
      applySize();
      setBuilt(true);

      // Resize handling stored for cleanup.
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(applySize) : null;
      ro?.observe(canvas);
      const onWin = () => applySize();
      window.addEventListener("resize", onWin);

      cleanupRef.current = () => {
        if (disposed) return;
        disposed = true;
        ro?.disconnect();
        window.removeEventListener("resize", onWin);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        tipTex.dispose();
        tipMat.dispose();
        geomRef.current?.dispose();
        headGeomRef.current?.dispose();
        (ghostRef.current?.material as T.Material | undefined)?.dispose?.();
        (headRef.current?.material as T.Material | undefined)?.dispose?.();
        renderer.dispose();
      };
    })();
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  /* -- (re)build geometry when the trajectory changes -- */
  useEffect(() => {
    const THREE = threeRef.current;
    const group = groupRef.current;
    if (!THREE || !group || !data) return;

    // dispose previous
    if (ghostRef.current) {
      group.remove(ghostRef.current);
      (ghostRef.current.material as T.Material).dispose();
    }
    if (headRef.current) {
      group.remove(headRef.current);
      (headRef.current.material as T.Material).dispose();
    }
    geomRef.current?.dispose();
    headGeomRef.current?.dispose();

    const geom = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(data.positions, 3);
    const colAttr = new THREE.BufferAttribute(data.colors, 3);
    geom.setAttribute("position", posAttr);
    geom.setAttribute("color", colAttr);

    // Head geometry shares the same buffers but has its own draw range.
    const headGeom = new THREE.BufferGeometry();
    headGeom.setAttribute("position", posAttr);
    headGeom.setAttribute("color", colAttr);

    const ghostMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    ghostMat.color = new THREE.Color(0x8899aa);
    const headMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    headMat.color = new THREE.Color(0xffffff);

    const ghost = new THREE.Line(geom, ghostMat);
    const head = new THREE.Line(headGeom, headMat);
    head.renderOrder = 2;
    group.add(ghost);
    group.add(head);

    geomRef.current = geom;
    headGeomRef.current = headGeom;
    ghostRef.current = ghost;
    headRef.current = head;
    drawHeadRef.current = reducedRef.current ? data.count : 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, built]);

  /* -- render a single frame at the current head -- */
  const renderFrame = useCallback(() => {
    const r = rendererRef.current;
    const scene = sceneRef.current;
    const cam = cameraRef.current;
    const headGeom = headGeomRef.current;
    const tip = tipRef.current;
    const d = dataRef.current;
    if (!r || !scene || !cam || !headGeom || !d) return;
    const h = Math.max(2, Math.min(Math.floor(drawHeadRef.current), d.count));
    headGeom.setDrawRange(0, h);
    if (tip) {
      const idx = Math.min(h - 1, d.count - 1) * 3;
      tip.position.set(d.positions[idx], d.positions[idx + 1], d.positions[idx + 2]);
      tip.visible = true;
    }
    r.render(scene, cam);
  }, []);

  /* -- animation loop (paused off-screen / reduced-motion) -- */
  useEffect(() => {
    if (!built || !data) return;
    const group = groupRef.current;

    if (reduced || !inView || !playing) {
      // Static: full curve, comet parked at the end, no rAF.
      drawHeadRef.current = data.count;
      renderFrame();
      return;
    }

    let last = performance.now();
    // draw the whole butterfly in ~14s regardless of step count
    const drawSpeed = data.count / 14000; // vertices per ms
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      const dt = Math.min(now - last, 60);
      last = now;
      let h = drawHeadRef.current + drawSpeed * dt;
      if (h >= data.count) h = 1; // loop the reveal
      drawHeadRef.current = h;
      if (group) {
        group.rotation.y += dt * 0.00016;
        if (tipRef.current) {
          const pulse = 6.2 + Math.sin(now * 0.006) * 1.4;
          tipRef.current.scale.set(pulse, pulse, 1);
        }
      }
      renderFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, seq, reduced, inView, playing, renderFrame]);

  // Keep the mono timing readout fresh without a per-frame re-render.
  useEffect(() => {
    if (timingRef.current && data) timingRef.current.textContent = data.ms.toFixed(1);
  }, [data]);

  const rhoPresets = [10, 28, 60, 99];

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Frontier 01 · fs-math · RK4
            </span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Deterministic <span className="text-cyan-400">chaos</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* 3D canvas */}
      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: "radial-gradient(circle at 50% 46%, rgba(34,211,238,0.10), rgba(4,9,13,0) 62%)" }}
        />
        <canvas
          ref={canvasRef}
          className="relative z-10 block aspect-square w-full max-w-full"
          role="img"
          aria-label="A glowing 3D Lorenz-attractor butterfly trajectory drawing itself, slowly rotating"
        />

        {(!ready || (!built && !glFailed)) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: `${BG}dd` }}>
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-amber-300/90 animate-pulse">
              Reanimating kernel…
            </span>
          </div>
        )}
        {glFailed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center" style={{ background: `${BG}ee` }}>
            <span className="font-mono text-[11px] text-slate-400">WebGL unavailable — 3D view disabled in this browser.</span>
          </div>
        )}

        {/* HUD */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            REAL RK4 · σ=10 · β=8/3
          </span>
          {data && (
            <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>ρ</span>
                <span className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>
                  {data.rho.toFixed(0)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>integrate</span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD, textShadow: `0 0 8px ${EMERALD}66` }}>
                  <span ref={timingRef}>{data.ms.toFixed(1)}</span> ms
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>
                {STEPS.toLocaleString()} steps
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>ρ</span>
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={rho}
          disabled={!ready}
          onChange={(e) => setRho(Number(e.target.value))}
          aria-label="Rayleigh parameter rho"
          className="h-1.5 w-40 max-w-[45vw] cursor-pointer appearance-none rounded-full disabled:opacity-40"
          style={{ accentColor: CYAN, background: `linear-gradient(90deg, ${CYAN} ${(rho / 120) * 100}%, rgba(148,163,184,0.2) ${(rho / 120) * 100}%)` }}
        />
        <span className="w-8 font-mono text-[11px] tabular-nums" style={{ color: CYAN_GLOW }}>{rho}</span>
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        {rhoPresets.map((p) => (
          <Pill key={p} onClick={() => setRho(p)} active={rho === p} ariaLabel={`Set rho to ${p}`} disabled={!ready}>
            {p}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill
          onClick={() => setPlaying((p) => !p)}
          active={playing && !reduced}
          color={EMERALD}
          ariaLabel={playing ? "Pause" : "Play"}
          disabled={!ready || reduced || glFailed}
        >
          {playing && !reduced ? "Pause" : "Play"}
        </Pill>
      </div>

      {/* Readout */}
      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> RK4 integration · {STEPS.toLocaleString()} steps · dt={DT} · ρ={rhoApplied}
        {data ? (
          <>
            {" "}<span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>{data.ms.toFixed(1)} ms in WASM</span>
          </>
        ) : null}
      </div>

      {/* Caption */}
      <motion.div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A real <span className="text-slate-200">RK4 integration</span> of the Lorenz system, ẋ=σ(y−x), ẏ=x(ρ−z)−y,
        ż=xy−βz: the iconic butterfly of <span className="text-cyan-300">sensitive dependence on initial conditions</span>.
        Two neighbouring starts diverge exponentially, yet FrankenSim replays this trajectory{" "}
        <span style={{ color: VIOLET }}>bit-identically every single run</span> (deterministic kernels, no wall-clock RNG).
        Drag ρ through the bifurcations and re-integrate live. Reproducible chaos, computed fresh rather than canned.
      </motion.div>
    </SyncContainer>
  );
}
