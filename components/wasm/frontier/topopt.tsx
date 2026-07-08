"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";
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
  SURFACE,
  TEAL,
  VIOLET,
  dpr,
  toF32,
  useReducedMotionSafe,
} from "./_chrome";

/* ------------------------------------------------------------------ */
/*  Presets — topopt is a heavy FEM solve; keep grids modest.         */
/* ------------------------------------------------------------------ */

interface Preset {
  key: string;
  nx: number;
  ny: number;
  iters: number;
}
const PRESETS: Preset[] = [
  { key: "Fast", nx: 40, ny: 20, iters: 22 },
  { key: "Fine", nx: 48, ny: 24, iters: 28 },
  { key: "Ultra", nx: 60, ny: 30, iters: 30 },
];

const H_MAX = 5.0; // max voxel extrusion (world units) at density 1
const REVEAL_SECONDS = 4.2; // wall-clock time to play the whole optimization

/* Two-segment linear ramp in linear-RGB: steel → teal → hot cyan-white. */
function ramp(d: number, out: [number, number, number]) {
  if (d < 0.5) {
    const t = d * 2;
    out[0] = 0.10 + (0.00 - 0.10) * t;
    out[1] = 0.14 + (0.46 - 0.14) * t;
    out[2] = 0.20 + (0.52 - 0.20) * t;
  } else {
    const t = (d - 0.5) * 2;
    out[0] = 0.0 + (0.55 - 0.0) * t;
    out[1] = 0.46 + (1.05 - 0.46) * t;
    out[2] = 0.52 + (1.15 - 0.52) * t;
  }
}

/* ------------------------------------------------------------------ */

interface GL {
  THREE: typeof THREE_NS;
  renderer: THREE_NS.WebGLRenderer;
  scene: THREE_NS.Scene;
  camera: THREE_NS.PerspectiveCamera;
  group: THREE_NS.Group;
  dummy: THREE_NS.Object3D;
  color: THREE_NS.Color;
  ro: ResizeObserver | null;
  raf: number | null;
}

interface Data {
  frames: Float32Array;
  nx: number;
  ny: number;
  iters: number;
  mesh: THREE_NS.InstancedMesh;
  ms: number;
}

