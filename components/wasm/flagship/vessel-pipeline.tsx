"use client";

/**
 * FLAGSHIP — LAMINAR-POUR VESSEL  ·  run_vessel(lip_x1000)  ·  fs-vessel-e2e
 * "A vessel shaped so its stream stays laminar — then rendered from the same certified bytes."
 *
 * One WASM call runs the entire end-to-end campaign and returns every stage packed into a
 * single Float64Array (len 21847 at the default lip). We decode it EXACTLY per the layout and
 * present the five stages of the campaign as a stepper over one large canvas:
 *
 *   1 PARAMETERIZE — the Chebyshev wall profile r(z), revolved into its carafe cross-section.
 *   2 STABILITY    — the Orr–Sommerfeld worst-eigenvalue growth along the pour path (nominal
 *                    vs off-nominal); below the zero line every disturbance mode decays.
 *   3 VALIDATION   — the real free-surface pour, ANIMATED from the sim's own mass frames, with
 *                    the mass ledger closing to ~1e-13.
 *   4 ROBUSTIFY    — the CVaR-vs-lip sweep; the robust lip trades a little mean to guard the tail.
 *   5 RENDER       — the HIGHLIGHT: the R×R transmittance buffer Woodcock-volume-traced into a
 *                    glowing volumetric render of the pour. The marketing shot and the physics
 *                    are the same certified bytes.
 *
 * The kernel is fast (~0.06 s), so releasing the lip slider re-runs the whole campaign; stepping
 * between stages only re-draws a different decoded block (no recompute).
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
  ROSE,
  TEAL,
  MUTED,
  BRIGHT,
  dpr,
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Slider,
  Pill,
  ErrorNote,
  BootOverlay,
  hexRgb,
} from "@/components/wasm/deep/_chrome";

/* ------------------------------------------------------------------ */
/*  Decoded campaign                                                   */
/* ------------------------------------------------------------------ */

interface VesselData {
  P: number;
  S: number;
  M: number;
  nx: number;
  ny: number;
  F: number;
  R: number;
  L: number;
  B: number;
  growthMinmax: number;
  growthOffnom: number;
  massResidual: number;
  pouredMass: number;
  contactPoured: number;
  contactDribble: number;
  fragments: number;
  cvarRobustOff: number;
  cvarNominalOff: number;
  profile: Float64Array; // 2*P  [z, r]
  gNom: Float64Array; // S
  gOff: Float64Array; // S
  frames: Float64Array; // F*nx*ny
  cvar: Float64Array; // 3*L  [lip, nom, cvar]
  band: Float64Array; // B
  render: Float64Array; // R*R transmittance ∈ [0,1]
  robustLip: number;
  nominalLip: number;
  beta: number;
  // precomputed extents
  zMin: number;
  zMax: number;
  rMax: number;
  growthAbs: number;
  frameMax: number;
  lipMin: number;
  lipMax: number;
  cvarYmin: number;
  cvarYmax: number;
  bandMin: number;
  bandMax: number;
  lip: number;
  ms: number;
  seq: number;
}

function decode(raw: Float64Array, lip: number, ms: number, seq: number): VesselData {
  const P = raw[1] | 0;
  const S = raw[2] | 0;
  const M = raw[3] | 0;
  const nx = raw[4] | 0;
  const ny = raw[5] | 0;
  const F = raw[6] | 0;
  const R = raw[7] | 0;
  const L = raw[8] | 0;
  const B = raw[9] | 0;

  let o = 20;
  const profile = raw.subarray(o, o + 2 * P);
  o += 2 * P;
  const gNom = raw.subarray(o, o + S);
  o += S;
  const gOff = raw.subarray(o, o + S);
  o += S;
  const frames = raw.subarray(o, o + F * nx * ny);
  o += F * nx * ny;
  const cvar = raw.subarray(o, o + 3 * L);
  o += 3 * L;
  const band = raw.subarray(o, o + B);
  o += B;
  const render = raw.subarray(o, o + R * R);
  o += R * R;
  const robustLip = raw[o];
  const nominalLip = raw[o + 1];
  const beta = raw[o + 2];

  // extents
  let zMin = Infinity;
  let zMax = -Infinity;
  let rMax = 1e-6;
  for (let p = 0; p < P; p++) {
    const z = profile[2 * p];
    const r = profile[2 * p + 1];
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
    if (r > rMax) rMax = r;
  }
  let growthAbs = 1e-6;
  for (let i = 0; i < S; i++) {
    growthAbs = Math.max(growthAbs, Math.abs(gNom[i]), Math.abs(gOff[i]));
  }
  growthAbs = Math.max(growthAbs, Math.abs(raw[10]), Math.abs(raw[11]));
  let frameMax = 1e-6;
  for (let i = 0; i < frames.length; i++) if (frames[i] > frameMax) frameMax = frames[i];
  let lipMin = Infinity;
  let lipMax = -Infinity;
  let cvarYmin = Infinity;
  let cvarYmax = -Infinity;
  for (let l = 0; l < L; l++) {
    const lp = cvar[3 * l];
    const nm = cvar[3 * l + 1];
    const cv = cvar[3 * l + 2];
    if (lp < lipMin) lipMin = lp;
    if (lp > lipMax) lipMax = lp;
    cvarYmin = Math.min(cvarYmin, nm, cv);
    cvarYmax = Math.max(cvarYmax, nm, cv);
  }
  let bandMin = Infinity;
  let bandMax = -Infinity;
  for (let i = 0; i < B; i++) {
    if (band[i] < bandMin) bandMin = band[i];
    if (band[i] > bandMax) bandMax = band[i];
  }

  return {
    P,
    S,
    M,
    nx,
    ny,
    F,
    R,
    L,
    B,
    growthMinmax: raw[10],
    growthOffnom: raw[11],
    massResidual: raw[12],
    pouredMass: raw[13],
    contactPoured: raw[14],
    contactDribble: raw[15],
    fragments: Math.round(raw[16]),
    cvarRobustOff: raw[17],
    cvarNominalOff: raw[18],
    profile,
    gNom,
    gOff,
    frames,
    cvar,
    band,
    render,
    robustLip,
    nominalLip,
    beta,
    zMin,
    zMax,
    rMax,
    growthAbs,
    frameMax,
    lipMin,
    lipMax,
    cvarYmin,
    cvarYmax,
    bandMin,
    bandMax,
    lip,
    ms,
    seq,
  };
}

