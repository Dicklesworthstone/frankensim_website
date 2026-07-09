"use client";

/**
 * Campaign 04 — schedule_campaign(windtunnel_latency, design_b_mean, stop_threshold)
 * · fs-schedule-e2e (fs-tropical × fs-voi)
 * "When it finishes is a longest path. Whether to continue is a wager."
 *
 * A five-study design campaign laid out as a fixed precedence DAG. WHEN the project
 * finishes is the makespan — the longest weighted path through the DAG, computed
 * EXACTLY in the max-plus (tropical) semiring (fs-tropical). At the default it is the
 * integer 13, on the critical path windtunnel-A → decide, and every off-path task
 * carries a certified slack (its float). Drag windtunnel_latency and the critical
 * path visibly re-routes: shrink it and the bottleneck jumps to hifi-B, the emerald
 * spine snapping from the top diagonal to the central chain.
 *
 * Separately, WHETHER to keep spending is a value-of-information decision (fs-voi):
 * the EVPI of one more experiment vs the stop_threshold, with a top-two ranking
 * flip-risk. The verdict is a single chip — Act (sample-B) or Stop.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView, useEasedText } from "@/lib/use-viz-anim";
import {
  BG,
  SURFACE,
  BORDER,
  CYAN,
  CYAN_GLOW,
  VIOLET,
  EMERALD,
  AMBER,
  ROSE,
  MUTED,
  BRIGHT,
  dpr,
  hexRgb,
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Slider,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/deep/_chrome";

/* Fixed DAG topology — the scenario is a structural constant (like the study
   names); every VALUE below (latencies, slacks, makespan, the critical path,
   the VoI scalars) is live wasm output. Node layout is left-to-right by
   dependency depth; node 0 / 1 / 4 share the mid line so the 0→1→4 path draws
   as a clean spine when windtunnel_latency is small. */
const COLX = [0.13, 0.44, 0.75];
const NODES: { name: string; xf: number; yf: number }[] = [
  { name: "surrogate-B", xf: COLX[0], yf: 0.5 }, // 0
  { name: "hifi-B", xf: COLX[1], yf: 0.5 }, // 1
  { name: "sample-scenarios", xf: COLX[0], yf: 0.85 }, // 2
  { name: "windtunnel-A", xf: COLX[0], yf: 0.15 }, // 3
  { name: "decide", xf: COLX[2], yf: 0.5 }, // 4
];
const EDGES: [number, number][] = [
  [0, 1],
  [1, 4],
  [2, 4],
  [3, 4],
];
const DESIGN_NAMES = ["A", "B", "C"];
const L_REF = 15; // windtunnel_latency max → node-radius reference scale

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

interface SchedData {
  makespan: number;
  lo: number;
  hi: number;
  n: number;
  p: number;
  bottleneck: number;
  evpi: number;
  flipRisk: number;
  shouldStop: boolean;
  leadingIdx: number;
  act: boolean; // rec_code 0 = Act
  valuePerCost: number;
  latencies: number[];
  slacks: number[];
  path: number[]; // study indices, source → sink
  critSet: Set<string>; // "a-b" critical edges
  critNodes: Set<number>;
  ms: number;
}

function decode(raw: Float64Array, ms: number): SchedData {
  const n = Math.round(raw[3]);
  const p = Math.round(raw[4]);
  const latencies: number[] = [];
  const slacks: number[] = [];
  for (let i = 0; i < n; i++) latencies.push(raw[12 + i]);
  for (let i = 0; i < n; i++) slacks.push(raw[12 + n + i]);
  const path: number[] = [];
  for (let i = 0; i < p; i++) path.push(Math.round(raw[12 + 2 * n + i]));
  const critSet = new Set<string>();
  const critNodes = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    critNodes.add(path[i]);
    if (i + 1 < path.length) critSet.add(`${path[i]}-${path[i + 1]}`);
  }
  return {
    makespan: raw[0],
    lo: raw[1],
    hi: raw[2],
    n,
    p,
    bottleneck: Math.round(raw[5]),
    evpi: raw[6],
    flipRisk: raw[7],
    shouldStop: raw[8] > 0.5,
    leadingIdx: Math.round(raw[9]),
    act: raw[10] < 0.5,
    valuePerCost: raw[11],
    latencies,
    slacks,
    path,
    critSet,
    critNodes,
    ms,
  };
}

