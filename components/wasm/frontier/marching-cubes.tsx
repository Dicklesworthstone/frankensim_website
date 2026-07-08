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
  VIOLET,
  dpr,
  useReducedMotionSafe,
} from "./_chrome";

const KINDS = [
  { kind: 0, label: "Gyroid" },
  { kind: 1, label: "Metaballs" },
  { kind: 2, label: "Torus" },
];
const RES_BY_KIND = [32, 40, 40]; // gyroid is triangle-dense; keep it lighter

interface GL {
  THREE: typeof THREE_NS;
  renderer: THREE_NS.WebGLRenderer;
  scene: THREE_NS.Scene;
  camera: THREE_NS.PerspectiveCamera;
  group: THREE_NS.Group;
  mesh: THREE_NS.Mesh;
  material: THREE_NS.MeshPhysicalMaterial;
  ro: ResizeObserver | null;
  raf: number | null;
}

export default function MarchingCubes() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inViewRef } = useInView<HTMLDivElement>();

  const [kind, setKind] = useState(0);
  const [iso, setIso] = useState(0);
  const [committedIso, setCommittedIso] = useState(0);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glReady, setGlReady] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<GL | null>(null);
  const tokenRef = useRef(0);
  const reducedRef = useRef(false);
  const clockRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  const triLabel = useRef<HTMLSpanElement>(null);
  const msLabel = useRef<HTMLSpanElement>(null);

  reducedRef.current = reduced;

  /* -- debounce the iso slider (each change re-extracts) -- */
  useEffect(() => {
    const id = setTimeout(() => setCommittedIso(iso), 260);
    return () => clearTimeout(id);
  }, [iso]);

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
      renderer.toneMappingExposure = 1.15;
      renderer.setClearColor(0x04090d, 1);
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, (mount.clientWidth || 640) / (mount.clientHeight || 420), 0.1, 100);
      camera.position.set(0, 0, 3.2);

      const group = new THREE.Group();
      scene.add(group);

      scene.add(new THREE.HemisphereLight(0x0891b2, 0x0b0f14, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 2.1);
      key.position.set(1.2, 1.5, 1.0);
      scene.add(key);
      const c = new THREE.PointLight(0x22d3ee, 60, 40);
      c.position.set(-3, 1, 2);
      scene.add(c);
      const v = new THREE.PointLight(0xa855f7, 55, 40);
      v.position.set(2.5, -2, -1.5);
      scene.add(v);
      const w = new THREE.PointLight(0xffffff, 25, 40);
      w.position.set(0, 3, -3);
      scene.add(w);

      const material = new THREE.MeshPhysicalMaterial({
        color: 0x0b3a44,
        metalness: 0.92,
        roughness: 0.16,
        clearcoat: 0.7,
        clearcoatRoughness: 0.25,
        iridescence: 1.0,
        iridescenceIOR: 1.35,
        emissive: 0x041318,
        emissiveIntensity: 1.0,
        side: THREE.DoubleSide,
      });
      material.iridescenceThicknessRange = [120, 520];
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      group.add(mesh);

      if (cancelled) {
        material.dispose();
        renderer.dispose();
        return;
      }

      const ro = typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const wd = mount.clientWidth || 640;
            const ht = mount.clientHeight || 420;
            renderer.setPixelRatio(dpr());
            renderer.setSize(wd, ht, false);
            camera.aspect = wd / ht;
            camera.updateProjectionMatrix();
          })
        : null;
      ro?.observe(mount);

      glRef.current = { THREE, renderer, scene, camera, group, mesh, material, ro, raf: null };
      setGlReady(true);
    })();

    return () => {
      cancelled = true;
      const gl = glRef.current;
      if (gl) {
        if (gl.raf !== null) cancelAnimationFrame(gl.raf);
        gl.ro?.disconnect();
        gl.mesh.geometry.dispose();
        gl.material.dispose();
        gl.renderer.dispose();
        gl.renderer.domElement.remove();
      }
      glRef.current = null;
    };
  }, []);

  /* -- extract the isosurface (kind or iso change) -- */
  const extract = useCallback(async () => {
    const gl = glRef.current;
    if (!gl) return;
    const k = kind;
    const res = RES_BY_KIND[k] ?? 40;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    try {
      const t0 = performance.now();
      const raw = await call<Float64Array>("marching_cubes", res, k, committedIso);
      const ms = performance.now() - t0;
      if (tokenRef.current !== token || !glRef.current) return;
      const cur = glRef.current;
      const { THREE } = cur;
      const tri = Math.max(0, Math.round(raw[0]));
      const nv = tri * 3;
      const pos = new Float32Array(nv * 3);
      const nor = new Float32Array(nv * 3);
      for (let t = 0; t < tri; t++) {
        const o = 1 + 18 * t;
        for (let kk = 0; kk < 3; kk++) {
          const vi = (t * 3 + kk) * 3;
          pos[vi] = raw[o + 3 * kk];
          pos[vi + 1] = raw[o + 3 * kk + 1];
          pos[vi + 2] = raw[o + 3 * kk + 2];
          nor[vi] = raw[o + 9 + 3 * kk];
          nor[vi + 1] = raw[o + 9 + 3 * kk + 1];
          nor[vi + 2] = raw[o + 9 + 3 * kk + 2];
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      geo.computeBoundingSphere();
      cur.mesh.geometry.dispose();
      cur.mesh.geometry = geo;

      if (triLabel.current) triLabel.current.textContent = tri.toLocaleString();
      if (msLabel.current) msLabel.current.textContent = `${ms.toFixed(0)} ms`;
    } catch (e) {
      if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (tokenRef.current === token) setComputing(false);
    }
  }, [call, kind, committedIso]);

  useEffect(() => {
    if (!ready || !glReady) return;
    void extract();
  }, [ready, glReady, extract]);

  /* -- render loop (auto-rotate) -- */
  useEffect(() => {
    if (!glReady) return;
    const gl = glRef.current;
    if (!gl) return;
    const tick = (ts: number) => {
      if (!inViewRef.current) {
        lastTsRef.current = null;
        gl.raf = requestAnimationFrame(tick);
        return;
      }
      const last = lastTsRef.current;
      const dt = last === null ? 0 : Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;
      clockRef.current += dt;
      if (!reducedRef.current) {
        gl.group.rotation.y += dt * 0.4;
        gl.group.rotation.x = 0.35 * Math.sin(clockRef.current * 0.23);
      } else {
        gl.group.rotation.set(0.4, 0.7, 0);
      }
      gl.renderer.render(gl.scene, gl.camera);
      gl.raf = requestAnimationFrame(tick);
    };
    gl.raf = requestAnimationFrame(tick);
    return () => {
      if (gl.raf !== null) cancelAnimationFrame(gl.raf);
      gl.raf = null;
    };
  }, [glReady, inViewRef]);

  const res = RES_BY_KIND[kind] ?? 40;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Frontier 03 · fs-math isosurface</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Watch a surface be <span className="text-cyan-400">born</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <div ref={mountRef} className="block aspect-[16/10] w-full max-w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        {!ready && <BootOverlay />}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}44`, background: `${BG}bb`, color: CYAN_GLOW }}>
            REAL marching-cubes · {res}³ scalar field → watertight mesh
          </span>
          <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>tris</span>
              <span ref={triLabel} className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>—</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>extract</span>
              <span ref={msLabel} className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD }}>—</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>field</span>
        {KINDS.map((k) => (
          <Pill key={k.kind} onClick={() => setKind(k.kind)} active={kind === k.kind} ariaLabel={`Scalar field ${k.label}`} disabled={!ready}>
            {k.label}
          </Pill>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>iso level</span>
          <input
            type="range" min={-0.5} max={0.5} step={0.02} value={iso}
            onChange={(e) => setIso(parseFloat(e.target.value))}
            aria-label="Isosurface level" disabled={!ready}
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10" style={{ accentColor: VIOLET }}
          />
          <span className="w-12 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums" style={{ color: BRIGHT }}>{iso.toFixed(2)}</span>
        </label>
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {res}³ grid polygonized to a triangle mesh with per-vertex gradient normals · re-extracts on every control change
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Real isosurface polygonization: the <span style={{ color: VIOLET }}>Region → mesh chart conversion</span>. The kernel
        evaluates a scalar field (a <span className="text-slate-200">Gyroid TPMS</span>, a metaball blob, or a torus) on a {res}³
        grid, then runs <span className="text-slate-200">marching cubes</span> to emit a watertight triangle soup with true
        gradient normals, which becomes this <span className="text-slate-200">BufferGeometry</span> under an iridescent metal.
        Drag the iso level and a fresh mesh is extracted in the worker, live.
      </div>
    </SyncContainer>
  );
}