/* ------------------------------------------------------------------ */
/*  Color ramps                                                        */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

function lerpStops(stops: [number, RGB][], t: number): RGB {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const k = b === a ? 0 : (x - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}

// The render ramp: transmittance opacity (1 − T) → glowing cyan/teal, dark at 0.
const RENDER_STOPS: [number, RGB][] = [
  [0.0, [3, 10, 16]],
  [0.14, [6, 46, 62]],
  [0.34, [10, 116, 142]],
  [0.55, [22, 182, 216]],
  [0.76, [96, 226, 246]],
  [0.9, [188, 248, 255]],
  [1.0, [242, 255, 255]],
];
const RENDER_LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = lerpStops(RENDER_STOPS, i / 255);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
})();

// The free-surface fluid ramp (deep teal → bright cyan).
const POUR_STOPS: [number, RGB][] = [
  [0.0, [4, 18, 32]],
  [0.28, [10, 74, 122]],
  [0.55, [26, 148, 208]],
  [0.82, [96, 214, 246]],
  [1.0, [188, 242, 255]],
];

function withA(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* ------------------------------------------------------------------ */
/*  Offscreen-buffer helper                                            */
/* ------------------------------------------------------------------ */

interface Buf {
  canvas: HTMLCanvasElement;
  img: ImageData;
  w: number;
  h: number;
}

function ensureBuf(ref: { current: Buf | null }, w: number, h: number): Buf | null {
  if (typeof document === "undefined") return null;
  let buf = ref.current;
  if (!buf || buf.w !== w || buf.h !== h) {
    const canvas = buf?.canvas ?? document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    buf = { canvas, img: ctx.createImageData(w, h), w, h };
    ref.current = buf;
  }
  return buf;
}

/* ------------------------------------------------------------------ */
/*  Stage metadata                                                     */
/* ------------------------------------------------------------------ */

interface StageDef {
  name: string;
  sub: string;
  color: string;
}
const STAGES: StageDef[] = [
  { name: "Parameterize", sub: "Chebyshev profile", color: CYAN_GLOW },
  { name: "Stability", sub: "Orr–Sommerfeld", color: EMERALD },
  { name: "Validation", sub: "Free-surface pour", color: TEAL },
  { name: "Robustify", sub: "CVaR", color: VIOLET },
  { name: "Render", sub: "Woodcock volume", color: CYAN_GLOW },
];

/* ------------------------------------------------------------------ */
/*  Canvas painters (pure; read only their arguments)                  */
/* ------------------------------------------------------------------ */

function paintBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, Math.max(0.1, W * 0.04), W * 0.5, H * 0.5, Math.max(0.1, W * 0.7));
  g.addColorStop(0, "rgba(8,40,52,0.5)");
  g.addColorStop(1, "rgba(3,7,11,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, strength = 0.5) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.max(0.1, Math.min(W, H) * 0.32), W / 2, H / 2, Math.max(0.1, Math.max(W, H) * 0.72));
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* -- Stage 1: revolved carafe silhouette ------------------------------------ */
function drawProfile(ctx: CanvasRenderingContext2D, W: number, H: number, d: VesselData) {
  const P = d.P;
  const worldW = 2 * d.rMax;
  const worldH = Math.max(1e-6, d.zMax - d.zMin);
  const s = Math.min((W * 0.6) / worldW, (H * 0.74) / worldH);
  const cx = W * 0.5;
  const topY = H * 0.5 - (worldH * s) / 2;
  const yFor = (z: number) => topY + (z - d.zMin) * s;
  const xFor = (r: number, side: number) => cx + side * r * s;
  const rAt = (p: number) => d.profile[2 * p + 1];
  const zAt = (p: number) => d.profile[2 * p];

  // silhouette polygon
  ctx.beginPath();
  for (let p = 0; p < P; p++) {
    const x = xFor(rAt(p), -1);
    const y = yFor(zAt(p));
    if (p === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let p = P - 1; p >= 0; p--) ctx.lineTo(xFor(rAt(p), 1), yFor(zAt(p)));
  ctx.closePath();

  // glass fill
  const fill = ctx.createLinearGradient(0, topY, 0, topY + worldH * s);
  fill.addColorStop(0, "rgba(34,211,238,0.16)");
  fill.addColorStop(0.5, "rgba(20,184,166,0.1)");
  fill.addColorStop(1, "rgba(6,182,212,0.2)");
  ctx.fillStyle = fill;
  ctx.fill();

  // fluid resting near the lip (z high = bottom)
  const zLevel = d.zMin + 0.55 * worldH;
  ctx.save();
  ctx.clip();
  const fy = yFor(zLevel);
  const fg = ctx.createLinearGradient(0, fy, 0, topY + worldH * s);
  fg.addColorStop(0, "rgba(34,197,238,0.28)");
  fg.addColorStop(1, "rgba(12,110,180,0.5)");
  ctx.fillStyle = fg;
  ctx.fillRect(cx - d.rMax * s - 4, fy, 2 * d.rMax * s + 8, topY + worldH * s - fy + 4);
  ctx.restore();

  // wall stroke with cyan glow
  ctx.beginPath();
  for (let p = 0; p < P; p++) {
    const x = xFor(rAt(p), -1);
    const y = yFor(zAt(p));
    if (p === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let p = P - 1; p >= 0; p--) ctx.lineTo(xFor(rAt(p), 1), yFor(zAt(p)));
  ctx.closePath();
  ctx.strokeStyle = withA(CYAN_GLOW, 0.32);
  ctx.lineWidth = Math.max(2.4, W / 150);
  ctx.shadowColor = CYAN_GLOW;
  ctx.shadowBlur = W / 60;
  ctx.stroke();
  ctx.strokeStyle = "rgba(210,250,255,0.95)";
  ctx.lineWidth = Math.max(1, W / 360);
  ctx.shadowBlur = 0;
  ctx.stroke();

  // rim ellipses (top opening + lip) sell the revolve
  const rim = (p: number, bright: number) => {
    const r = rAt(p);
    const y = yFor(zAt(p));
    ctx.beginPath();
    ctx.ellipse(cx, y, Math.max(0.1, r * s), Math.max(0.1, r * s * 0.17), 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180,244,255,${bright})`;
    ctx.lineWidth = Math.max(1, W / 340);
    ctx.stroke();
  };
  rim(0, 0.85);
  rim(P - 1, 0.6);

  // fluid free surface ellipse
  ctx.beginPath();
  const rLevel = (() => {
    // r at the fill level: nearest profile point to zLevel
    let best = 0;
    let bd = Infinity;
    for (let p = 0; p < P; p++) {
      const dz = Math.abs(zAt(p) - zLevel);
      if (dz < bd) {
        bd = dz;
        best = p;
      }
    }
    return rAt(best);
  })();
  ctx.ellipse(cx, fy, Math.max(0.1, rLevel * s), Math.max(0.1, rLevel * s * 0.16), 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(120,224,255,0.7)";
  ctx.lineWidth = Math.max(1, W / 380);
  ctx.stroke();

  // station ticks along the pour path
  ctx.strokeStyle = withA(CYAN, 0.5);
  ctx.fillStyle = withA(CYAN, 0.55);
  ctx.lineWidth = Math.max(1, W / 460);
  for (let k = 0; k < d.S; k++) {
    const z = d.zMin + (k / (d.S - 1)) * worldH;
    let best = 0;
    let bd = Infinity;
    for (let p = 0; p < P; p++) {
      const dz = Math.abs(zAt(p) - z);
      if (dz < bd) {
        bd = dz;
        best = p;
      }
    }
    const x = xFor(rAt(best), 1);
    const y = yFor(z);
    ctx.beginPath();
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 3 + W / 46, y);
    ctx.stroke();
  }

  // lip marker + label + droplets
  const lipY = yFor(d.zMax);
  const lipR = rAt(P - 1);
  const lx = cx;
  ctx.beginPath();
  ctx.arc(lx, lipY, Math.max(0.1, W / 150), 0, Math.PI * 2);
  ctx.fillStyle = AMBER;
  ctx.shadowColor = AMBER;
  ctx.shadowBlur = W / 40;
  ctx.fill();
  ctx.shadowBlur = 0;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(lx, lipY + (W / 26) * (i + 1), Math.max(0.1, (W / 260) * (3 - i)), 0, Math.PI * 2);
    ctx.fillStyle = withA(CYAN_GLOW, 0.55 - i * 0.14);
    ctx.fill();
  }
  ctx.font = `${Math.max(9, W / 46)}px ui-monospace, monospace`;
  ctx.fillStyle = AMBER;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("lip", lx + lipR * s + W / 60, lipY);

  // axis caps
  ctx.fillStyle = withA(MUTED, 0.7);
  ctx.font = `${Math.max(8, W / 52)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("r(z)  ·  revolved profile", cx, topY - H * 0.02);
  ctx.save();
  ctx.translate(cx - d.rMax * s - W * 0.05, H * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText("z  ·  pour axis", 0, 0);
  ctx.restore();
}

/* -- Stage 2: growth curves along the pour path ----------------------------- */
function drawStability(ctx: CanvasRenderingContext2D, W: number, H: number, d: VesselData) {
  const padL = W * 0.13;
  const padR = W * 0.06;
  const padT = H * 0.15;
  const padB = H * 0.16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const S = d.S;
  const yMax = d.growthAbs * 1.18;
  const X = (i: number) => padL + (S <= 1 ? 0.5 : i / (S - 1)) * plotW;
  const Y = (v: number) => padT + (1 - (v + yMax) / (2 * yMax)) * plotH;

  // laminar / turbulent field shading
  const y0 = Y(0);
  ctx.fillStyle = "rgba(16,185,129,0.07)";
  ctx.fillRect(padL, y0, plotW, padT + plotH - y0);
  ctx.fillStyle = "rgba(244,63,94,0.06)";
  ctx.fillRect(padL, padT, plotW, y0 - padT);

  // gridlines
  ctx.strokeStyle = "rgba(148,163,184,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 0; g <= 4; g++) {
    const gy = padT + (plotH * g) / 4;
    ctx.moveTo(padL, gy);
    ctx.lineTo(padL + plotW, gy);
  }
  ctx.stroke();

  // band between nominal and off-nominal
  ctx.beginPath();
  for (let i = 0; i < S; i++) {
    const x = X(i);
    const y = Y(d.gNom[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = S - 1; i >= 0; i--) ctx.lineTo(X(i), Y(d.gOff[i]));
  ctx.closePath();
  ctx.fillStyle = "rgba(20,184,166,0.16)";
  ctx.fill();

  // zero line
  ctx.beginPath();
  ctx.moveTo(padL, y0);
  ctx.lineTo(padL + plotW, y0);
  ctx.setLineDash([Math.max(3, W / 120), Math.max(3, W / 150)]);
  ctx.strokeStyle = "rgba(226,240,255,0.5)";
  ctx.lineWidth = Math.max(1, W / 420);
  ctx.stroke();
  ctx.setLineDash([]);

  const laminar = d.growthMinmax < 0;
  const curve = (arr: Float64Array, color: string, glow: number) => {
    ctx.beginPath();
    for (let i = 0; i < S; i++) {
      const x = X(i);
      const y = Y(arr[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.8, W / 200);
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
    for (let i = 0; i < S; i++) {
      ctx.beginPath();
      ctx.arc(X(i), Y(arr[i]), Math.max(0.1, W / 200), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };
  curve(d.gOff, withA(VIOLET, 0.92), 10);
  curve(d.gNom, laminar ? EMERALD : AMBER, 14);

  // worst-case (min–max growth) marker: the max of the nominal curve
  let wi = 0;
  for (let i = 1; i < S; i++) if (d.gNom[i] > d.gNom[wi]) wi = i;
  const wx = X(wi);
  const wy = Y(d.gNom[wi]);
  ctx.beginPath();
  ctx.arc(wx, wy, Math.max(0.1, W / 90), 0, Math.PI * 2);
  ctx.strokeStyle = laminar ? EMERALD : ROSE;
  ctx.lineWidth = Math.max(1.4, W / 260);
  ctx.shadowColor = laminar ? EMERALD : ROSE;
  ctx.shadowBlur = W / 60;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // axes + labels
  ctx.strokeStyle = "rgba(148,163,184,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = `${Math.max(8, W / 52)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("station  ·  along the pour path", padL + plotW / 2, padT + plotH + H * 0.03);
  ctx.save();
  ctx.translate(padL - W * 0.055, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText("growth rate σ", 0, 0);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(8, W / 56)}px ui-monospace, monospace`;
  ctx.fillStyle = withA(EMERALD, 0.8);
  ctx.fillText("laminar  ↓  every mode decays", padL + W * 0.02, y0 + H * 0.05);
  ctx.fillStyle = withA(ROSE, 0.7);
  ctx.fillText("grows  ↑", padL + W * 0.02, padT + H * 0.04);

  // legend
  const lx = padL + plotW - W * 0.24;
  let ly = padT + H * 0.02;
  const leg: [string, string][] = [
    [laminar ? EMERALD : AMBER, "nominal"],
    [VIOLET, "off-nominal"],
  ];
  ctx.font = `${Math.max(8, W / 54)}px ui-monospace, monospace`;
  for (const [c, label] of leg) {
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(1.6, W / 240);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + W * 0.045, ly);
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.textAlign = "left";
    ctx.fillText(label, lx + W * 0.056, ly);
    ly += H * 0.05;
  }
}

/* -- Stage 3: animated free-surface pour ------------------------------------ */
function drawPour(ctx: CanvasRenderingContext2D, W: number, H: number, d: VesselData, now: number, reduced: boolean, pool: { current: Buf | null }) {
  const nx = d.nx;
  const ny = d.ny;
  const buf = ensureBuf(pool, nx, ny);
  if (!buf) return;

  // blend two frames for a smooth pour
  const FRAME_MS = 620;
  let f0: number;
  let mix: number;
  if (reduced) {
    f0 = Math.floor(d.F / 2);
    mix = 0;
  } else {
    const phase = (now / FRAME_MS) % d.F;
    f0 = Math.floor(phase);
    mix = phase - f0;
    mix = mix * mix * (3 - 2 * mix); // smoothstep
  }
  const f1 = (f0 + 1) % d.F;
  const base0 = f0 * nx * ny;
  const base1 = f1 * nx * ny;
  const px = buf.img.data;
  const inv = 1 / d.frameMax;
  for (let i = 0; i < nx * ny; i++) {
    const v = (d.frames[base0 + i] * (1 - mix) + d.frames[base1 + i] * mix) * inv;
    const t = v < 0 ? 0 : v > 1 ? 1 : v;
    const [r, g, b] = lerpStops(POUR_STOPS, t);
    const o = i * 4;
    px[o] = r;
    px[o + 1] = g;
    px[o + 2] = b;
    px[o + 3] = Math.round(255 * Math.pow(t, 0.7));
  }
  const bctx = buf.canvas.getContext("2d");
  if (bctx) bctx.putImageData(buf.img, 0, 0);

  // basin geometry (preserve nx:ny aspect)
  const aspect = nx / ny;
  let bw = W * 0.84;
  let bh = bw / aspect;
  if (bh > H * 0.72) {
    bh = H * 0.72;
    bw = bh * aspect;
  }
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2 + H * 0.02;

  // pour stream falling into the basin
  if (!reduced) {
    const sway = Math.sin(now * 0.003) * (W * 0.01);
    const streamX = bx + bw * 0.5 + sway;
    const sg = ctx.createLinearGradient(streamX, by - H * 0.14, streamX, by + bh * 0.3);
    sg.addColorStop(0, "rgba(120,224,255,0)");
    sg.addColorStop(0.4, "rgba(96,214,246,0.5)");
    sg.addColorStop(1, "rgba(60,180,240,0.15)");
    ctx.fillStyle = sg;
    ctx.fillRect(streamX - W * 0.012, by - H * 0.14, W * 0.024, bh * 0.34);
  }

  // container backing
  ctx.fillStyle = "rgba(4,14,22,0.85)";
  ctx.fillRect(bx, by, bw, bh);

  // the mass field, scaled up + bloom
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = 1;
  ctx.drawImage(buf.canvas, 0, 0, nx, ny, bx, by, bw, bh);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55;
  ctx.filter = `blur(${Math.max(1, Math.round(bw / 60))}px)`;
  ctx.drawImage(buf.canvas, 0, 0, nx, ny, bx, by, bw, bh);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // container frame + rim highlight
  ctx.strokeStyle = withA(CYAN, 0.4);
  ctx.lineWidth = Math.max(1.2, W / 300);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = "rgba(180,244,255,0.5)";
  ctx.fillRect(bx, by, bw, Math.max(1, H / 300));

  // HUD text drawn on-canvas (frame counter avoids per-frame setState)
  ctx.font = `${Math.max(9, W / 48)}px ui-monospace, monospace`;
  ctx.fillStyle = withA(CYAN_GLOW, 0.9);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`frame ${((reduced ? f0 : f0) % d.F) + 1}/${d.F}`, bx + W * 0.015, by + H * 0.02);
  ctx.textAlign = "right";
  ctx.fillStyle = withA(MUTED, 0.85);
  ctx.fillText(`mass Σ ${d.pouredMass.toFixed(2)} · conserved`, bx + bw - W * 0.015, by + H * 0.02);
  ctx.textAlign = "left";
  ctx.fillStyle = withA(EMERALD, 0.9);
  ctx.fillText(`ledger residual ${d.massResidual.toExponential(1)}`, bx + W * 0.015, by + bh - H * 0.05);
}

/* -- Stage 4: CVaR-vs-lip robustification ----------------------------------- */
function drawCvar(ctx: CanvasRenderingContext2D, W: number, H: number, d: VesselData) {
  const padL = W * 0.13;
  const padR = W * 0.06;
  const padT = H * 0.13;
  const padB = H * 0.17;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const yLo = Math.min(d.cvarYmin, d.bandMin);
  const yHi = Math.max(d.cvarYmax, d.bandMax, 0);
  const pad = (yHi - yLo) * 0.12 || 1e-3;
  const lo = yLo - pad;
  const hi = yHi + pad;
  const X = (lip: number) => padL + ((lip - d.lipMin) / Math.max(1e-9, d.lipMax - d.lipMin)) * plotW;
  const Y = (v: number) => padT + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * plotH;

  // gridlines
  ctx.strokeStyle = "rgba(148,163,184,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 0; g <= 4; g++) {
    const gy = padT + (plotH * g) / 4;
    ctx.moveTo(padL, gy);
    ctx.lineTo(padL + plotW, gy);
  }
  ctx.stroke();

  // band-corner spread (certified worst-case losses)
  ctx.fillStyle = "rgba(244,63,94,0.08)";
  ctx.fillRect(padL, Y(d.bandMax), plotW, Math.max(1, Y(d.bandMin) - Y(d.bandMax)));
  ctx.beginPath();
  ctx.moveTo(padL, Y(d.bandMax));
  ctx.lineTo(padL + plotW, Y(d.bandMax));
  ctx.setLineDash([Math.max(2, W / 200), Math.max(2, W / 200)]);
  ctx.strokeStyle = withA(ROSE, 0.6);
  ctx.lineWidth = Math.max(1, W / 420);
  ctx.stroke();
  ctx.setLineDash([]);

  // zero line
  if (0 >= lo && 0 <= hi) {
    ctx.beginPath();
    ctx.moveTo(padL, Y(0));
    ctx.lineTo(padL + plotW, Y(0));
    ctx.strokeStyle = "rgba(226,240,255,0.35)";
    ctx.lineWidth = Math.max(1, W / 460);
    ctx.stroke();
  }

  const curve = (idx: number, color: string, glow: number) => {
    ctx.beginPath();
    for (let l = 0; l < d.L; l++) {
      const x = X(d.cvar[3 * l]);
      const y = Y(d.cvar[3 * l + idx]);
      if (l === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.8, W / 200);
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  curve(1, withA(MUTED, 0.85), 6); // nominal objective
  curve(2, CYAN_GLOW, 14); // CVaR objective (the robust one)

  // vertical markers: robust vs nominal lip
  const vline = (lip: number, color: string, label: string, up: boolean) => {
    const x = X(lip);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.strokeStyle = withA(color, 0.85);
    ctx.lineWidth = Math.max(1.2, W / 300);
    ctx.shadowColor = color;
    ctx.shadowBlur = W / 90;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = `${Math.max(8, W / 54)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = up ? "bottom" : "top";
    ctx.fillText(label, x, up ? padT - H * 0.005 : padT + plotH + H * 0.005);
  };
  vline(d.nominalLip, AMBER, `nominal ${d.nominalLip.toFixed(2)}`, false);
  vline(d.robustLip, EMERALD, `robust ${d.robustLip.toFixed(2)}`, true);

  // dots at the objective minima
  const dotAt = (lip: number, idx: number, color: string) => {
    let best = 0;
    let bd = Infinity;
    for (let l = 0; l < d.L; l++) {
      const dd = Math.abs(d.cvar[3 * l] - lip);
      if (dd < bd) {
        bd = dd;
        best = l;
      }
    }
    ctx.beginPath();
    ctx.arc(X(d.cvar[3 * best]), Y(d.cvar[3 * best + idx]), Math.max(0.1, W / 130), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = W / 70;
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  dotAt(d.robustLip, 2, EMERALD);
  dotAt(d.nominalLip, 1, AMBER);

  // axes + labels
  ctx.strokeStyle = "rgba(148,163,184,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `${Math.max(8, W / 52)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("lip width", padL + plotW / 2, padT + plotH + H * 0.055);
  ctx.save();
  ctx.translate(padL - W * 0.06, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText("objective", 0, 0);
  ctx.restore();

  // legend
  const lx = padL + plotW - W * 0.26;
  let ly = padT + H * 0.02;
  const leg: [string, string][] = [
    [CYAN_GLOW, "CVaR (tail)"],
    [MUTED, "nominal (mean)"],
    [ROSE, "band corners"],
  ];
  ctx.font = `${Math.max(8, W / 56)}px ui-monospace, monospace`;
  for (const [c, label] of leg) {
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(1.6, W / 240);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + W * 0.04, ly);
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, lx + W * 0.05, ly);
    ly += H * 0.048;
  }
}

/* -- Stage 5: the RENDER (Woodcock volume trace of the transmittance) -------- */
function drawRender(ctx: CanvasRenderingContext2D, W: number, H: number, d: VesselData, now: number, reduced: boolean, rbuf: { current: Buf | null }, keyRef: { current: string }) {
  const R = d.R;
  const buf = ensureBuf(rbuf, R, R);
  if (!buf) return;
  if (keyRef.current !== String(d.seq)) {
    const px = buf.img.data;
    for (let i = 0; i < R * R; i++) {
      const T = d.render[i];
      let a = 1 - (T < 0 ? 0 : T > 1 ? 1 : T);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      const li = Math.min(255, Math.round(a * 255)) * 3;
      const o = i * 4;
      px[o] = RENDER_LUT[li];
      px[o + 1] = RENDER_LUT[li + 1];
      px[o + 2] = RENDER_LUT[li + 2];
      px[o + 3] = Math.round(255 * Math.pow(a, 0.88));
    }
    const bctx = buf.canvas.getContext("2d");
    if (bctx) bctx.putImageData(buf.img, 0, 0);
    keyRef.current = String(d.seq);
  }

  // extra darkening for contrast
  ctx.fillStyle = "rgba(2,5,8,0.55)";
  ctx.fillRect(0, 0, W, H);

  const side = Math.min(W, H) * 0.84;
  const x0 = (W - side) / 2;
  const y0 = (H - side) / 2;
  const shimmer = reduced ? 1 : 0.86 + 0.14 * Math.sin(now * 0.0016);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // base
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(buf.canvas, 0, 0, R, R, x0, y0, side, side);

  // bloom passes (additive)
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${Math.max(1, Math.round(side / 42))}px)`;
  ctx.globalAlpha = 0.55 * shimmer;
  ctx.drawImage(buf.canvas, 0, 0, R, R, x0, y0, side, side);
  ctx.filter = `blur(${Math.max(1, Math.round(side / 15))}px)`;
  ctx.globalAlpha = 0.32 * shimmer;
  ctx.drawImage(buf.canvas, 0, 0, R, R, x0, y0, side, side);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // slow volumetric light sweep
  if (!reduced) {
    const sweep = ((now * 0.00006) % 1) * side;
    const sg = ctx.createLinearGradient(x0 + sweep - side * 0.16, 0, x0 + sweep + side * 0.16, 0);
    sg.addColorStop(0, "rgba(120,224,255,0)");
    sg.addColorStop(0.5, "rgba(150,236,255,0.06)");
    sg.addColorStop(1, "rgba(120,224,255,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = sg;
    ctx.fillRect(x0, y0, side, side);
    ctx.globalCompositeOperation = "source-over";
  }

  vignette(ctx, W, H, 0.55);

  // frame + caption ticks
  ctx.strokeStyle = withA(CYAN, 0.32);
  ctx.lineWidth = Math.max(1, W / 380);
  ctx.strokeRect(x0, y0, side, side);
  ctx.font = `${Math.max(8, W / 58)}px ui-monospace, monospace`;
  ctx.fillStyle = withA(CYAN_GLOW, 0.85);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`Woodcock volume trace · ${R}×${R}`, x0 + W * 0.01, y0 + side - H * 0.015);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DWELL_MS = 5200;
const PAUSE_AFTER_INTERACT_MS = 9000;

export default function VesselPipeline() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [lip, setLip] = useState(1000);
  const [lipCommitted, setLipCommitted] = useState(1000);
  const [stage, setStage] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [data, setData] = useState<VesselData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poolRef = useRef<Buf | null>(null);
  const renderBufRef = useRef<Buf | null>(null);
  const renderKeyRef = useRef("");

  const dataRef = useRef<VesselData | null>(null);
  dataRef.current = data;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const autoplayRef = useRef(autoplay);
  autoplayRef.current = autoplay;

  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);
  const lastInteractRef = useRef(0);

  /* -- run the whole campaign (kernel is fast; recompute only on release) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("run_vessel", lipCommitted);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        renderKeyRef.current = ""; // force render buffer rebuild
        setData(decode(raw, lipCommitted / 1000, ms, token));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, lipCommitted, call]);

  /* -- master draw dispatch (reads refs; deps stable) -- */
  const draw = useCallback((now: number, reveal: number) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    paintBg(ctx, W, H);
    if (!d) return;
    const st = stageRef.current;
    const rm = reducedRef.current;
    if (st === 0) drawProfile(ctx, W, H, d);
    else if (st === 1) drawStability(ctx, W, H, d);
    else if (st === 2) drawPour(ctx, W, H, d, now, rm, poolRef);
    else if (st === 3) drawCvar(ctx, W, H, d);
    else drawRender(ctx, W, H, d, now, rm, renderBufRef, renderKeyRef);

    // uniform reveal crossfade (fade in from bg on data/stage change)
    if (reveal < 1) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.globalAlpha = 1 - reveal;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }, []);

  const drawStatic = useCallback(() => {
    revealRef.current = 1;
    revealStartRef.current = null;
    draw(performance.now(), 1);
  }, [draw]);

  /* -- DPR sizing (landscape) -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const dp = dpr();
      const cssW = canvas.clientWidth || 640;
      const w = Math.max(320, Math.min(1400, Math.round(cssW * dp)));
      const h = Math.round(w / 1.6);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      draw(performance.now(), revealRef.current);
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

  /* -- reveal on first data; snap after -- */
  useEffect(() => {
    if (!data) return;
    if (!seenRef.current) {
      seenRef.current = true;
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    } else if (reduced || !inView) {
      drawStatic();
    } else {
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* -- reveal transition on stage change -- */
  useEffect(() => {
    if (!dataRef.current) return;
    if (reducedRef.current || !inViewRef.current) {
      drawStatic();
    } else {
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  /* -- animation loop (gated on view + reduced-motion) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      drawStatic();
      return;
    }
    const DUR = 620;
    const tick = (now: number) => {
      if (!inViewRef.current) {
        rafRef.current = null;
        return;
      }
      if (revealStartRef.current !== null) {
        const p = Math.min((now - revealStartRef.current) / DUR, 1);
        revealRef.current = 1 - Math.pow(1 - p, 3);
        if (p >= 1) revealStartRef.current = null;
      } else {
        revealRef.current = 1;
      }
      draw(now, revealRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [data, inView, reduced, inViewRef, draw, drawStatic]);

  /* -- subtle auto-advance (not in rAF; respects view + reduced + interaction) -- */
  useEffect(() => {
    const id = setInterval(() => {
      if (!autoplayRef.current || reducedRef.current || !inViewRef.current) return;
      if (performance.now() - lastInteractRef.current < PAUSE_AFTER_INTERACT_MS) return;
      setStage((s) => (s + 1) % STAGES.length);
    }, DWELL_MS);
    return () => clearInterval(id);
  }, [inViewRef]);

  const goStage = (s: number) => {
    lastInteractRef.current = performance.now();
    setStage(((s % STAGES.length) + STAGES.length) % STAGES.length);
  };

  const dirty = lip !== lipCommitted;
  const laminar = !!data && data.growthMinmax < 0;
  const robustWins = !!data && data.cvarRobustOff < data.cvarNominalOff;

  /* certified / measured line per stage */
  const certLine = (() => {
    if (!data) return null;
    switch (stage) {
      case 0:
        return (
          <>
            <span style={{ color: EMERALD }}>Certified:</span> exact Chebyshev wall · {data.P} control points · every geometric lever differentiable
          </>
        );
      case 1:
        return (
          <>
            <span style={{ color: EMERALD }}>Certified:</span> spectral growth min–max ={" "}
            <span style={{ color: laminar ? EMERALD : ROSE }}>{data.growthMinmax.toExponential(2)}</span>{" "}
            {laminar ? "( < 0 ⇒ every mode decays — laminar )" : "( a mode grows )"}
          </>
        );
      case 2:
        return (
          <>
            <span style={{ color: EMERALD }}>Measured:</span> mass ledger closes to{" "}
            <span style={{ color: EMERALD }}>{data.massResidual.toExponential(1)}</span> · poured mass {data.pouredMass.toFixed(2)} neutral · contact line as a sensitivity band
          </>
        );
      case 3:
        return (
          <>
            <span style={{ color: EMERALD }}>Certified:</span> robust off-band{" "}
            <span style={{ color: EMERALD }}>{data.cvarRobustOff.toExponential(2)}</span>{" "}
            {robustWins ? "<" : "≥"} nominal{" "}
            <span style={{ color: robustWins ? AMBER : ROSE }}>{data.cvarNominalOff.toExponential(2)}</span>{" "}
            {robustWins ? "— robust beats nominal" : ""}
          </>
        );
      default:
        return (
          <>
            <span style={{ color: EMERALD }}>Certified:</span> Woodcock volume trace · {data.R}×{data.R} transmittance · the same certified bytes as the physics
          </>
        );
    }
  })();

  const captions = [
    "The vessel wall is a smooth Chebyshev curve r(z) — revolved here into its carafe cross-section. Every geometric lever is differentiable, so the optimizer moves the metal by gradient, not by guess.",
    "Along the pour path the Orr–Sommerfeld operator's worst eigenvalue is tracked, nominal versus off-nominal. Below the zero line every disturbance mode decays: the stream stays laminar.",
    "The real free-surface pour, played back from the sim's own mass frames. Total mass is conserved to machine precision; the contact line is reported as a sensitivity band, not a single point.",
    "Sweeping the lip width, the nominal objective chases the mean while the CVaR objective guards the worst-case tail. The robust lip gives up a little average to stay laminar in the bad 20%.",
    "The same certified bytes, rendered. A Woodcock volume trace of the sim's own transmittance buffer turns the physics into the marketing shot — no separate asset, no lie.",
  ];

  const s = STAGES[stage];

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Flagship · fs-vessel-e2e · laminar-pour vessel</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            A vessel shaped to pour <span className="text-cyan-300">laminar</span> — then{" "}
            <span className="text-cyan-300">rendered</span> from the same bytes.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* stage stepper */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Pill onClick={() => goStage(stage - 1)} ariaLabel="Previous stage" disabled={!data}>
          ‹
        </Pill>
        {STAGES.map((st, i) => (
          <Pill key={st.name} onClick={() => goStage(i)} active={i === stage} color={st.color} ariaLabel={`Stage ${i + 1}: ${st.name}`} disabled={!data}>
            <span className="tabular-nums opacity-70">{i + 1}</span>
            <span className="hidden sm:inline">{st.name}</span>
          </Pill>
        ))}
        <Pill onClick={() => goStage(stage + 1)} ariaLabel="Next stage" disabled={!data}>
          ›
        </Pill>
        <button
          type="button"
          onClick={() => setAutoplay((a) => !a)}
          aria-pressed={autoplay}
          aria-label="Toggle auto-advance"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-white/5"
          style={{ borderColor: autoplay ? `${CYAN}66` : `${MUTED}44`, color: autoplay ? CYAN_GLOW : MUTED }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: autoplay ? CYAN_GLOW : MUTED, boxShadow: autoplay ? `0 0 6px ${CYAN_GLOW}` : "none" }} />
          auto
        </button>
      </div>

      {/* stage canvas */}
      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full"
          style={{ aspectRatio: "16 / 10", filter: "saturate(1.08) contrast(1.03)" }}
          role="img"
          aria-label={`Stage ${stage + 1} of the laminar-pour vessel campaign: ${s.name} — ${s.sub}`}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

        {(!ready || (computing && !data)) && <BootOverlay />}

        {/* stage HUD */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <span
            className="w-fit rounded-md border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest backdrop-blur-sm"
            style={{ borderColor: `${s.color}66`, background: `${BG}bb`, color: s.color }}
          >
            stage {stage + 1}/{STAGES.length} · {s.name}
          </span>
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest backdrop-blur-sm" style={{ borderColor: `${CYAN}33`, background: `${BG}aa`, color: MUTED }}>
            {s.sub}
          </span>
        </div>

        {/* live metric */}
        {data && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm font-mono" style={{ borderColor: `${CYAN}33`, background: "rgba(4,9,13,0.72)" }}>
            <div className="text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              lip width
            </div>
            <div className="text-[13px] font-black tabular-nums" style={{ color: BRIGHT, textShadow: `0 0 10px ${CYAN}55` }}>
              {data.lip.toFixed(3)}
            </div>
            <div className="mt-0.5 text-[8px] tabular-nums" style={{ color: MUTED }}>
              {data.ms.toFixed(1)} ms in WASM
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* certified / measured line */}
      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: `${EMERALD}33`, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: EMERALD }}>✓</span> {certLine ?? "running the certified campaign…"}
      </div>

      {/* per-stage caption */}
      <div className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{captions[stage]}</div>

      {/* lip control */}
      <div className="mt-4 flex flex-col gap-2.5">
        <Slider
          label="lip width"
          value={lip}
          min={500}
          max={3000}
          step={10}
          onChange={setLip}
          onCommit={(v) => setLipCommitted(Math.round(v))}
          format={(v) => (v / 1000).toFixed(2)}
          disabled={!ready}
        />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {computing ? (
          <span style={{ color: AMBER }}>running the vessel campaign · profile → stability → pour → CVaR → render…</span>
        ) : data ? (
          <>
            lip {data.lip.toFixed(2)} · growth min–max{" "}
            <span style={{ color: laminar ? EMERALD : ROSE }}>{data.growthMinmax.toExponential(2)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> robust lip <span style={{ color: EMERALD }}>{data.robustLip.toFixed(2)}</span> vs nominal{" "}
            <span style={{ color: AMBER }}>{data.nominalLip.toFixed(2)}</span> <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>{data.ms.toFixed(1)} ms in WASM</span>
            {dirty ? <span style={{ color: AMBER }}> · release to re-run</span> : null}
          </>
        ) : (
          "decoding the packed campaign — one Float64Array, every stage…"
        )}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        One <span className="text-slate-200">run_vessel</span> call runs the entire end-to-end campaign and returns every stage
        packed into a single Float64Array. The wall profile is a differentiable{" "}
        <span style={{ color: CYAN_GLOW }}>Chebyshev</span> curve; an <span className="text-slate-200">Orr–Sommerfeld</span>{" "}
        spectral check proves the pour stays <span style={{ color: EMERALD }}>laminar</span>; the free-surface pour is validated
        against the sim's own mass frames with the ledger closing to <span className="text-slate-200">~10⁻¹³</span>; a{" "}
        <span style={{ color: CYAN_GLOW }}>CVaR</span> robustification trades a little mean to guard the tail; and the final image
        is a <span className="text-slate-200">Woodcock volume trace</span> of the transmittance buffer — the marketing shot and
        the physics are <span style={{ color: CYAN_GLOW }}>the same certified bytes</span>. Everything here is compiled Rust,
        run live in your tab when you release the slider.
      </div>
    </SyncContainer>
  );
}