export default function ScheduleCriticalPath() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [windtunnel, setWindtunnel] = useState(12);
  const [designB, setDesignB] = useState(0.65);
  const [stopThr, setStopThr] = useState(0.001);
  const [data, setData] = useState<SchedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<SchedData | null>(null);
  dataRef.current = data;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  const makespanRef = useEasedText<HTMLSpanElement>(data?.makespan ?? 0, reduced, (v) => String(Math.round(v)), {
    enabled: !!data,
    inViewRef,
  });
  const evpiRef = useEasedText<HTMLSpanElement>(data?.evpi ?? 0, reduced, (v) => v.toFixed(3), {
    enabled: !!data,
    inViewRef,
  });
  const flipRef = useEasedText<HTMLSpanElement>(data ? data.flipRisk * 100 : 0, reduced, (v) => `${v.toFixed(0)}%`, {
    enabled: !!data,
    inViewRef,
  });

  /* -- compute (latest-wins, debounced; the kernel is cheap) -- */
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const token = ++tokenRef.current;
      setComputing(true);
      setError(null);
      (async () => {
        try {
          const t0 = performance.now();
          const raw = await call<Float64Array>("schedule_campaign", windtunnel, designB, stopThr);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          setData(decode(raw, ms));
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 120);
    return () => clearTimeout(id);
  }, [ready, windtunnel, designB, stopThr, call]);

  /* -- draw the DAG at a given critical-path reveal -- */
  const draw = useCallback((reveal: number, time: number) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    if (!d) return;
    const rm = reducedRef.current;

    const padL = W * 0.05;
    const padR = W * 0.05;
    const padT = H * 0.13;
    const padB = H * 0.17;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const px = (xf: number) => padL + xf * plotW;
    const py = (yf: number) => padT + yf * plotH;
    const unit = Math.min(W, H);
    const rMin = unit * 0.03;
    const rMax = unit * 0.082;
    const rOf = (lat: number) => rMin + (rMax - rMin) * Math.min(1, lat / L_REF);
    const fs = Math.max(8, W / 52);

    const cx = NODES.map((nd) => px(nd.xf));
    const cy = NODES.map((nd) => py(nd.yf));
    const rad = d.latencies.map(rOf);

    // faint column guides
    ctx.strokeStyle = "rgba(148,163,184,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const xf of COLX) {
      ctx.moveTo(px(xf), padT * 0.5);
      ctx.lineTo(px(xf), H - padB * 0.55);
    }
    ctx.stroke();

    // edge geometry: boundary→boundary cubic bezier, mostly horizontal flow
    const edgeGeom = (a: number, b: number) => {
      const ax = cx[a];
      const ay = cy[a];
      const bx = cx[b];
      const by = cy[b];
      const ang = Math.atan2(by - ay, bx - ax);
      const sx = ax + Math.cos(ang) * rad[a];
      const sy = ay + Math.sin(ang) * rad[a];
      const ex = bx - Math.cos(ang) * rad[b];
      const ey = by - Math.sin(ang) * rad[b];
      const dx = (ex - sx) * 0.5;
      return { sx, sy, ex, ey, c1x: sx + dx, c1y: sy, c2x: ex - dx, c2y: ey };
    };
    const bez = (g: ReturnType<typeof edgeGeom>, t: number): [number, number] => {
      const u = 1 - t;
      const x = u * u * u * g.sx + 3 * u * u * t * g.c1x + 3 * u * t * t * g.c2x + t * t * t * g.ex;
      const y = u * u * u * g.sy + 3 * u * u * t * g.c1y + 3 * u * t * t * g.c2y + t * t * t * g.ey;
      return [x, y];
    };

    // 1) non-critical edges (behind)
    for (const [a, b] of EDGES) {
      if (d.critSet.has(`${a}-${b}`)) continue;
      const g = edgeGeom(a, b);
      ctx.beginPath();
      ctx.moveTo(g.sx, g.sy);
      ctx.bezierCurveTo(g.c1x, g.c1y, g.c2x, g.c2y, g.ex, g.ey);
      ctx.strokeStyle = "rgba(148,163,184,0.28)";
      ctx.lineWidth = Math.max(1, W / 520);
      ctx.stroke();
      // arrowhead
      const [hx, hy] = bez(g, 0.94);
      const aang = Math.atan2(g.ey - hy, g.ex - hx);
      const ah = Math.max(4, W / 150);
      ctx.beginPath();
      ctx.moveTo(g.ex, g.ey);
      ctx.lineTo(g.ex - ah * Math.cos(aang - 0.4), g.ey - ah * Math.sin(aang - 0.4));
      ctx.lineTo(g.ex - ah * Math.cos(aang + 0.4), g.ey - ah * Math.sin(aang + 0.4));
      ctx.closePath();
      ctx.fillStyle = "rgba(148,163,184,0.4)";
      ctx.fill();
    }

    // 2) critical path edges (emerald, drawn in source→sink with reveal)
    const critEdges: [number, number][] = [];
    for (let i = 0; i + 1 < d.path.length; i++) critEdges.push([d.path[i], d.path[i + 1]]);
    const nE = Math.max(1, critEdges.length);
    for (let i = 0; i < critEdges.length; i++) {
      const [a, b] = critEdges[i];
      const g = edgeGeom(a, b);
      const local = Math.max(0, Math.min(1, (reveal - i / nE) * nE));
      if (local <= 0) continue;
      const SEG = 26;
      ctx.beginPath();
      ctx.moveTo(g.sx, g.sy);
      for (let s = 1; s <= SEG; s++) {
        const t = (s / SEG) * local;
        const [x, y] = bez(g, t);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(EMERALD, 0.95);
      ctx.lineWidth = Math.max(2.4, W / 200);
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = W / 60;
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (local >= 1) {
        const ah = Math.max(5, W / 120);
        const [hx, hy] = bez(g, 0.9);
        const aang = Math.atan2(g.ey - hy, g.ex - hx);
        ctx.beginPath();
        ctx.moveTo(g.ex, g.ey);
        ctx.lineTo(g.ex - ah * Math.cos(aang - 0.42), g.ey - ah * Math.sin(aang - 0.42));
        ctx.lineTo(g.ex - ah * Math.cos(aang + 0.42), g.ey - ah * Math.sin(aang + 0.42));
        ctx.closePath();
        ctx.fillStyle = EMERALD;
        ctx.fill();
      }
    }

    // 3) traveling pulse along the fully-revealed critical spine
    if (!rm && reveal >= 0.999 && critEdges.length > 0) {
      const frac = (time * 0.00035) % 1;
      const seg = Math.min(critEdges.length - 1, Math.floor(frac * critEdges.length));
      const localT = frac * critEdges.length - seg;
      const g = edgeGeom(critEdges[seg][0], critEdges[seg][1]);
      const [x, y] = bez(g, localT);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, W / 190), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(209,250,229,0.95)";
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = W / 42;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 4) slack float bars beneath off-path nodes
    const maxSlack = Math.max(1e-9, ...d.slacks);
    ctx.font = `${Math.max(7, W / 68)}px ui-monospace, monospace`;
    for (let i = 0; i < NODES.length; i++) {
      const slk = d.slacks[i];
      if (d.critNodes.has(i) || slk <= 1e-9) continue;
      const barMax = plotW * 0.11;
      const bw = (slk / maxSlack) * barMax;
      const bx = cx[i] - barMax / 2;
      const byy = cy[i] + rad[i] + Math.max(12, W / 40);
      const bh = Math.max(2.5, W / 300);
      ctx.fillStyle = "rgba(148,163,184,0.16)";
      ctx.fillRect(bx, byy, barMax, bh);
      ctx.fillStyle = rgba(AMBER, 0.7);
      ctx.fillRect(bx, byy, bw, bh);
      ctx.fillStyle = rgba(AMBER, 0.85);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`float ${slk % 1 === 0 ? slk : slk.toFixed(1)}`, cx[i], byy + bh + 2);
    }

    // 5) nodes
    for (let i = 0; i < NODES.length; i++) {
      const onCrit = d.critNodes.has(i);
      const isBott = i === d.bottleneck;
      const col = onCrit ? EMERALD : CYAN_GLOW;
      const r = rad[i];

      // bottleneck pulsing ring
      if (isBott && d.bottleneck >= 0) {
        const pulse = rm ? 1 : 0.72 + 0.28 * Math.sin(time * 0.005);
        ctx.beginPath();
        ctx.arc(cx[i], cy[i], r + Math.max(4, W / 150) * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(EMERALD, 0.8);
        ctx.lineWidth = Math.max(1.4, W / 320);
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = (W / 70) * pulse;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // glass disc
      const grd = ctx.createRadialGradient(cx[i], cy[i] - r * 0.3, r * 0.1, cx[i], cy[i], r);
      grd.addColorStop(0, rgba(col, onCrit ? 0.34 : 0.2));
      grd.addColorStop(1, "rgba(8,19,26,0.92)");
      ctx.beginPath();
      ctx.arc(cx[i], cy[i], r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.lineWidth = Math.max(1.4, W / 340);
      ctx.strokeStyle = onCrit ? rgba(EMERALD, 0.95) : rgba(CYAN, 0.55);
      if (onCrit) {
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = W / 90;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // latency number inside
      ctx.fillStyle = onCrit ? "#d1fae5" : BRIGHT;
      ctx.font = `700 ${Math.max(10, r * 0.72)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lat = d.latencies[i];
      ctx.fillText(lat % 1 === 0 ? String(lat) : lat.toFixed(1), cx[i], cy[i]);

      // name label above
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.fillStyle = onCrit ? rgba(EMERALD, 0.95) : MUTED;
      ctx.textBaseline = "bottom";
      ctx.fillText(NODES[i].name, cx[i], cy[i] - r - Math.max(4, W / 150));
    }

    // 6) axis hint
    ctx.fillStyle = "rgba(148,163,184,0.55)";
    ctx.font = `${Math.max(7, W / 64)}px ui-monospace, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("precedence  →  time", padL, H - padB * 0.14);
  }, []);

  /* -- DPR sizing + redraw -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const d = dpr();
      const cssW = canvas.clientWidth || 480;
      const w = Math.max(240, Math.min(1100, Math.round(cssW * d)));
      const h = Math.round(w * 0.6);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
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

  /* -- reveal the critical path on each fresh solve -- */
  useEffect(() => {
    if (!data) return;
    if (!seenRef.current) seenRef.current = true;
    revealStartRef.current = performance.now();
    revealRef.current = 0;
  }, [data]);

  /* -- animation loop (gated by view + reduced-motion) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      draw(1, 0);
      return;
    }
    const DUR = 1050;
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      if (revealStartRef.current !== null) {
        const t = Math.min((now - revealStartRef.current) / DUR, 1);
        revealRef.current = 1 - Math.pow(1 - t, 3);
        if (t >= 1) revealStartRef.current = null;
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
  }, [data, inView, reduced, inViewRef, draw]);

  const verified = !!data && data.lo === data.makespan && data.hi === data.makespan;
  const bottleneckName = data && data.bottleneck >= 0 ? NODES[data.bottleneck]?.name : null;
  const leadingName = data && data.leadingIdx >= 0 ? DESIGN_NAMES[data.leadingIdx] : null;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 04 · fs-schedule-e2e · tropical × VoI</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            The finish date is a <span className="text-emerald-400">longest path</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* DAG canvas */}
      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full"
          style={{ aspectRatio: "1 / 0.6" }}
          role="img"
          aria-label="A left-to-right schedule DAG of five studies; the critical path glows emerald with the bottleneck study pulsing, and off-path studies show their slack as a float bar"
        />
        <span
          className="pointer-events-none absolute left-3 top-3 w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
          style={{ borderColor: `${EMERALD}55`, background: `${BG}bb`, color: EMERALD }}
        >
          max-plus critical path
        </span>

        {/* makespan seal */}
        {data && (
          <div
            className="pointer-events-none absolute right-3 top-3 flex flex-col items-end rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm"
            style={{ borderColor: `${EMERALD}44`, background: "rgba(4,9,13,0.72)" }}
          >
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              makespan
            </span>
            <span
              className="font-mono text-[22px] font-black leading-none tabular-nums md:text-[26px]"
              style={{ color: "#d1fae5", textShadow: `0 0 14px ${EMERALD}88` }}
            >
              <span ref={makespanRef}>{Math.round(data.makespan)}</span>
            </span>
            <span
              className="mt-1 rounded-full border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em]"
              style={
                verified
                  ? { borderColor: `${EMERALD}88`, background: `${EMERALD}14`, color: EMERALD }
                  : { borderColor: `${AMBER}66`, background: `${AMBER}12`, color: AMBER }
              }
            >
              {verified ? `Verified · [${Math.round(data.lo)}, ${Math.round(data.hi)}]` : "interval"}
            </span>
          </div>
        )}

        {!ready && <BootOverlay />}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* Value-of-information decision panel */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${VIOLET}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            EVPI
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: VIOLET }}>
            <span ref={evpiRef}>{data ? data.evpi.toFixed(3) : "—"}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${AMBER}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            flip-risk
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: AMBER }}>
            <span ref={flipRef}>{data ? `${(data.flipRisk * 100).toFixed(0)}%` : "—"}</span>
          </div>
        </div>
        <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${CYAN}33`, background: "rgba(255,255,255,0.02)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            leading
          </div>
          <div className="font-mono text-[15px] font-black tabular-nums md:text-base" style={{ color: CYAN_GLOW }}>
            {leadingName ? `design ${leadingName}` : "—"}
          </div>
        </div>
        <div
          className="flex flex-col justify-center rounded-lg border px-2.5 py-2"
          style={
            data && !data.act
              ? { borderColor: `${AMBER}88`, background: `${AMBER}12` }
              : { borderColor: `${EMERALD}88`, background: `${EMERALD}12` }
          }
        >
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
            VoI verdict
          </div>
          <div
            className="font-mono text-[15px] font-black uppercase tracking-wide md:text-base"
            style={{ color: data && !data.act ? AMBER : EMERALD }}
          >
            {data ? (data.act ? "Act · sample-B" : "Stop") : "—"}
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-col gap-2.5">
        <Slider
          label="windtunnel-A"
          value={windtunnel}
          min={5}
          max={15}
          step={1}
          onChange={(v) => setWindtunnel(Math.round(v))}
          format={(v) => String(Math.round(v))}
          disabled={!ready}
        />
        <Slider
          label="design-B mean"
          value={designB}
          min={0.6}
          max={1.1}
          step={0.01}
          onChange={setDesignB}
          format={(v) => v.toFixed(2)}
          color={VIOLET}
          disabled={!ready}
        />
        <Slider
          label="stop θ"
          value={stopThr}
          min={0.001}
          max={0.1}
          step={0.001}
          onChange={setStopThr}
          format={(v) => v.toFixed(3)}
          color={AMBER}
          disabled={!ready}
        />
      </div>

      {/* readout */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {data ? (
          <>
            makespan <span style={{ color: EMERALD }}>{Math.round(data.makespan)}</span> · critical path{" "}
            <span style={{ color: EMERALD }}>{data.path.map((i) => NODES[i]?.name).join(" → ")}</span>
            {bottleneckName ? (
              <>
                {" "}
                <span style={{ color: MUTED }}>│</span> bottleneck{" "}
                <span style={{ color: EMERALD }}>{bottleneckName}</span>
              </>
            ) : null}{" "}
            <span style={{ color: MUTED }}>│</span> EVPI <span style={{ color: VIOLET }}>{data.evpi.toFixed(3)}</span> →{" "}
            <span style={{ color: data.act ? EMERALD : AMBER }}>
              {data.act ? `Act (v/cost ${Number.isFinite(data.valuePerCost) ? data.valuePerCost.toFixed(4) : "—"})` : "Stop"}
            </span>{" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(2)} ms in WASM</span>
          </>
        ) : (
          "solving the exact makespan in the max-plus semiring, then the value-of-information verdict…"
        )}
      </div>

      {/* caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        WHEN the campaign finishes is the <span className="text-slate-200">makespan</span> — the longest weighted path
        through the precedence DAG, computed <span style={{ color: EMERALD }}>exactly</span> in the max-plus (tropical)
        semiring by <span className="text-cyan-300">fs-tropical</span>. It is a certified{" "}
        <span style={{ color: EMERALD }}>integer</span> (lo = hi = makespan → <span className="text-slate-200">Verified</span>),
        with every off-path study carrying a real <span style={{ color: AMBER }}>slack</span>. Drag{" "}
        <span className="text-white">windtunnel-A</span> and the emerald{" "}
        <span style={{ color: EMERALD }}>critical path re-routes</span> — shrink it below hifi-B&apos;s chain and the
        bottleneck jumps from <span className="text-slate-200">windtunnel-A → decide</span> to the central{" "}
        <span className="text-slate-200">surrogate-B → hifi-B → decide</span> spine. WHETHER to keep spending is a separate{" "}
        <span style={{ color: VIOLET }}>value-of-information</span> decision (<span className="text-cyan-300">fs-voi</span>):
        the <span style={{ color: VIOLET }}>EVPI</span> of one more experiment against your stop threshold, with a top-two{" "}
        ranking <span style={{ color: AMBER }}>flip-risk</span> — resolved to a single{" "}
        <span style={{ color: ROSE }}>Act / Stop</span> verdict. Every number is compiled Rust, live in your tab.
      </div>
    </SyncContainer>
  );
}