export default function Topopt() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inViewRef } = useInView<HTMLDivElement>();

  const [presetKey, setPresetKey] = useState("Fast");
  const [volfrac, setVolfrac] = useState(0.5);
  const [committedVol, setCommittedVol] = useState(0.5);
  const [playing, setPlaying] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glReady, setGlReady] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<GL | null>(null);
  const dataRef = useRef<Data | null>(null);
  const tokenRef = useRef(0);

  const clockRef = useRef(0); // virtual seconds of playback
  const lastTsRef = useRef<number | null>(null);
  const playingRef = useRef(true);
  const reducedRef = useRef(false);
  const scrubRef = useRef<number | null>(null); // manual frame (null = auto)

  // HUD nodes (written imperatively — never via setState in the loop)
  const frameLabel = useRef<HTMLSpanElement>(null);
  const volLabel = useRef<HTMLSpanElement>(null);
  const mndLabel = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const scrubInput = useRef<HTMLInputElement>(null);

  playingRef.current = playing;
  reducedRef.current = reduced;

  /* -- debounce the (expensive) volfrac slider -- */
  useEffect(() => {
    const id = setTimeout(() => setCommittedVol(volfrac), 360);
    return () => clearTimeout(id);
  }, [volfrac]);

  /* -- init Three.js once -- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const THREE = await import("three");
      const mount = mountRef.current;
      if (cancelled || !mount) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(dpr());
      renderer.setSize(mount.clientWidth || 640, mount.clientHeight || 420, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;
      renderer.setClearColor(0x04090d, 1);
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x04090d, 0.012);
      const camera = new THREE.PerspectiveCamera(42, (mount.clientWidth || 640) / (mount.clientHeight || 420), 0.1, 500);
      camera.position.set(8, 10, 60);

      const group = new THREE.Group();
      scene.add(group);

      scene.add(new THREE.AmbientLight(0x223344, 1.4));
      const key = new THREE.DirectionalLight(0xbfe9ff, 1.5);
      key.position.set(-0.5, 1, 0.8);
      scene.add(key);
      const rim = new THREE.PointLight(0xa855f7, 120, 200);
      rim.position.set(-30, -10, 30);
      scene.add(rim);
      const fill = new THREE.PointLight(0x06b6d4, 90, 200);
      fill.position.set(30, 20, 25);
      scene.add(fill);

      if (cancelled) {
        renderer.dispose();
        return;
      }

      const ro = typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const w = mount.clientWidth || 640;
            const h = mount.clientHeight || 420;
            renderer.setPixelRatio(dpr());
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
          })
        : null;
      ro?.observe(mount);

      glRef.current = {
        THREE,
        renderer,
        scene,
        camera,
        group,
        dummy: new THREE.Object3D(),
        color: new THREE.Color(),
        ro,
        raf: null,
      };
      setGlReady(true);
    })();

    return () => {
      cancelled = true;
      const gl = glRef.current;
      if (gl) {
        if (gl.raf !== null) cancelAnimationFrame(gl.raf);
        gl.ro?.disconnect();
        gl.scene.traverse((o) => {
          const m = o as THREE_NS.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = (m as THREE_NS.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else if (mat) mat.dispose();
        });
        gl.renderer.dispose();
        gl.renderer.domElement.remove();
      }
      glRef.current = null;
      dataRef.current = null;
    };
  }, []);

  /* -- compute frames + (re)build the instanced mesh -- */
  useEffect(() => {
    if (!ready || !glReady) return;
    const gl = glRef.current;
    if (!gl) return;
    const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];
    const { nx, ny, iters } = preset;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);

    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("topopt_frames", nx, ny, iters, committedVol);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token || !glRef.current) return;
        const frames = toF32(raw);

        const { THREE } = gl;
        // tear down previous mesh
        if (dataRef.current) {
          gl.group.remove(dataRef.current.mesh);
          dataRef.current.mesh.geometry.dispose();
          (dataRef.current.mesh.material as THREE_NS.Material).dispose();
        }

        const geo = new THREE.BoxGeometry(0.9, 0.9, 1);
        geo.translate(0, 0, 0.5); // grow from the back plane (z=0) toward +z
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.25,
          roughness: 0.45,
          vertexColors: false,
        });
        // per-instance emissive: hot cells self-illuminate (bloom-ish glow)
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uEmis = { value: 0.9 };
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * 0.9;",
          );
        };

        const count = nx * ny;
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        // allocate instanceColor
        const dummy = gl.dummy;
        const col = gl.color;
        const rgb: [number, number, number] = [0, 0, 0];
        for (let ey = 0; ey < ny; ey++) {
          for (let ex = 0; ex < nx; ex++) {
            const idx = ey * nx + ex;
            dummy.position.set(ex - (nx - 1) / 2, (ny - 1) / 2 - ey, 0);
            dummy.scale.set(1, 1, 0.2);
            dummy.updateMatrix();
            mesh.setMatrixAt(idx, dummy.matrix);
            ramp(0, rgb);
            col.setRGB(rgb[0], rgb[1], rgb[2]);
            mesh.setColorAt(idx, col);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        gl.group.add(mesh);

        // frame camera to the grid
        const span = Math.max(nx, ny * 1.4);
        gl.camera.position.set(span * 0.18, span * 0.16, span * 1.18);
        gl.camera.lookAt(0, 0, 0);

        dataRef.current = { frames, nx, ny, iters, mesh, ms };
        clockRef.current = 0;
        lastTsRef.current = null;
        scrubRef.current = reducedRef.current ? iters - 1 : null;
        if (scrubInput.current) {
          scrubInput.current.max = String(iters - 1);
          scrubInput.current.value = reducedRef.current ? String(iters - 1) : "0";
        }
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, glReady, presetKey, committedVol, call]);

  /* -- write per-instance transforms + colors for a fractional frame -- */
  const applyFrame = useCallback((fp: number) => {
    const gl = glRef.current;
    const data = dataRef.current;
    if (!gl || !data) return;
    const { frames, nx, ny, iters, mesh } = data;
    const f0 = Math.min(iters - 1, Math.max(0, Math.floor(fp)));
    const f1 = Math.min(iters - 1, f0 + 1);
    const w = fp - f0;
    const base0 = f0 * nx * ny;
    const base1 = f1 * nx * ny;
    const dummy = gl.dummy;
    const col = gl.color;
    const rgb: [number, number, number] = [0, 0, 0];
    let volSum = 0;
    let mndSum = 0;
    for (let ey = 0; ey < ny; ey++) {
      for (let ex = 0; ex < nx; ex++) {
        const idx = ey * nx + ex;
        const d = frames[base0 + idx] * (1 - w) + frames[base1 + idx] * w;
        volSum += d;
        mndSum += 4 * d * (1 - d);
        const h = 0.18 + d * H_MAX;
        dummy.position.set(ex - (nx - 1) / 2, (ny - 1) / 2 - ey, 0);
        dummy.scale.set(1, 1, h);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        ramp(d, rgb);
        col.setRGB(rgb[0], rgb[1], rgb[2]);
        mesh.setColorAt(idx, col);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const n = nx * ny;
    if (frameLabel.current) frameLabel.current.textContent = `${Math.round(fp) + 1}/${iters}`;
    if (volLabel.current) volLabel.current.textContent = (volSum / n).toFixed(3);
    if (mndLabel.current) mndLabel.current.textContent = (mndSum / n).toFixed(3);
    if (progressRef.current) progressRef.current.style.width = `${Math.round((fp / Math.max(1, iters - 1)) * 100)}%`;
  }, []);

  /* -- render/animation loop -- */
  useEffect(() => {
    if (!glReady) return;
    const gl = glRef.current;
    if (!gl) return;

    const render = () => {
      gl.renderer.render(gl.scene, gl.camera);
    };

    const tick = (ts: number) => {
      const data = dataRef.current;
      const visible = inViewRef.current;
      if (!visible) {
        lastTsRef.current = null;
        gl.raf = requestAnimationFrame(tick);
        return; // hold last painted frame while off-screen
      }
      const last = lastTsRef.current;
      const dt = last === null ? 0 : Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;

      // slow orbit
      if (!reducedRef.current) gl.group.rotation.y += dt * 0.16;

      if (data) {
        const perSec = data.iters / REVEAL_SECONDS;
        let fp: number;
        if (scrubRef.current !== null) {
          fp = scrubRef.current;
        } else {
          if (playingRef.current && !reducedRef.current) clockRef.current += dt;
          fp = Math.min(data.iters - 1, clockRef.current * perSec);
        }
        applyFrame(fp);
        if (scrubInput.current && scrubRef.current === null) {
          scrubInput.current.value = String(Math.round(fp));
        }
      }
      render();
      gl.raf = requestAnimationFrame(tick);
    };

    gl.raf = requestAnimationFrame(tick);
    return () => {
      if (gl.raf !== null) cancelAnimationFrame(gl.raf);
      gl.raf = null;
    };
  }, [glReady, applyFrame, inViewRef]);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];
  const dof = preset.nx * preset.ny * 2;

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    scrubRef.current = parseInt(e.target.value, 10);
    setPlaying(false);
  };
  const replay = () => {
    scrubRef.current = null;
    clockRef.current = 0;
    lastTsRef.current = null;
    if (!reduced) setPlaying(true);
  };

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Frontier 01 · fs-sparse FEM</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Optimize the <span className="text-cyan-400">impossible</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <div ref={mountRef} className="block aspect-[16/10] w-full max-w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        {!ready && <BootOverlay />}

        {/* HUD */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}
          >
            REAL fs-sparse · assemble K · CG solve Ku=f · OC update
          </span>
          <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>iter</span>
              <span ref={frameLabel} className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>—</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>vol</span>
              <span ref={volLabel} className="font-mono text-[11px] font-bold tabular-nums" style={{ color: TEAL }}>—</span>
              <span className="ml-1 font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>discr</span>
              <span ref={mndLabel} className="font-mono text-[11px] font-bold tabular-nums" style={{ color: VIOLET }}>—</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div ref={progressRef} className="h-full transition-[width] duration-100" style={{ width: "0%", background: CYAN_GLOW, boxShadow: `0 0 8px ${CYAN_GLOW}` }} />
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>mesh</span>
        {PRESETS.map((p) => (
          <Pill key={p.key} onClick={() => setPresetKey(p.key)} active={presetKey === p.key} ariaLabel={`Mesh preset ${p.key}`} disabled={!ready}>
            {p.key} · {p.nx}×{p.ny}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill onClick={() => setPlaying((p) => !p)} active={playing && !reduced} color={EMERALD} ariaLabel={playing ? "Pause" : "Play"} disabled={!ready || reduced}>
          {playing && !reduced ? "Pause" : "Play"}
        </Pill>
        <Pill onClick={replay} color={TEAL} ariaLabel="Replay optimization" disabled={!ready}>Replay</Pill>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>vol frac</span>
          <input
            type="range" min={0.2} max={0.7} step={0.05} value={volfrac}
            onChange={(e) => setVolfrac(parseFloat(e.target.value))}
            aria-label="Target volume fraction" disabled={!ready}
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10" style={{ accentColor: CYAN }}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums" style={{ color: BRIGHT }}>{volfrac.toFixed(2)}</span>
        </label>
        <label className="flex min-w-0 flex-[2] items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>scrub</span>
          <input
            ref={scrubInput} type="range" min={0} max={preset.iters - 1} step={1} defaultValue={0}
            onChange={onScrub} aria-label="Scrub optimization iteration" disabled={!ready}
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10" style={{ accentColor: TEAL }}
          />
        </label>
      </div>

      {/* Readout */}
      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> cantilever · {preset.nx}×{preset.ny} elements · {preset.iters} OC iterations · {dof.toLocaleString()} DOF
        {dataRef.current ? (
          <>
            {" "}<span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{dataRef.current.ms.toFixed(0)} ms full solve in WASM</span>
          </>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A real <span className="text-slate-200">topology optimization</span>: for each of these frames the kernel assembles
        the global stiffness matrix <span className="text-slate-200">K</span>, solves the elasticity system{" "}
        <span className="text-slate-200">Ku = f</span> with matrix-free <span className="text-slate-200">conjugate gradients</span>, then
        runs an <span style={{ color: VIOLET }}>Optimality-Criteria</span> density update, no mesh in the loop. Watch a grey slab of
        material redistribute itself into a glowing cantilever truss, frame by optimized frame. The look is easy to mimic; finding the
        actual load path takes a genuine FEM solver, which is what runs here.
      </div>
    </SyncContainer>
  );
}
