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
  { kind: 0, label: "Blend" },
  { kind: 1, label: "Carve" },
  { kind: 2, label: "Intersect" },
];
const RES_OPTS = [40, 48, 64];
const MORPH_SECONDS = 7.0; // t: 0 → 1 → 0 loop
const RECOMPUTE_MS = 70; // throttle kernel re-sampling

const VERT = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position; // box spans [-1,1]
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
out vec4 outColor;
varying vec3 vLocal;
uniform highp sampler3D uVol;
uniform vec3 uCam;
uniform float uRes;
uniform float uTime;

float map(vec3 p) { return texture(uVol, p * 0.5 + 0.5).r; }

vec3 gradN(vec3 p) {
  float e = 2.0 / uRes;
  vec2 h = vec2(e, 0.0);
  return normalize(vec3(
    map(p + h.xyy) - map(p - h.xyy),
    map(p + h.yxy) - map(p - h.yxy),
    map(p + h.yyx) - map(p - h.yyx)
  ));
}

float softShadow(vec3 p, vec3 L) {
  float res = 1.0;
  float t = 0.03;
  for (int i = 0; i < 20; i++) {
    vec3 q = p + L * t;
    if (any(greaterThan(abs(q), vec3(1.0)))) break;
    float d = map(q);
    if (d < 0.001) return 0.0;
    res = min(res, 14.0 * d / t);
    t += clamp(d, 0.02, 0.18);
    if (t > 2.2) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ao(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.03 * float(i);
    float d = map(p + n * h);
    occ += (h - d) * sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 1.4 * occ, 0.0, 1.0);
}

void main() {
  vec3 ro = uCam;
  vec3 rd = normalize(vLocal - uCam);
  vec3 inv = 1.0 / rd;
  vec3 ta = (vec3(-1.0) - ro) * inv;
  vec3 tb = (vec3(1.0) - ro) * inv;
  vec3 t1 = min(ta, tb);
  vec3 t2 = max(ta, tb);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);
  if (tFar < max(tNear, 0.0)) discard;

  float t = max(tNear, 0.0) + 0.001;
  float hit = -1.0;
  for (int i = 0; i < 176; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.0016) { hit = t; break; }
    t += max(d * 0.82, 0.0035);
    if (t > tFar) break;
  }
  if (hit < 0.0) discard;

  vec3 p = ro + rd * hit;
  vec3 n = gradN(p);
  vec3 L = normalize(vec3(0.55, 0.75, 0.45));
  float diff = max(dot(n, L), 0.0);
  float sh = softShadow(p + n * 0.012, L);
  float aof = ao(p, n);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 40.0) * sh;

  vec3 deep = vec3(0.02, 0.30, 0.42);
  vec3 lit = vec3(0.10, 0.82, 0.96);
  vec3 base = mix(deep, lit, 0.5 + 0.5 * n.y);
  vec3 col = base * (0.16 * aof + diff * sh * 1.15);
  col += spec * vec3(0.9, 1.0, 1.0);
  col += fres * vec3(0.35, 0.9, 1.05) * (1.1 + 0.3 * sin(uTime * 2.0));
  col += vec3(0.02, 0.10, 0.14) * aof; // translucent interior glow

  // punchy tonemap + gamma
  col = col / (col + vec3(0.72));
  col = pow(col, vec3(0.4545));
  outColor = vec4(col, 1.0);
}
`;

interface GL {
  THREE: typeof THREE_NS;
  renderer: THREE_NS.WebGLRenderer;
  scene: THREE_NS.Scene;
  camera: THREE_NS.PerspectiveCamera;
  mesh: THREE_NS.Mesh;
  material: THREE_NS.ShaderMaterial;
  tex: THREE_NS.Data3DTexture | null;
  ro: ResizeObserver | null;
  raf: number | null;
}

export default function SdfRaymarch() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inViewRef } = useInView<HTMLDivElement>();

  const [kind, setKind] = useState(0);
  const [res, setRes] = useState(48);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glReady, setGlReady] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<GL | null>(null);

  const kindRef = useRef(0);
  const resRef = useRef(48);
  const reducedRef = useRef(false);
  const clockRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const lastComputeRef = useRef(0);
  const inflightRef = useRef(false);
  const dirtyRef = useRef(true); // force a recompute (kind/res change)

  const tLabel = useRef<HTMLSpanElement>(null);
  const msLabel = useRef<HTMLSpanElement>(null);

  kindRef.current = kind;
  resRef.current = res;
  reducedRef.current = reduced;

  /* -- one call to the kernel → upload the SDF volume as a 3D texture -- */
  const sampleVolume = useCallback(
    async (t: number) => {
      const gl = glRef.current;
      if (!gl || inflightRef.current) return;
      inflightRef.current = true;
      const r = resRef.current;
      const k = kindRef.current;
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("sdf_volume", r, k, t);
        const ms = performance.now() - t0;
        const cur = glRef.current;
        if (!cur) return;
        const { THREE } = cur;
        const n = r * r * r;
        let tex = cur.tex;
        if (!tex || tex.image.width !== r) {
          if (tex) tex.dispose();
          const half = new Uint16Array(n);
          tex = new THREE.Data3DTexture(half, r, r, r);
          tex.format = THREE.RedFormat;
          tex.type = THREE.HalfFloatType;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
          tex.unpackAlignment = 1;
          cur.tex = tex;
          cur.material.uniforms.uVol.value = tex;
          cur.material.uniforms.uRes.value = r;
        }
        const data = tex.image.data as Uint16Array;
        for (let i = 0; i < n; i++) data[i] = THREE.DataUtils.toHalfFloat(raw[i]);
        tex.needsUpdate = true;
        if (msLabel.current) msLabel.current.textContent = `${ms.toFixed(1)} ms`;
        if (tLabel.current) tLabel.current.textContent = t.toFixed(2);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        inflightRef.current = false;
      }
    },
    [call],
  );

  /* -- init Three.js once -- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const THREE = await import("three");
      const mount = mountRef.current;
      if (cancelled || !mount) return;

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(dpr());
      renderer.setSize(mount.clientWidth || 640, mount.clientHeight || 420, false);
      renderer.setClearColor(0x04090d, 1);
      // float-texture linear filtering fallback path is avoided via HalfFloat
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, (mount.clientWidth || 640) / (mount.clientHeight || 420), 0.05, 100);
      camera.position.set(0, 0, 3.0);

      const material = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        transparent: true,
        side: THREE.BackSide, // fragment = far face; we ray-box internally
        depthWrite: false,
        uniforms: {
          uVol: { value: null },
          uCam: { value: new THREE.Vector3(0, 0, 3) },
          uRes: { value: resRef.current },
          uTime: { value: 0 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });
      const geo = new THREE.BoxGeometry(2, 2, 2);
      const mesh = new THREE.Mesh(geo, material);
      scene.add(mesh);

      if (cancelled) {
        geo.dispose();
        material.dispose();
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

      glRef.current = { THREE, renderer, scene, camera, mesh, material, tex: null, ro, raf: null };
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
        gl.tex?.dispose();
        gl.renderer.dispose();
        gl.renderer.domElement.remove();
      }
      glRef.current = null;
    };
  }, []);

  /* -- kind / res change → recompute from scratch -- */
  useEffect(() => {
    if (!ready || !glReady) return;
    setError(null);
    setComputing(true);
    dirtyRef.current = true;
    clockRef.current = 0;
    lastComputeRef.current = 0;
    const t = reducedRef.current ? 0.42 : 0;
    sampleVolume(t).finally(() => setComputing(false));
  }, [ready, glReady, kind, res, sampleVolume]);

  /* -- render loop (orbit + throttled morph) -- */
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

      const R = 2.85;
      let ang: number, el: number;
      if (reducedRef.current) {
        ang = 0.7;
        el = 0.35;
      } else {
        ang = clockRef.current * 0.32;
        el = 0.35 + 0.22 * Math.sin(clockRef.current * 0.21);
      }
      const cam = gl.camera.position;
      cam.set(Math.cos(ang) * R, Math.sin(el) * R * 0.55, Math.sin(ang) * R);
      gl.camera.lookAt(0, 0, 0);
      gl.material.uniforms.uCam.value.copy(cam);
      gl.material.uniforms.uTime.value = clockRef.current;

      // throttled CSG morph — recompute the volume as t sweeps
      if (!reducedRef.current) {
        const now = performance.now();
        if (!inflightRef.current && now - lastComputeRef.current > RECOMPUTE_MS) {
          lastComputeRef.current = now;
          const phase = (clockRef.current % MORPH_SECONDS) / MORPH_SECONDS;
          const t = phase < 0.5 ? phase * 2 : 2 - phase * 2; // ping-pong 0..1
          void sampleVolume(t);
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
  }, [glReady, sampleVolume, inViewRef]);

  const voxels = res * res * res;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Frontier 02 · fs-math F-rep</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Geometry as a <span className="text-cyan-400">field</span>.
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
            REAL fs-math SDF · {res}³ field · GPU sphere-trace
          </span>
          <div className="w-fit rounded-lg border px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>morph t</span>
              <span ref={tLabel} className="font-mono text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>—</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>sample</span>
              <span ref={msLabel} className="font-mono text-[11px] font-bold tabular-nums" style={{ color: EMERALD }}>—</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>CSG</span>
        {KINDS.map((k) => (
          <Pill key={k.kind} onClick={() => setKind(k.kind)} active={kind === k.kind} ariaLabel={`CSG mode ${k.label}`} disabled={!ready}>
            {k.label}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>res</span>
        {RES_OPTS.map((r) => (
          <Pill key={r} onClick={() => setRes(r)} active={res === r} color={VIOLET} ariaLabel={`Volume resolution ${r} cubed`} disabled={!ready}>
            {r}³
          </Pill>
        ))}
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {voxels.toLocaleString()} signed distances · trilinear 3D texture · 176-step sphere-trace on the GPU
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        The kernel evaluates a real <span className="text-slate-200">signed-distance field</span>, an{" "}
        <span style={{ color: VIOLET }}>F-rep chart of a region</span> built from CSG algebra (smooth union, difference,
        intersection), on a {res}³ grid, then ships it to your GPU as a 3D texture. The fragment shader{" "}
        <span className="text-slate-200">sphere-traces</span> that volume to its zero level set, reads surface normals from the
        SDF gradient, and adds soft shadows and ambient occlusion. As the shapes morph the kernel re-samples the field, so this is
        geometry that lives as math rather than triangles.
      </div>
    </SyncContainer>
  );
}
