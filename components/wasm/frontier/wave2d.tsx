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

const N = 128; // power of two (kernel enforces this)
const FRAMES = 120;
const SPF = 2;
const PLANE = 70;

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
      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: computing ? AMBER : EMERALD, boxShadow: "0 0 6px currentColor" }} />
      Computed live in WASM
    </span>
  );
}

function Pill({
  onClick, active, color = CYAN, children, ariaLabel, disabled,
}: {
  onClick: () => void; active?: boolean; color?: string; children: React.ReactNode; ariaLabel?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={active} disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/5",
      )}
      style={{ borderColor: active ? color : `${color}55`, color: active ? BG : color, background: active ? color : "transparent" }}
    >
      {children}
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]" style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: AMBER }}>
      kernel error: {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom GLSL — displaced plane, per-fragment relief lighting        */
/* ------------------------------------------------------------------ */

const VERT = /* glsl */ `
  attribute float aHeight;
  uniform float uAmp;
  varying float vH;
  varying vec3 vWorld;
  void main() {
    vH = aHeight;
    vec3 p = position;
    p.z += aHeight * uAmp;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  varying float vH;
  varying vec3 vWorld;
  uniform vec3 uLightDir;

  vec3 palette(float t) {
    vec3 violet = vec3(0.62, 0.30, 0.98);
    vec3 mid    = vec3(0.015, 0.05, 0.085);
    vec3 cyan   = vec3(0.16, 0.86, 0.96);
    if (t < 0.5) return mix(violet, mid, t / 0.5);
    return mix(mid, cyan, (t - 0.5) / 0.5);
  }

  void main() {
    // Analytic normal from screen-space derivatives of world position.
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.z < 0.0) n = -n;
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(L + V);
    float diff = clamp(dot(n, L), 0.0, 1.0);
    float spec = pow(max(dot(n, H), 0.0), 46.0);
    float rim  = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
    float t = clamp(vH * 0.5 + 0.5, 0.0, 1.0);
    vec3 base = palette(t);
    vec3 col = base * (0.28 + 0.9 * diff)
             + spec * vec3(0.8, 0.96, 1.0) * 0.95
             + rim * vec3(0.12, 0.66, 0.95) * 0.55;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface WaveData { frames: Float32Array; ms: number }
const AMPS = [{ k: "calm", v: 6 }, { k: "swell", v: 9.5 }, { k: "storm", v: 14 }] as const;

export default function Wave2d() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [playing, setPlaying] = useState(true);
  const [ampIdx, setAmpIdx] = useState(1);
  const [data, setData] = useState<WaveData | null>(null);
  const [built, setBuilt] = useState(false);
  const [glFailed, setGlFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const threeRef = useRef<typeof import("three") | null>(null);
  const rendererRef = useRef<T.WebGLRenderer | null>(null);
  const sceneRef = useRef<T.Scene | null>(null);
  const cameraRef = useRef<T.PerspectiveCamera | null>(null);
  const meshRef = useRef<T.Mesh | null>(null);
  const heightAttrRef = useRef<T.BufferAttribute | null>(null);
  const matRef = useRef<T.ShaderMaterial | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const framesRef = useRef<Float32Array | null>(null);
  const frameRef = useRef(0); // float frame index
  const orbitRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const timingRef = useRef<HTMLSpanElement>(null);
  const frameLabelRef = useRef<HTMLSpanElement>(null);

  // keep amplitude uniform live without recompute
  useEffect(() => {
    if (matRef.current) matRef.current.uniforms.uAmp.value = AMPS[ampIdx].v;
  }, [ampIdx]);

  /* -- upload one frame's heights into the plane -- */
  const uploadFrame = useCallback((idx: number) => {
    const attr = heightAttrRef.current;
    const frames = framesRef.current;
    if (!attr || !frames) return;
    const f = Math.max(0, Math.min(idx, FRAMES - 1));
    const off = f * N * N;
    (attr.array as Float32Array).set(frames.subarray(off, off + N * N));
    attr.needsUpdate = true;
  }, []);

  const renderOnce = useCallback(() => {
    const r = rendererRef.current, s = sceneRef.current, c = cameraRef.current;
    if (r && s && c) r.render(s, c);
  }, []);

  /* -- compute the wave field once (kernel is deterministic) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("wave2d_frames", N, FRAMES, SPF);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        let maxAbs = 1e-9;
        for (let i = 0; i < raw.length; i++) { const a = Math.abs(raw[i]); if (a > maxAbs) maxAbs = a; }
        const f32 = new Float32Array(raw.length);
        const inv = 1 / maxAbs;
        for (let i = 0; i < raw.length; i++) { const v = raw[i] * inv; f32[i] = v < -1 ? -1 : v > 1 ? 1 : v; }
        framesRef.current = f32;
        frameRef.current = 0;
        setData({ frames: f32, ms });
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, call]);

  /* -- build the three.js scene once (N is constant) -- */
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
      } catch { setGlFailed(true); return; }
      if (!renderer.getContext()) { setGlFailed(true); return; }
      threeRef.current = THREE;
      renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2));
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
      camera.position.set(0, -PLANE * 0.92, PLANE * 0.72);
      camera.lookAt(0, 0, 0);

      const geom = new THREE.PlaneGeometry(PLANE, PLANE, N - 1, N - 1);
      const heightAttr = new THREE.BufferAttribute(new Float32Array(N * N), 1);
      heightAttr.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute("aHeight", heightAttr);

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uAmp: { value: AMPS[ampIdx].v },
          uLightDir: { value: new THREE.Vector3(0.35, 0.42, 0.86).normalize() },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });

      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);

      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      meshRef.current = mesh;
      heightAttrRef.current = heightAttr;
      matRef.current = mat;

      const applySize = () => {
        const w = canvas.clientWidth || 480;
        const h = canvas.clientHeight || 480;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      applySize();
      setBuilt(true);

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
        geom.dispose();
        mat.dispose();
        renderer.dispose();
      };
    })();
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -- animation loop (paused off-screen / reduced-motion) -- */
  useEffect(() => {
    if (!built || !data) return;
    const camera = cameraRef.current;

    const placeCamera = () => {
      if (!camera) return;
      const a = orbitRef.current;
      const R = PLANE * 0.98;
      const Hgt = PLANE * 0.62;
      camera.position.set(Math.sin(a) * R, -Math.cos(a) * R, Hgt);
      camera.lookAt(0, 0, 0);
    };

    if (reduced || !inView || !playing) {
      const idx = reduced ? Math.floor(FRAMES * 0.5) : Math.floor(frameRef.current);
      frameRef.current = idx;
      uploadFrame(idx);
      placeCamera();
      renderOnce();
      if (frameLabelRef.current) frameLabelRef.current.textContent = String(idx + 1);
      return;
    }

    let last = performance.now();
    let acc = 0;
    const stepMs = 1000 / 28;
    const tick = (now: number) => {
      if (!inViewRef.current) { rafRef.current = null; return; }
      const dt = Math.min(now - last, 60);
      last = now;
      acc += dt;
      let changed = false;
      while (acc >= stepMs) {
        acc -= stepMs;
        frameRef.current = (frameRef.current + 1) % FRAMES;
        changed = true;
      }
      if (changed) {
        uploadFrame(Math.floor(frameRef.current));
        if (frameLabelRef.current) frameLabelRef.current.textContent = String(Math.floor(frameRef.current) + 1);
      }
      orbitRef.current += dt * 0.00013;
      placeCamera();
      renderOnce();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, data, reduced, inView, playing, uploadFrame, renderOnce]);

  useEffect(() => {
    if (timingRef.current && data) timingRef.current.textContent = data.ms.toFixed(1);
  }, [data]);

  const restart = useCallback(() => {
    frameRef.current = 0;
    uploadFrame(0);
    renderOnce();
    if (frameLabelRef.current) frameLabelRef.current.textContent = "1";
    if (!reduced) setPlaying(true);
  }, [reduced, uploadFrame, renderOnce]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-3">
            <span className="h-px w-8" style={{ background: `${CYAN}66` }} />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              Frontier 02 · fs-fft
            </span>
          </div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Spectral <span className="text-cyan-400">waves</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <div className="pointer-events-none absolute inset-0 z-0" style={{ background: "radial-gradient(circle at 50% 40%, rgba(34,211,238,0.10), rgba(4,9,13,0) 60%)" }} />
        <canvas
          ref={canvasRef}
          className="relative z-10 block aspect-square w-full max-w-full"
          role="img"
          aria-label="A 3D wave surface, height driven by a spectral wave solve, rippling with interference as the camera orbits"
        />

        {(!ready || (!built && !glFailed)) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: `${BG}dd` }}>
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-amber-300/90 animate-pulse">Reanimating kernel…</span>
          </div>
        )}
        {glFailed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center" style={{ background: `${BG}ee` }}>
            <span className="font-mono text-[11px] text-slate-400">WebGL unavailable — 3D view disabled in this browser.</span>
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-1.5">
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}>
            REAL fs-fft · Δu in Fourier space
          </span>
          {data && (
            <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>grid</span>
                <span className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>{N}×{N}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>FFT solve</span>
                <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD, textShadow: `0 0 8px ${EMERALD}66` }}>
                  <span ref={timingRef}>{data.ms.toFixed(1)}</span> ms
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[8px] tabular-nums" style={{ color: MUTED }}>
                frame <span ref={frameLabelRef}>1</span>/{FRAMES}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill onClick={() => setPlaying((p) => !p)} active={playing && !reduced} color={EMERALD} ariaLabel={playing ? "Pause" : "Play"} disabled={!ready || reduced || glFailed}>
          {playing && !reduced ? "Pause" : "Play"}
        </Pill>
        <Pill onClick={restart} color={VIOLET} ariaLabel="Restart the wave" disabled={!ready || glFailed}>Restart</Pill>
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>relief</span>
        {AMPS.map((a, i) => (
          <Pill key={a.k} onClick={() => setAmpIdx(i)} active={ampIdx === i} ariaLabel={`Set relief to ${a.k}`} disabled={!ready || glFailed}>
            {a.k}
          </Pill>
        ))}
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {FRAMES} snapshots × {SPF} spectral steps · {N}×{N} = {(N * N).toLocaleString()} modes
        {data ? (<>{" "}<span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(1)} ms in WASM</span></>) : null}
      </div>

      <motion.div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A <span className="text-slate-200">spectral (FFT-based) wave solve</span>: real <span className="text-cyan-300">fs-fft</span> transforms the
        field to Fourier space, applies the Laplacian as a simple multiply by <span style={{ color: VIOLET }}>−|k|²</span> per mode, then transforms
        back, every leapfrog step. That buys <span className="text-slate-200">global spectral accuracy</span> (no finite-difference stencil error),
        so the interference and periodic reflections you see are the true dynamics, lit here as a real 3-D relief. Drawing a sine wave is trivial;
        what runs here is a full FFT PDE solver, stepping live in your tab.
      </motion.div>
    </SyncContainer>
  );
}
