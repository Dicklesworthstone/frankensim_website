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
  toF32,
  useReducedMotionSafe,
} from "./_chrome";

const POINT_OPTS = [60, 100, 160];
const STEP_OPTS = [120, 180, 240];
const SWEEP_SECONDS = 6.0;

interface GL {
  THREE: typeof THREE_NS;
  renderer: THREE_NS.WebGLRenderer;
  scene: THREE_NS.Scene;
  camera: THREE_NS.PerspectiveCamera;
  group: THREE_NS.Group;
  lines: THREE_NS.LineSegments | null;
  seedLoop: THREE_NS.LineLoop | null;
  ring: THREE_NS.LineLoop | null;
  nodes: THREE_NS.Points | null;
  sprite: THREE_NS.Texture;
  ro: ResizeObserver | null;
  raf: number | null;
}

interface Data {
  pts: Float32Array; // baked, centroid-subtracted: steps*nPoints*3
  nPoints: number;
  steps: number;
  ms: number;
}

export default function GaMotor() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inViewRef } = useInView<HTMLDivElement>();

  const [nPoints, setNPoints] = useState(100);
  const [steps, setSteps] = useState(180);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glReady, setGlReady] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<GL | null>(null);
  const dataRef = useRef<Data | null>(null);
  const tokenRef = useRef(0);
  const reducedRef = useRef(false);
  const clockRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const frameLabel = useRef<HTMLSpanElement>(null);
  const msLabel = useRef<HTMLSpanElement>(null);

  reducedRef.current = reduced;

  /* -- build a soft round sprite for the ring nodes -- */
  const makeSprite = (THREE: typeof THREE_NS): THREE_NS.Texture => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.28, "rgba(190,245,255,0.85)");
    grd.addColorStop(1, "rgba(70,200,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  };

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
      renderer.setClearColor(0x04090d, 1);
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x04090d, 0.03);
      const camera = new THREE.PerspectiveCamera(42, (mount.clientWidth || 640) / (mount.clientHeight || 420), 0.1, 500);
      camera.position.set(0, 0, 40);
      const group = new THREE.Group();
      scene.add(group);

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
        THREE, renderer, scene, camera, group,
        lines: null, seedLoop: null, ring: null, nodes: null,
        sprite: makeSprite(THREE), ro, raf: null,
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
        gl.sprite.dispose();
        gl.renderer.dispose();
        gl.renderer.domElement.remove();
      }
      glRef.current = null;
      dataRef.current = null;
    };
  }, []);

  /* -- compute the orbit + (re)build all geometry -- */
  useEffect(() => {
    if (!ready || !glReady) return;
    const gl = glRef.current;
    if (!gl) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);

    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("ga_motor_orbit", nPoints, steps);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token || !glRef.current) return;
        const np = Math.round(raw[0]);
        const st = Math.round(raw[1]);
        const pts = toF32(raw, st * np * 3, 2);

        // centroid + extent for framing; bake centroid-subtraction into pts
        let cx = 0, cy = 0, cz = 0;
        const total = st * np;
        for (let i = 0; i < total; i++) { cx += pts[i * 3]; cy += pts[i * 3 + 1]; cz += pts[i * 3 + 2]; }
        cx /= total; cy /= total; cz /= total;
        let ext = 0;
        for (let i = 0; i < total; i++) {
          pts[i * 3] -= cx; pts[i * 3 + 1] -= cy; pts[i * 3 + 2] -= cz;
          const dx = pts[i * 3], dy = pts[i * 3 + 1], dz = pts[i * 3 + 2];
          ext = Math.max(ext, Math.hypot(dx, dy, dz));
        }

        const { THREE } = gl;
        const disposeObj = (o: THREE_NS.Object3D | null) => {
          if (!o) return;
          gl.group.remove(o);
          const m = o as THREE_NS.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else if (mat) mat.dispose();
        };
        disposeObj(gl.lines); disposeObj(gl.seedLoop); disposeObj(gl.ring); disposeObj(gl.nodes);

        // --- swept trajectories: one polyline per point, all in one LineSegments ---
        const segPerPoint = st - 1;
        const segCount = np * segPerPoint;
        const lpos = new Float32Array(segCount * 2 * 3);
        const lcol = new Float32Array(segCount * 2 * 3);
        const cA: [number, number, number] = [0.22, 1.02, 1.15]; // cyan (over-driven for additive glow)
        const cB: [number, number, number] = [0.86, 0.42, 1.25]; // violet
        let w = 0;
        for (let i = 0; i < np; i++) {
          for (let s = 0; s < segPerPoint; s++) {
            const a = (s * np + i) * 3;
            const b = ((s + 1) * np + i) * 3;
            lpos[w * 3] = pts[a]; lpos[w * 3 + 1] = pts[a + 1]; lpos[w * 3 + 2] = pts[a + 2];
            const f0 = s / st;
            lcol[w * 3] = cA[0] + (cB[0] - cA[0]) * f0;
            lcol[w * 3 + 1] = cA[1] + (cB[1] - cA[1]) * f0;
            lcol[w * 3 + 2] = cA[2] + (cB[2] - cA[2]) * f0;
            w++;
            lpos[w * 3] = pts[b]; lpos[w * 3 + 1] = pts[b + 1]; lpos[w * 3 + 2] = pts[b + 2];
            const f1 = (s + 1) / st;
            lcol[w * 3] = cA[0] + (cB[0] - cA[0]) * f1;
            lcol[w * 3 + 1] = cA[1] + (cB[1] - cA[1]) * f1;
            lcol[w * 3 + 2] = cA[2] + (cB[2] - cA[2]) * f1;
            w++;
          }
        }
        const lgeo = new THREE.BufferGeometry();
        lgeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
        lgeo.setAttribute("color", new THREE.BufferAttribute(lcol, 3));
        const lmat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
        const lines = new THREE.LineSegments(lgeo, lmat);
        lines.frustumCulled = false;
        gl.group.add(lines);
        gl.lines = lines;

        // --- seed ring (frame 0) ---
        const seedPos = new Float32Array(np * 3);
        for (let i = 0; i < np; i++) { const a = i * 3; seedPos[i * 3] = pts[a]; seedPos[i * 3 + 1] = pts[a + 1]; seedPos[i * 3 + 2] = pts[a + 2]; }
        const sgeo = new THREE.BufferGeometry();
        sgeo.setAttribute("position", new THREE.BufferAttribute(seedPos, 3));
        const smat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        const seedLoop = new THREE.LineLoop(sgeo, smat);
        seedLoop.frustumCulled = false;
        gl.group.add(seedLoop);
        gl.seedLoop = seedLoop;

        // --- animated "current" ring (loop + glowing nodes) ---
        const ringPos = new Float32Array(np * 3);
        ringPos.set(seedPos);
        const rgeo = new THREE.BufferGeometry();
        rgeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
        const rmat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
        const ring = new THREE.LineLoop(rgeo, rmat);
        ring.frustumCulled = false;
        gl.group.add(ring);
        gl.ring = ring;

        const ngeo = new THREE.BufferGeometry();
        ngeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3)); // shares buffer with ring
        const nmat = new THREE.PointsMaterial({ map: gl.sprite, size: Math.max(0.5, ext * 0.09), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
        const nodes = new THREE.Points(ngeo, nmat);
        nodes.frustumCulled = false;
        gl.group.add(nodes);
        gl.nodes = nodes;

        // frame the camera
        gl.camera.position.set(ext * 0.55, ext * 0.4, ext * 1.9);
        gl.camera.lookAt(0, 0, 0);
        gl.camera.far = ext * 8;
        gl.camera.updateProjectionMatrix();
        if (gl.scene.fog) (gl.scene.fog as THREE_NS.FogExp2).density = 0.16 / Math.max(1, ext);

        dataRef.current = { pts, nPoints: np, steps: st, ms };
        clockRef.current = 0;
        lastTsRef.current = null;
        if (msLabel.current) msLabel.current.textContent = `${ms.toFixed(1)} ms`;
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, glReady, nPoints, steps, call]);

  /* -- update the moving ring to frame f -- */
  const applyRing = useCallback((f: number) => {
    const gl = glRef.current;
    const data = dataRef.current;
    if (!gl || !data || !gl.ring) return;
    const { pts, nPoints: np, steps: st } = data;
    const fi = Math.min(st - 1, Math.max(0, Math.floor(f)));
    const attr = gl.ring.geometry.getAttribute("position") as THREE_NS.BufferAttribute;
    const arr = attr.array as Float32Array;
    const baseF = fi * np * 3;
    for (let i = 0; i < np * 3; i++) arr[i] = pts[baseF + i];
    attr.needsUpdate = true;
    if (gl.nodes) {
      const na = gl.nodes.geometry.getAttribute("position") as THREE_NS.BufferAttribute;
      na.needsUpdate = true; // shares the same underlying array
    }
    if (frameLabel.current) frameLabel.current.textContent = `${fi + 1}/${st}`;
  }, []);

  /* -- render loop -- */
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
      const data = dataRef.current;
      if (data) {
        if (reducedRef.current) {
          gl.group.rotation.y = 0.6;
          applyRing(data.steps - 1);
        } else {
          gl.group.rotation.y += dt * 0.22;
          const f = ((clockRef.current % SWEEP_SECONDS) / SWEEP_SECONDS) * data.steps;
          applyRing(f);
        }
      }
      gl.renderer.render(gl.scene, gl.camera);
      gl.raf = requestAnimationFrame(tick);
    };
    gl.raf = requestAnimationFrame(tick);
    return () => {
      if (gl.raf !== null) cancelAnimationFrame(gl.raf);
      gl.raf = null;
    };
  }, [glReady, applyRing, inViewRef]);

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Frontier 04 · fs-ga PGA</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Motion without <span className="text-cyan-400">matrices</span>.
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
            REAL fs-ga · Cl(3,0,1) screw motor · geometric product
          </span>
          <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>step</span>
              <span ref={frameLabel} className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>—</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>motor</span>
              <span ref={msLabel} className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD }}>—</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>points</span>
        {POINT_OPTS.map((p) => (
          <Pill key={p} onClick={() => setNPoints(p)} active={nPoints === p} ariaLabel={`${p} seed points`} disabled={!ready}>{p}</Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>screws</span>
        {STEP_OPTS.map((s) => (
          <Pill key={s} onClick={() => setSteps(s)} active={steps === s} color={VIOLET} ariaLabel={`${s} motor applications`} disabled={!ready}>{s}</Pill>
        ))}
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {nPoints} seed points swept by {steps} compositions of one screw motor · {(nPoints * steps).toLocaleString()} transformed points
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        Real <span className="text-slate-200">geometric algebra</span>. In projective GA{" "}
        <span style={{ color: VIOLET }}>Cl(3,0,1)</span>, a single <span className="text-slate-200">motor</span> encodes a rotation{" "}
        <em>and</em> a translation at once, a screw, and composes through the geometric product. The kernel applies that one motor
        over and over to a seed ring; each glowing ribbon is a point&apos;s helical orbit, and the bright ring is the current copy
        sweeping the screw. No matrices and no gimbal lock: one multivector does the work of an entire transform stack.
      </div>
    </SyncContainer>
  );
}
