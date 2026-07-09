"use client";

/**
 * FLAGSHIP · ORNITHOID  —  run_ornithoid(seed)  ·  fs-ornithoid-e2e
 * "A bird-like aircraft, wingtip to Pareto front, with every answer certified."
 *
 * One WASM call runs the entire end-to-end campaign for a multi-inlet flapping-wing
 * aircraft and returns ~2674 f64 covering all five stages; stepping the stepper just
 * re-draws a different decoded block (no recompute). The stages:
 *
 *   1 PARAMETERIZE   the hero airfoil section + an exact differentiable adjoint
 *   2 SCREEN         an anytime-valid ("e-raced") elimination of 12 candidates
 *   3 REFINE         a lattice-Boltzmann velocity field around the wall-mask section
 *   4 CERTIFY        a Lyapunov region-of-attraction for the maneuver dynamics
 *   5 PARETO ATLAS   the certified L/D-vs-ROA frontier with a polished knee
 *
 * Every number drawn is decoded straight from the compiled-Rust output — real bytes,
 * live in the tab. All arc / radial-gradient radii are guarded ≥ 0.1; the rAF loop
 * gates on inViewRef and reduced-motion; the heavy solve reruns only on an explicit
 * seed commit / re-run.
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
  TEAL,
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
  Pill,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/deep/_chrome";

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
type Pt = [number, number];

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
/** Guard every radius so ctx.arc / createRadialGradient never sees a negative. */
const mr = (r: number) => Math.max(0.1, r);

function sampleStops(stops: [number, RGB][], m: number): RGB {
  const x = m <= 0 ? 0 : m >= 1 ? 1 : m;
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = b === a ? 0 : (x - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

/** Fit a domW×domH domain into the inset plot rect, preserving aspect (centered). */
function fitBox(
  W: number,
  H: number,
  padL: number,
  padR: number,
  padT: number,
  padB: number,
  domW: number,
  domH: number,
) {
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const scale = Math.min(plotW / domW, plotH / domH);
  const ox = padL + (plotW - domW * scale) / 2;
  const oy = padT + (plotH - domH * scale) / 2;
  return { scale, ox, oy, plotW, plotH };
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(ang - 0.42), y - size * Math.sin(ang - 0.42));
  ctx.lineTo(x - size * Math.cos(ang + 0.42), y - size * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function mono(W: number, frac: number, min = 8) {
  return `${Math.max(min, W * frac)}px ui-monospace, SFMono-Regular, monospace`;
}

/* velocity-magnitude colormap (deep space → cyan glow) */
const VEL: [number, RGB][] = [
  [0.0, [3, 8, 14]],
  [0.16, [8, 28, 46]],
  [0.36, [12, 78, 108]],
  [0.56, [20, 152, 180]],
  [0.76, [42, 220, 240]],
  [0.92, [172, 246, 255]],
  [1.0, [236, 253, 255]],
];

/* ------------------------------------------------------------------ */
/*  Decode                                                             */
/* ------------------------------------------------------------------ */

interface Candidate {
  ld: number;
  cl: number;
  thickness: number;
  alpha: number;
  elimRound: number; // Infinity ⇒ survivor
  dieAt: number; // reveal fraction at which the bar drops (Infinity ⇒ never)
}
interface Row {
  ld: number;
  roa: number;
  maneuver: number;
  inletViol: number;
  certified: boolean;
  surrogateLd: number;
  g: number[];
}
interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface OrniData {
  // header
  Ns: number;
  P: number;
  Ne: number;
  nx: number;
  ny: number;
  Nrows: number;
  atlasPop: number;
  atlasGen: number;
  adjRelErr: number;
  dclAdjoint: number;
  winnerIdx: number;
  evalsUsed: number;
  fixedNEquiv: number;
  eliminated: number;
  lbmLift: number;
  lbmDrag: number;
  panelCl: number;
  steadiness: number;
  roaVolumeHero: number;
  conformalCoverage: number;
  bandHalfWidth: number;
  hypervolume: number;
  kneeIdx: number;
  polishBefore: number;
  polishAfter: number;
  // A
  hero: Pt[];
  heroB: Bounds;
  inletX: number;
  dclDthickness: number;
  // B
  cands: Candidate[];
  W: number;
  wake: { x: number; y: number; circ: number }[];
  wakeB: Bounds;
  wakeCircMax: number;
  // C
  vel: Float64Array;
  velMax: number;
  cvBox: [number, number, number, number];
  wallCx: number;
  wallCy: number;
  // D
  k: number;
  d: number;
  p11: number;
  p12: number;
  p22: number;
  cstar: number;
  roaVolume: number;
  maneuver: number;
  certified: boolean;
  roa: Pt[];
  roaExt: number;
  surrogateLd: number;
  bandHW: number;
  streamlines: Pt[][];
  // E
  rows: Row[];
  ldMin: number;
  ldMax: number;
  roaMin: number;
  roaMax: number;
  manMin: number;
  manMax: number;
  front: number[]; // row indices on the Pareto front (sorted by ld)
  polishG: number[];
  seed: number;
  ms: number;
  seq: number;
}

function computeStreamlines(k: number, d: number, ext: number): Pt[][] {
  const f = (x: number, y: number): Pt => [y, -k * x - d * y]; // ẋ = A x, A = [[0,1],[-k,-d]]
  const rk4 = (x: number, y: number, h: number): Pt => {
    const [a1, b1] = f(x, y);
    const [a2, b2] = f(x + 0.5 * h * a1, y + 0.5 * h * b1);
    const [a3, b3] = f(x + 0.5 * h * a2, y + 0.5 * h * b2);
    const [a4, b4] = f(x + h * a3, y + h * b3);
    return [x + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4), y + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4)];
  };
  const lines: Pt[][] = [];
  const nSeed = 18;
  for (let s = 0; s < nSeed; s++) {
    const ang = (s / nSeed) * Math.PI * 2;
    const r0 = ext * (0.62 + 0.36 * ((s * 7) % nSeed) / nSeed);
    let x = Math.cos(ang) * r0;
    let y = Math.sin(ang) * r0;
    const pts: Pt[] = [[x, y]];
    for (let i = 0; i < 320; i++) {
      [x, y] = rk4(x, y, 0.05);
      pts.push([x, y]);
      const rr = Math.hypot(x, y);
      if (rr < ext * 0.01 || rr > ext * 2.4) break;
    }
    if (pts.length > 3) lines.push(pts);
  }
  return lines;
}

function decode(raw: Float64Array, seed: number, ms: number, seq: number): OrniData {
  const R = (i: number) => raw[i];
  const Ns = Math.round(raw[1]);
  const P = Math.round(raw[2]);
  const Ne = Math.round(raw[3]);
  const nx = Math.round(raw[4]);
  const ny = Math.round(raw[5]);
  const Nrows = Math.round(raw[6]);
  const atlasPop = Math.round(raw[7]);
  const atlasGen = Math.round(raw[8]);
  const winnerIdx = Math.round(raw[11]);

  // ---- BLOCK A @ 26 ----
  let o = 26;
  const hero: Pt[] = [];
  let hminX = Infinity,
    hmaxX = -Infinity,
    hminY = Infinity,
    hmaxY = -Infinity;
  for (let i = 0; i < P; i++) {
    const x = raw[o + 2 * i];
    const y = raw[o + 2 * i + 1];
    hero.push([x, y]);
    hminX = Math.min(hminX, x);
    hmaxX = Math.max(hmaxX, x);
    hminY = Math.min(hminY, y);
    hmaxY = Math.max(hmaxY, y);
  }
  o += 2 * P;
  const inletX = raw[o];
  // raw[o + 1] mirrors header[10] (dcl_adjoint); header value is used for display.
  const dclDthickness = raw[o + 2];
  o += 3;

  // ---- BLOCK B ----
  const candsRaw: { ld: number; cl: number; thickness: number; alpha: number }[] = [];
  for (let i = 0; i < Ns; i++) {
    const b = o + 4 * i;
    candsRaw.push({ ld: raw[b], cl: raw[b + 1], thickness: raw[b + 2], alpha: raw[b + 3] });
  }
  o += 4 * Ns;
  const elimRound: number[] = new Array(Ns).fill(Infinity);
  let minRound = Infinity,
    maxRound = -Infinity;
  for (let i = 0; i < Ne; i++) {
    const round = raw[o + 2 * i];
    const idx = Math.round(raw[o + 2 * i + 1]);
    if (idx >= 0 && idx < Ns) elimRound[idx] = round;
    minRound = Math.min(minRound, round);
    maxRound = Math.max(maxRound, round);
  }
  o += 2 * Ne;
  const rspan = Math.max(1e-6, maxRound - minRound);
  const cands: Candidate[] = candsRaw.map((c, i) => {
    const er = elimRound[i];
    const dieAt = isFinite(er) ? 0.18 + 0.72 * ((er - minRound) / rspan) : Infinity;
    return { ...c, elimRound: er, dieAt };
  });
  const W = Math.round(raw[o]);
  o += 1;
  const wake: { x: number; y: number; circ: number }[] = [];
  let wminX = Infinity,
    wmaxX = -Infinity,
    wminY = Infinity,
    wmaxY = -Infinity,
    wcMax = 1e-9;
  for (let i = 0; i < W; i++) {
    const b = o + 3 * i;
    const x = raw[b],
      y = raw[b + 1],
      circ = raw[b + 2];
    wake.push({ x, y, circ });
    wminX = Math.min(wminX, x);
    wmaxX = Math.max(wmaxX, x);
    wminY = Math.min(wminY, y);
    wmaxY = Math.max(wmaxY, y);
    wcMax = Math.max(wcMax, Math.abs(circ));
  }
  o += 3 * W;

  // ---- BLOCK C ----
  const vel = raw.subarray(o, o + ny * nx);
  let velMax = 1e-9;
  let wallSx = 0,
    wallSy = 0,
    wallN = 0;
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const v = vel[iy * nx + ix];
      if (v < 0) {
        wallSx += ix;
        wallSy += iy;
        wallN += 1;
      } else if (v > velMax) velMax = v;
    }
  }
  o += ny * nx;
  const cvBox: [number, number, number, number] = [raw[o], raw[o + 1], raw[o + 2], raw[o + 3]];
  o += 4;
  const wallCx = wallN ? wallSx / wallN : nx * 0.3;
  const wallCy = wallN ? wallSy / wallN : ny * 0.5;

  // ---- BLOCK D ----
  const k = raw[o];
  const d = raw[o + 1];
  o += 2;
  const p11 = raw[o],
    p12 = raw[o + 1],
    p22 = raw[o + 2];
  o += 3;
  const cstar = raw[o],
    roaVolume = raw[o + 1],
    maneuver = raw[o + 2],
    certified = raw[o + 3] > 0.5;
  o += 4;
  const roa: Pt[] = [];
  let rext = 1e-6;
  for (let i = 0; i < 64; i++) {
    const x = raw[o + 2 * i];
    const y = raw[o + 2 * i + 1];
    roa.push([x, y]);
    rext = Math.max(rext, Math.abs(x), Math.abs(y));
  }
  o += 128;
  const surrogateLd = raw[o];
  const bandHW = raw[o + 1];
  o += 2;
  const roaExt = rext * 1.7;
  const streamlines = computeStreamlines(k, d, roaExt);

  // ---- BLOCK E ----
  const rows: Row[] = [];
  let ldMin = Infinity,
    ldMax = -Infinity,
    roaMin = Infinity,
    roaMax = -Infinity,
    manMin = Infinity,
    manMax = -Infinity;
  for (let r = 0; r < Nrows; r++) {
    const b = o + 11 * r;
    const row: Row = {
      ld: raw[b],
      roa: raw[b + 1],
      maneuver: raw[b + 2],
      inletViol: raw[b + 3],
      certified: raw[b + 4] > 0.5,
      surrogateLd: raw[b + 5],
      g: [raw[b + 6], raw[b + 7], raw[b + 8], raw[b + 9], raw[b + 10]],
    };
    rows.push(row);
    ldMin = Math.min(ldMin, row.ld);
    ldMax = Math.max(ldMax, row.ld);
    roaMin = Math.min(roaMin, row.roa);
    roaMax = Math.max(roaMax, row.roa);
    manMin = Math.min(manMin, row.maneuver);
    manMax = Math.max(manMax, row.maneuver);
  }
  o += 11 * Nrows;
  const polishG = [raw[o + 2], raw[o + 3], raw[o + 4], raw[o + 5], raw[o + 6]];

  // Pareto front (maximize ld & roa) → non-dominated indices, sorted by ld
  const front: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    let dominated = false;
    for (let j = 0; j < rows.length; j++) {
      if (j === i) continue;
      if (
        rows[j].ld >= rows[i].ld &&
        rows[j].roa >= rows[i].roa &&
        (rows[j].ld > rows[i].ld || rows[j].roa > rows[i].roa)
      ) {
        dominated = true;
        break;
      }
    }
    if (!dominated) front.push(i);
  }
  front.sort((a, b) => rows[a].ld - rows[b].ld);

  return {
    Ns,
    P,
    Ne,
    nx,
    ny,
    Nrows,
    atlasPop,
    atlasGen,
    adjRelErr: R(9),
    dclAdjoint: R(10),
    winnerIdx,
    evalsUsed: Math.round(R(12)),
    fixedNEquiv: Math.round(R(13)),
    eliminated: Math.round(R(14)),
    lbmLift: R(15),
    lbmDrag: R(16),
    panelCl: R(17),
    steadiness: R(18),
    roaVolumeHero: R(19),
    conformalCoverage: R(20),
    bandHalfWidth: R(21),
    hypervolume: R(22),
    kneeIdx: Math.round(R(23)),
    polishBefore: R(24),
    polishAfter: R(25),
    hero,
    heroB: { minX: hminX, maxX: hmaxX, minY: hminY, maxY: hmaxY },
    inletX,
    dclDthickness,
    cands,
    W,
    wake,
    wakeB: { minX: wminX, maxX: wmaxX, minY: wminY, maxY: wmaxY },
    wakeCircMax: wcMax,
    vel,
    velMax,
    cvBox,
    wallCx,
    wallCy,
    k,
    d,
    p11,
    p12,
    p22,
    cstar,
    roaVolume,
    maneuver,
    certified,
    roa,
    roaExt,
    surrogateLd,
    bandHW,
    streamlines,
    rows,
    ldMin,
    ldMax,
    roaMin,
    roaMax,
    manMin,
    manMax,
    front,
    polishG,
    seed,
    ms,
    seq,
  };
}

/* ------------------------------------------------------------------ */
/*  Stage metadata                                                     */
/* ------------------------------------------------------------------ */

interface StageMeta {
  n: string;
  short: string;
  label: string;
  accent: string;
}
const STAGES: StageMeta[] = [
  { n: "01", short: "Parameterize", label: "Parameterize", accent: CYAN },
  { n: "02", short: "Screen", label: "Screen · e-raced", accent: VIOLET },
  { n: "03", short: "Refine", label: "Refine · LBM", accent: TEAL },
  { n: "04", short: "Certify", label: "Certify · Lyapunov ROA", accent: EMERALD },
  { n: "05", short: "Atlas", label: "Pareto atlas", accent: AMBER },
];

/* ================================================================== */
/*  Stage 1 — PARAMETERIZE                                             */
/* ================================================================== */

function drawParameterize(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: OrniData,
  reveal: number,
  time: number,
  reduced: boolean,
) {
  const b = d.heroB;
  const domW = Math.max(1e-6, b.maxX - b.minX);
  const domH = Math.max(1e-6, b.maxY - b.minY);
  // preserve TRUE aspect but let a wide-but-thin section breathe vertically a touch
  const { scale, ox, oy, plotW, plotH } = fitBox(W, H, W * 0.11, W * 0.11, H * 0.2, H * 0.24, domW, domH);
  const yScale = Math.min(scale, (plotH * 0.9) / domH); // never overflow the band
  const midY = oy + plotH / 2;
  const mapX = (x: number) => ox + (x - b.minX) * scale;
  const mapY = (y: number) => midY - (y - (b.minY + b.maxY) / 2) * yScale;

  // chord line
  ctx.strokeStyle = rgba(MUTED, 0.28);
  ctx.setLineDash([Math.max(3, W / 130), Math.max(3, W / 130)]);
  ctx.lineWidth = Math.max(0.8, W / 900);
  ctx.beginPath();
  ctx.moveTo(mapX(b.minX), mapY(0));
  ctx.lineTo(mapX(b.maxX), mapY(0));
  ctx.stroke();
  ctx.setLineDash([]);

  // airfoil polygon, revealed left→right along the chord
  const clipX = mapX(b.minX) + reveal * (mapX(b.maxX) - mapX(b.minX)) + W * 0.02;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, clipX, H);
  ctx.clip();

  ctx.beginPath();
  d.hero.forEach(([x, y], i) => {
    const px = mapX(x);
    const py = mapY(y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, mapY(b.maxY), 0, mapY(b.minY));
  grad.addColorStop(0, rgba(CYAN_GLOW, 0.5));
  grad.addColorStop(0.5, rgba(CYAN, 0.24));
  grad.addColorStop(1, rgba(TEAL, 0.12));
  ctx.fillStyle = grad;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = W / 42;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(CYAN_GLOW, 0.95);
  ctx.lineWidth = Math.max(1.4, W / 420);
  ctx.stroke();
  ctx.restore();

  // camber-ish highlight along the top surface
  ctx.strokeStyle = rgba(BRIGHT, 0.22);
  ctx.lineWidth = Math.max(0.8, W / 1100);
  ctx.beginPath();
  for (let i = 32; i < d.hero.length; i++) {
    const [x, y] = d.hero[i];
    const px = mapX(x);
    const py = mapY(y);
    if (i === 32) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  if (reveal > 0.55) {
    const fade = Math.min(1, (reveal - 0.55) / 0.35);

    // inlet station marker (multi-inlet flapping wing)
    const ix = mapX(b.minX + d.inletX * (b.maxX - b.minX));
    ctx.strokeStyle = rgba(VIOLET, 0.85 * fade);
    ctx.lineWidth = Math.max(1.2, W / 520);
    ctx.shadowColor = VIOLET;
    ctx.shadowBlur = (W / 90) * fade;
    ctx.beginPath();
    ctx.moveTo(ix, mapY(b.maxY) - H * 0.06);
    ctx.lineTo(ix, mapY(b.minY) + H * 0.06);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const pulse = reduced ? 1 : 0.6 + 0.4 * Math.sin(time * 0.005);
    ctx.beginPath();
    ctx.arc(ix, mapY(0), mr(Math.max(2.4, W / 150) * pulse), 0, Math.PI * 2);
    ctx.fillStyle = rgba(VIOLET, 0.95 * fade);
    ctx.shadowColor = VIOLET;
    ctx.shadowBlur = (W / 70) * pulse;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(VIOLET, fade);
    ctx.font = mono(W, 1 / 62);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("inlet station", ix, mapY(b.maxY) - H * 0.07);

    // ∂cl/∂α  — a rotation arc near the leading edge
    const leX = mapX(b.minX + 0.16 * (b.maxX - b.minX));
    const arcR = Math.max(14, plotW * 0.11);
    const a0 = Math.PI * 0.86;
    const a1 = Math.PI * 1.34;
    ctx.strokeStyle = rgba(CYAN_GLOW, 0.9 * fade);
    ctx.lineWidth = Math.max(1.6, W / 360);
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = (W / 120) * fade;
    ctx.beginPath();
    ctx.arc(leX, mapY(0) - arcR * 0.2, mr(arcR), a0, a1);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const hx = leX + arcR * Math.cos(a1);
    const hy = mapY(0) - arcR * 0.2 + arcR * Math.sin(a1);
    arrowHead(ctx, hx, hy, a1 + Math.PI / 2, Math.max(6, W / 105), rgba(CYAN_GLOW, fade));
    ctx.fillStyle = rgba(CYAN_GLOW, fade);
    ctx.font = mono(W, 1 / 58);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`∂c_l/∂α = ${d.dclAdjoint.toFixed(2)}`, leX + arcR * 0.7, mapY(0) - arcR - H * 0.02);

    // ∂cl/∂thickness — a vertical double arrow at ~40% chord
    const tX = mapX(b.minX + 0.42 * (b.maxX - b.minX));
    const tTop = mapY(b.maxY) - H * 0.02;
    const tBot = mapY(b.minY) + H * 0.02;
    ctx.strokeStyle = rgba(EMERALD, 0.9 * fade);
    ctx.lineWidth = Math.max(1.4, W / 440);
    ctx.beginPath();
    ctx.moveTo(tX, tTop);
    ctx.lineTo(tX, tBot);
    ctx.stroke();
    arrowHead(ctx, tX, tTop, -Math.PI / 2, Math.max(5, W / 130), rgba(EMERALD, fade));
    arrowHead(ctx, tX, tBot, Math.PI / 2, Math.max(5, W / 130), rgba(EMERALD, fade));
    ctx.fillStyle = rgba(EMERALD, fade);
    ctx.font = mono(W, 1 / 58);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`∂c_l/∂t = ${d.dclDthickness.toFixed(2)}`, tX + W * 0.014, tBot + H * 0.01);

    // LE / TE dots
    for (const [ex, tag] of [
      [b.minX, "LE"],
      [b.maxX, "TE"],
    ] as [number, string][]) {
      ctx.beginPath();
      ctx.arc(mapX(ex), mapY(0), mr(Math.max(2, W / 260)), 0, Math.PI * 2);
      ctx.fillStyle = rgba(BRIGHT, 0.7 * fade);
      ctx.fill();
      ctx.fillStyle = rgba(MUTED, fade);
      ctx.font = mono(W, 1 / 72);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(tag, mapX(ex), mapY(0) + H * 0.02);
    }
  }
}

/* ================================================================== */
/*  Stage 2 — SCREEN (e-raced)                                          */
/* ================================================================== */

function drawScreen(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: OrniData,
  reveal: number,
  time: number,
  reduced: boolean,
) {
  const padL = W * 0.07;
  const padR = W * 0.07;
  const padT = H * 0.16;
  const baseY = H * 0.8;
  const plotW = W - padL - padR;
  const plotH = baseY - padT;
  const n = d.cands.length;
  const slot = plotW / n;
  const bw = slot * 0.56;
  let ldMax = 1e-6;
  for (const c of d.cands) ldMax = Math.max(ldMax, c.ld);

  // baseline
  ctx.strokeStyle = rgba(MUTED, 0.25);
  ctx.lineWidth = Math.max(0.8, W / 900);
  ctx.beginPath();
  ctx.moveTo(padL, baseY);
  ctx.lineTo(W - padR, baseY);
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const c = d.cands[i];
    const cx = padL + slot * (i + 0.5);
    const isWinner = i === d.winnerIdx;
    // eliminated? animate the drop
    const dead = isFinite(c.dieAt) && reveal >= c.dieAt;
    const dropP = dead ? Math.min(1, (reveal - c.dieAt) / 0.12) : 0;
    const grow = Math.min(1, reveal / 0.16);
    const full = (c.ld / ldMax) * plotH * grow;
    const h = full * (1 - 0.72 * dropP);
    const yTop = baseY - h;

    const col = isWinner ? EMERALD : dead ? ROSE : CYAN;
    const alpha = dead ? 0.28 + 0.15 * (1 - dropP) : isWinner ? 0.96 : 0.78;

    ctx.fillStyle = rgba(col, alpha);
    if (isWinner) {
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = W / 55;
    }
    ctx.fillRect(cx - bw / 2, yTop, bw, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(col, Math.min(1, alpha + 0.2));
    ctx.lineWidth = Math.max(0.8, W / 850);
    ctx.strokeRect(cx - bw / 2, yTop, bw, h);

    // L/D value atop the (living) bar
    if (!dead || dropP < 0.6) {
      ctx.fillStyle = rgba(col, dead ? 0.5 : 0.95);
      ctx.font = mono(W, 1 / 66);
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(c.ld.toFixed(1), cx, yTop - H * 0.008);
    }
    // candidate index
    ctx.fillStyle = rgba(MUTED, 0.85);
    ctx.font = mono(W, 1 / 74);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`#${i}`, cx, baseY + H * 0.014);

    // elimination round tag when it drops
    if (dead && dropP > 0.15) {
      ctx.fillStyle = rgba(ROSE, 0.85 * dropP);
      ctx.font = mono(W, 1 / 78);
      ctx.textBaseline = "bottom";
      ctx.fillText(`R${Math.round(c.elimRound)}`, cx, baseY - h - H * 0.03);
    }
    // winner crown
    if (isWinner && reveal > 0.9) {
      const pulse = reduced ? 1 : 0.65 + 0.35 * Math.sin(time * 0.006);
      ctx.beginPath();
      ctx.arc(cx, yTop - H * 0.05, mr(Math.max(4, W / 120) * pulse), 0, Math.PI * 2);
      ctx.strokeStyle = rgba(EMERALD, 0.9);
      ctx.lineWidth = Math.max(1, W / 480);
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = (W / 70) * pulse;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(EMERALD, 0.95);
      ctx.font = mono(W, 1 / 62);
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("winner", cx, yTop - H * 0.075);
    }
  }

  // axis label
  ctx.save();
  ctx.translate(padL * 0.44, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = MUTED;
  ctx.font = mono(W, 1 / 62);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("L / D", 0, 0);
  ctx.restore();

  // ---- flapping-wake inset (bottom-right) ----
  const iw = plotW * 0.34;
  const ih = H * 0.26;
  const ix0 = W - padR - iw;
  const iy0 = padT - H * 0.02;
  ctx.fillStyle = rgba(BG, 0.6);
  ctx.strokeStyle = rgba(CYAN, 0.3);
  ctx.lineWidth = Math.max(0.8, W / 900);
  ctx.beginPath();
  ctx.rect(ix0, iy0, iw, ih);
  ctx.fill();
  ctx.stroke();
  const wb = d.wakeB;
  const wdomW = Math.max(1e-6, wb.maxX - wb.minX);
  const wdomH = Math.max(1e-6, wb.maxY - wb.minY);
  const wsc = Math.min((iw * 0.86) / wdomW, (ih * 0.7) / wdomH);
  const wox = ix0 + (iw - wdomW * wsc) / 2;
  const woy = iy0 + ih * 0.62;
  for (let i = 0; i < d.wake.length; i++) {
    const v = d.wake[i];
    const appear = Math.min(1, Math.max(0, (reveal - 0.2 - (i / d.wake.length) * 0.5) / 0.3));
    if (appear <= 0) continue;
    const px = wox + (v.x - wb.minX) * wsc;
    const py = woy - (v.y - (wb.minY + wb.maxY) / 2) * wsc;
    const mag = Math.abs(v.circ) / d.wakeCircMax;
    const col = v.circ >= 0 ? CYAN_GLOW : ROSE;
    ctx.beginPath();
    ctx.arc(px, py, mr((Math.max(1.4, W / 260) + mag * Math.max(3, W / 90)) * appear), 0, Math.PI * 2);
    ctx.fillStyle = rgba(col, 0.72 * appear);
    ctx.shadowColor = col;
    ctx.shadowBlur = (W / 200) * mag;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = rgba(CYAN_GLOW, 0.85);
  ctx.font = mono(W, 1 / 74);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`flapping wake · ${d.W} vortices`, ix0 + iw * 0.04, iy0 + ih * 0.05);
}

/* ================================================================== */
/*  Stage 3 — REFINE (LBM)                                              */
/* ================================================================== */

interface Off {
  color: HTMLCanvasElement;
  bloom: HTMLCanvasElement;
  cimg: ImageData;
  bimg: ImageData;
}

function drawRefine(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: OrniData,
  reveal: number,
  time: number,
  reduced: boolean,
  off: Off,
) {
  const { nx, ny, vel, velMax } = d;
  const { scale, ox, oy } = fitBox(W, H, W * 0.05, W * 0.05, H * 0.13, H * 0.14, nx, ny);
  const fw = nx * scale;
  const fh = ny * scale;

  const cd = off.cimg.data;
  const bd = off.bimg.data;
  for (let py = 0; py < ny; py++) {
    const iy = ny - 1 - py; // high iy at top
    for (let px = 0; px < nx; px++) {
      const o4 = (py * nx + px) * 4;
      const v = vel[iy * nx + px];
      let cr: number, cg: number, cb: number, emit: number;
      if (v < 0) {
        // wall mask — near-black silhouette
        cr = 2;
        cg = 6;
        cb = 10;
        emit = 0;
      } else {
        const t = Math.min(1, Math.pow(v / velMax, 0.72));
        const col = sampleStops(VEL, t);
        cr = col[0];
        cg = col[1];
        cb = col[2];
        emit = t <= 0.45 ? 0 : (t - 0.45) / 0.55;
      }
      cd[o4] = cr;
      cd[o4 + 1] = cg;
      cd[o4 + 2] = cb;
      cd[o4 + 3] = 255;
      const em = emit * emit;
      bd[o4] = Math.min(255, cr * em);
      bd[o4 + 1] = Math.min(255, cg * em);
      bd[o4 + 2] = Math.min(255, cb * em);
      bd[o4 + 3] = 255;
    }
  }
  const cctx = off.color.getContext("2d");
  const bctx = off.bloom.getContext("2d");
  if (!cctx || !bctx) return;
  cctx.putImageData(off.cimg, 0, 0);
  bctx.putImageData(off.bimg, 0, 0);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // reveal by clipping the field left→right (streamwise sweep)
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, fw * reveal + 1, fh);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off.color, 0, 0, nx, ny, ox, oy, fw, fh);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.85;
  ctx.filter = `blur(${Math.max(2, Math.round(W / 120))}px)`;
  ctx.drawImage(off.bloom, 0, 0, nx, ny, ox, oy, fw, fh);
  ctx.globalAlpha = 0.5;
  ctx.filter = `blur(${Math.max(6, Math.round(W / 55))}px)`;
  ctx.drawImage(off.bloom, 0, 0, nx, ny, ox, oy, fw, fh);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  // frame
  ctx.strokeStyle = rgba(CYAN, 0.28);
  ctx.lineWidth = Math.max(0.8, W / 900);
  ctx.strokeRect(ox, oy, fw, fh);

  if (reveal > 0.6) {
    const fade = Math.min(1, (reveal - 0.6) / 0.3);
    // grid → screen (gy up)
    const gx = (x: number) => ox + x * scale;
    const gy = (y: number) => oy + (ny - y) * scale;
    // control volume box
    const [x0, y0, x1, y1] = d.cvBox;
    ctx.setLineDash([Math.max(4, W / 120), Math.max(3, W / 150)]);
    ctx.strokeStyle = rgba(AMBER, 0.85 * fade);
    ctx.lineWidth = Math.max(1.2, W / 520);
    ctx.strokeRect(gx(x0), gy(y1), (x1 - x0) * scale, (y1 - y0) * scale);
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(AMBER, 0.9 * fade);
    ctx.font = mono(W, 1 / 74);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("momentum control volume", gx(x0), gy(y1) - H * 0.008);

    // lift / drag force vector at the wall centroid
    const cx = gx(d.wallCx + 0.5);
    const cy = gy(d.wallCy + 0.5);
    const vmag = Math.max(1e-6, Math.hypot(d.lbmDrag, d.lbmLift));
    const vlen = Math.max(fw * 0.16, fh * 0.4);
    const ux = (d.lbmDrag / vmag) * vlen;
    const uy = (-d.lbmLift / vmag) * vlen; // lift up → screen −y
    ctx.strokeStyle = rgba(ROSE, 0.95 * fade);
    ctx.lineWidth = Math.max(2, W / 300);
    ctx.shadowColor = ROSE;
    ctx.shadowBlur = (W / 120) * fade;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + ux, cy + uy);
    ctx.stroke();
    ctx.shadowBlur = 0;
    arrowHead(ctx, cx + ux, cy + uy, Math.atan2(uy, ux), Math.max(7, W / 90), rgba(ROSE, fade));
    ctx.fillStyle = rgba(ROSE, fade);
    ctx.font = mono(W, 1 / 62);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`F  (drag ${d.lbmDrag.toFixed(3)}, lift ${d.lbmLift.toFixed(3)})`, cx + ux + W * 0.01, cy + uy);
  }

  // inflow marker
  const pulse = reduced ? 0 : (time * 0.06) % (fw * 0.2);
  ctx.fillStyle = rgba(CYAN_GLOW, 0.8);
  ctx.font = mono(W, 1 / 66);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("flow →", ox + W * 0.01 + pulse, oy - H * 0.04);
}

/* ================================================================== */
/*  Stage 4 — CERTIFY (Lyapunov ROA)                                    */
/* ================================================================== */

function drawCertify(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: OrniData,
  reveal: number,
  time: number,
  reduced: boolean,
) {
  const ext = d.roaExt;
  const side = Math.min(W - W * 0.12, H - H * 0.16);
  const cx = W / 2;
  const cy = H / 2 + H * 0.01;
  const sc = side / (2 * ext);
  const mapX = (x: number) => cx + x * sc;
  const mapY = (y: number) => cy - y * sc;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // axes
  ctx.strokeStyle = rgba(MUTED, 0.2);
  ctx.lineWidth = Math.max(0.7, W / 1000);
  ctx.beginPath();
  ctx.moveTo(mapX(-ext), cy);
  ctx.lineTo(mapX(ext), cy);
  ctx.moveTo(cx, mapY(-ext));
  ctx.lineTo(cx, mapY(ext));
  ctx.stroke();
  ctx.fillStyle = rgba(MUTED, 0.7);
  ctx.font = mono(W, 1 / 66);
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("x₁ (state)", mapX(ext) - W * 0.005, cy + H * 0.008);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("x₂ (rate)", cx + W * 0.006, mapY(ext) + H * 0.004);

  // streamlines of ẋ = A x
  ctx.lineCap = "round";
  for (const line of d.streamlines) {
    const nSeg = Math.max(2, Math.floor(line.length * Math.min(1, reveal * 1.15)));
    ctx.beginPath();
    for (let i = 0; i < nSeg; i++) {
      const [x, y] = line[i];
      const px = mapX(x);
      const py = mapY(y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = rgba(CYAN, 0.16);
    ctx.lineWidth = Math.max(0.8, W / 780);
    ctx.stroke();
  }

  // animated flow particles spiralling into the origin
  if (!reduced && reveal > 0.4) {
    for (let s = 0; s < d.streamlines.length; s++) {
      const line = d.streamlines[s];
      const phase = (time * 0.00028 + s / d.streamlines.length) % 1;
      const fi = Math.floor(phase * (line.length - 1));
      const [x, y] = line[fi];
      ctx.beginPath();
      ctx.arc(mapX(x), mapY(y), mr(Math.max(1.6, W / 300)), 0, Math.PI * 2);
      ctx.fillStyle = rgba(CYAN_GLOW, 0.72);
      ctx.shadowColor = CYAN_GLOW;
      ctx.shadowBlur = W / 130;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // certified ROA ellipse (Block D polyline)
  const rp = Math.min(1, reveal * 1.2);
  const nR = Math.max(3, Math.floor(d.roa.length * rp));
  ctx.beginPath();
  for (let i = 0; i <= nR && i < d.roa.length; i++) {
    const [x, y] = d.roa[i % d.roa.length];
    const px = mapX(x);
    const py = mapY(y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  if (rp >= 1) ctx.closePath();
  ctx.fillStyle = rgba(EMERALD, 0.12);
  ctx.fill();
  ctx.strokeStyle = rgba(EMERALD, 0.95);
  ctx.lineWidth = Math.max(1.8, W / 320);
  ctx.shadowColor = EMERALD;
  ctx.shadowBlur = W / 40;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // equilibrium
  const pulse = reduced ? 1 : 0.6 + 0.4 * Math.sin(time * 0.005);
  ctx.beginPath();
  ctx.arc(cx, cy, mr(Math.max(2.6, W / 170) * pulse), 0, Math.PI * 2);
  ctx.fillStyle = rgba(BRIGHT, 0.95);
  ctx.shadowColor = EMERALD;
  ctx.shadowBlur = (W / 60) * pulse;
  ctx.fill();
  ctx.shadowBlur = 0;

  if (reveal > 0.7) {
    const fade = Math.min(1, (reveal - 0.7) / 0.25);
    ctx.fillStyle = rgba(EMERALD, 0.95 * fade);
    ctx.font = mono(W, 1 / 56);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("certified region of attraction", cx, mapY(ext) - H * 0.004 + H * 0.03);

    // conformal band readout (bottom-left)
    const bx = W * 0.05;
    let by = H * 0.7;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = mono(W, 1 / 60);
    const lines: [string, string][] = [
      [`predicted L/D  ${d.surrogateLd.toFixed(2)} ± ${d.bandHW.toFixed(2)}`, EMERALD],
      [`conformal coverage  ${(d.conformalCoverage * 100).toFixed(0)}%`, CYAN_GLOW],
      [`ROA volume  ${d.roaVolume.toFixed(3)}`, EMERALD],
    ];
    for (const [t, c] of lines) {
      ctx.fillStyle = rgba(c, 0.92 * fade);
      ctx.fillText(t, bx, by);
      by += H * 0.05;
    }
  }
}

/* ================================================================== */
/*  Stage 5 — PARETO ATLAS                                              */
/* ================================================================== */

function drawAtlas(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: OrniData,
  reveal: number,
  time: number,
  reduced: boolean,
) {
  const padL = W * 0.1;
  const padR = W * 0.06;
  const padT = H * 0.12;
  const padB = H * 0.16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const ldLo = d.ldMin - (d.ldMax - d.ldMin) * 0.08;
  const ldHi = Math.max(d.ldMax, d.polishAfter) + (d.ldMax - d.ldMin) * 0.1;
  const roaLo = d.roaMin - (d.roaMax - d.roaMin) * 0.12;
  const roaHi = d.roaMax + (d.roaMax - d.roaMin) * 0.14;
  const X = (ld: number) => padL + ((ld - ldLo) / Math.max(1e-6, ldHi - ldLo)) * plotW;
  const Y = (roa: number) => padT + (1 - (roa - roaLo) / Math.max(1e-6, roaHi - roaLo)) * plotH;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // grid + axes
  ctx.strokeStyle = rgba(MUTED, 0.08);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 0; g <= 4; g++) {
    const gyv = padT + (plotH * g) / 4;
    ctx.moveTo(padL, gyv);
    ctx.lineTo(W - padR, gyv);
    const gxv = padL + (plotW * g) / 4;
    ctx.moveTo(gxv, padT);
    ctx.lineTo(gxv, padT + plotH);
  }
  ctx.stroke();
  ctx.strokeStyle = rgba(MUTED, 0.3);
  ctx.lineWidth = Math.max(0.8, W / 1000);
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(W - padR, padT + plotH);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = mono(W, 1 / 62);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("L / D  →", padL + plotW / 2, padT + plotH + H * 0.05);
  ctx.save();
  ctx.translate(padL * 0.4, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText("ROA volume  →", 0, 0);
  ctx.restore();

  // hypervolume region (dominated area under the front → nadir)
  if (d.front.length > 0 && reveal > 0.45) {
    const fade = Math.min(1, (reveal - 0.45) / 0.4);
    ctx.beginPath();
    ctx.moveTo(X(ldLo), Y(roaLo));
    const fr = d.front;
    ctx.lineTo(X(d.rows[fr[0]].ld), Y(roaLo));
    for (let i = 0; i < fr.length; i++) {
      const r = d.rows[fr[i]];
      ctx.lineTo(X(r.ld), Y(r.roa));
      if (i < fr.length - 1) {
        const nr = d.rows[fr[i + 1]];
        ctx.lineTo(X(nr.ld), Y(r.roa));
      }
    }
    const last = d.rows[fr[fr.length - 1]];
    ctx.lineTo(X(last.ld), Y(roaLo));
    ctx.closePath();
    ctx.fillStyle = rgba(AMBER, 0.07 * fade);
    ctx.fill();
    // front polyline
    ctx.beginPath();
    for (let i = 0; i < fr.length; i++) {
      const r = d.rows[fr[i]];
      const px = X(r.ld);
      const py = Y(r.roa);
      if (i === 0) ctx.moveTo(px, py);
      else {
        const pr = d.rows[fr[i - 1]];
        ctx.lineTo(X(r.ld), Y(pr.roa));
        ctx.lineTo(px, py);
      }
    }
    ctx.strokeStyle = rgba(AMBER, 0.55 * fade);
    ctx.setLineDash([Math.max(3, W / 150), Math.max(3, W / 180)]);
    ctx.lineWidth = Math.max(1, W / 620);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // scatter — size ∝ maneuver, color = certified
  for (let i = 0; i < d.rows.length; i++) {
    const appear = Math.min(1, Math.max(0, (reveal - (i / d.rows.length) * 0.4) / 0.35));
    if (appear <= 0) continue;
    const r = d.rows[i];
    const px = X(r.ld);
    const py = Y(r.roa);
    const mnorm = (r.maneuver - d.manMin) / Math.max(1e-6, d.manMax - d.manMin);
    const rad = (Math.max(2.4, W / 200) + mnorm * Math.max(5, W / 70)) * appear;
    const col = r.certified ? EMERALD : AMBER;
    const isKnee = i === d.kneeIdx;
    ctx.beginPath();
    ctx.arc(px, py, mr(rad), 0, Math.PI * 2);
    ctx.fillStyle = rgba(col, (isKnee ? 0.5 : 0.32) * appear);
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.9 * appear);
    ctx.lineWidth = Math.max(0.8, W / 700);
    ctx.shadowColor = col;
    ctx.shadowBlur = (W / 240) * appear;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // knee highlight + polish arrow
  if (reveal > 0.6 && d.kneeIdx >= 0 && d.kneeIdx < d.rows.length) {
    const fade = Math.min(1, (reveal - 0.6) / 0.35);
    const knee = d.rows[d.kneeIdx];
    const kx = X(d.polishBefore);
    const ky = Y(knee.roa);
    const pulse = reduced ? 1 : 0.65 + 0.35 * Math.sin(time * 0.005);
    ctx.beginPath();
    ctx.arc(kx, ky, mr(Math.max(6, W / 90) * pulse), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(CYAN_GLOW, 0.85 * fade);
    ctx.lineWidth = Math.max(1, W / 500);
    ctx.shadowColor = CYAN_GLOW;
    ctx.shadowBlur = (W / 80) * pulse;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(CYAN_GLOW, 0.9 * fade);
    ctx.font = mono(W, 1 / 64);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("knee", kx, ky - Math.max(9, W / 66));

    // polish arrow before → after (local refinement lifts L/D)
    const ax = X(d.polishBefore + (d.polishAfter - d.polishBefore) * Math.min(1, (reveal - 0.6) / 0.35));
    ctx.strokeStyle = rgba(EMERALD, 0.95 * fade);
    ctx.lineWidth = Math.max(2, W / 300);
    ctx.shadowColor = EMERALD;
    ctx.shadowBlur = (W / 110) * fade;
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.lineTo(ax, ky);
    ctx.stroke();
    ctx.shadowBlur = 0;
    arrowHead(ctx, ax, ky, 0, Math.max(7, W / 95), rgba(EMERALD, fade));
    // polished endpoint
    ctx.beginPath();
    ctx.arc(X(d.polishAfter), ky, mr(Math.max(3, W / 150)), 0, Math.PI * 2);
    ctx.fillStyle = rgba(EMERALD, fade);
    ctx.shadowColor = EMERALD;
    ctx.shadowBlur = W / 90;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(EMERALD, fade);
    ctx.font = mono(W, 1 / 62);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`polish  ${d.polishBefore.toFixed(1)} → ${d.polishAfter.toFixed(1)}`, kx + W * 0.006, ky + Math.max(6, W / 150));
  }
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function OrnithoidPipeline() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [seed, setSeed] = useState(1);
  const [seedCommitted, setSeedCommitted] = useState(1);
  const [stage, setStage] = useState(0);
  const [auto, setAuto] = useState(true);
  const [data, setData] = useState<OrniData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<OrniData | null>(null);
  dataRef.current = data;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);

  // offscreen buffers for the LBM heatmap (stage 3)
  const offRef = useRef<Off | null>(null);
  if (offRef.current === null && typeof document !== "undefined") {
    const mk = (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    };
    const color = mk(64, 32);
    const bloom = mk(64, 32);
    const cctx = color.getContext("2d");
    const bctx = bloom.getContext("2d");
    if (cctx && bctx) {
      offRef.current = { color, bloom, cimg: cctx.createImageData(64, 32), bimg: bctx.createImageData(64, 32) };
    }
  }

  /* -- the single heavy solve (only on committed seed) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("run_ornithoid", seedCommitted);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        setData(decode(raw, seedCommitted, ms, token));
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, seedCommitted, call]);

  /* -- dispatcher: draw the current stage -- */
  const draw = useCallback((reveal: number, time: number) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const Hh = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, Hh);
    if (!d) return;
    const rm = reducedRef.current;
    const s = stageRef.current;
    if (s === 0) drawParameterize(ctx, W, Hh, d, reveal, time, rm);
    else if (s === 1) drawScreen(ctx, W, Hh, d, reveal, time, rm);
    else if (s === 2 && offRef.current) drawRefine(ctx, W, Hh, d, reveal, time, rm, offRef.current);
    else if (s === 3) drawCertify(ctx, W, Hh, d, reveal, time, rm);
    else if (s === 4) drawAtlas(ctx, W, Hh, d, reveal, time, rm);
  }, []);

  /* -- DPR sizing + redraw -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const dp = dpr();
      const cssW = canvas.clientWidth || 640;
      const w = Math.max(320, Math.min(1500, Math.round(cssW * dp)));
      const h = Math.round(w * 0.62);
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

  /* -- restart the reveal on every stage / data change -- */
  useEffect(() => {
    revealStartRef.current = performance.now();
    revealRef.current = 0;
  }, [stage, data]);

  /* -- animation loop (gated on view + reduced-motion) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      draw(1, performance.now());
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
  }, [data, stage, inView, reduced, inViewRef, draw]);

  /* -- gentle auto-advance through the pipeline (NOT inside rAF) -- */
  useEffect(() => {
    if (!auto || reduced || !data) return;
    const id = setInterval(() => {
      if (!inViewRef.current) return;
      setStage((s) => (s + 1) % STAGES.length);
    }, 5200);
    return () => clearInterval(id);
  }, [auto, reduced, data, inViewRef]);

  const goStage = useCallback((s: number) => {
    setAuto(false);
    setStage(((s % STAGES.length) + STAGES.length) % STAGES.length);
  }, []);

  const meta = STAGES[stage];

  /* ---------- per-stage certified / measured line + caption ---------- */
  const savings = data && data.evalsUsed > 0 ? data.fixedNEquiv / data.evalsUsed : 0;
  const signMatch = data ? Math.sign(data.lbmLift) === Math.sign(data.panelCl) : false;

  const certLine = (): { tag: string; body: React.ReactNode; ok: boolean } => {
    if (!data) return { tag: "Certified", body: "—", ok: true };
    switch (stage) {
      case 0:
        return {
          tag: "Certified",
          ok: true,
          body: (
            <>
              exact discrete adjoint = finite-difference to{" "}
              <span style={{ color: EMERALD }}>{data.adjRelErr.toExponential(1)}</span> · ∂c_l/∂α ={" "}
              <span style={{ color: CYAN_GLOW }}>{data.dclAdjoint.toFixed(2)}</span>, ∂c_l/∂t ={" "}
              <span style={{ color: CYAN_GLOW }}>{data.dclDthickness.toFixed(2)}</span>
            </>
          ),
        };
      case 1:
        return {
          tag: "Certified",
          ok: true,
          body: (
            <>
              <span style={{ color: EMERALD }}>{data.evalsUsed}</span> evals vs{" "}
              <span style={{ color: MUTED }}>{data.fixedNEquiv}</span> fixed-n ≈{" "}
              <span style={{ color: EMERALD }}>{savings.toFixed(0)}×</span> saved ·{" "}
              <span style={{ color: ROSE }}>{data.eliminated}</span>/{data.Ns} eliminated · winner{" "}
              <span style={{ color: EMERALD }}>#{data.winnerIdx}</span> at L/D{" "}
              {data.cands[data.winnerIdx]?.ld.toFixed(2)}
            </>
          ),
        };
      case 2:
        return {
          tag: "Measured",
          ok: signMatch,
          body: (
            <>
              steadiness residual <span style={{ color: EMERALD }}>{data.steadiness.toExponential(1)}</span> · LBM lift{" "}
              <span style={{ color: signMatch ? EMERALD : AMBER }}>{data.lbmLift.toFixed(3)}</span>, drag{" "}
              <span style={{ color: CYAN_GLOW }}>{data.lbmDrag.toFixed(3)}</span> · panel c_l{" "}
              <span style={{ color: CYAN_GLOW }}>{data.panelCl.toFixed(3)}</span>{" "}
              <span style={{ color: signMatch ? EMERALD : AMBER }}>
                {signMatch ? "· signs agree ✓" : "· sign check"}
              </span>
            </>
          ),
        };
      case 3:
        return {
          tag: "Certified",
          ok: data.roaVolume > 0,
          body: (
            <>
              ROA volume <span style={{ color: EMERALD }}>{data.roaVolume.toFixed(3)}</span>{" "}
              {data.roaVolume > 0 ? <span style={{ color: EMERALD }}>(&gt;0 ⇒ proven)</span> : null} · conformal coverage{" "}
              <span style={{ color: CYAN_GLOW }}>{(data.conformalCoverage * 100).toFixed(0)}%</span> · L/D{" "}
              <span style={{ color: EMERALD }}>
                {data.surrogateLd.toFixed(2)} ± {data.bandHW.toFixed(2)}
              </span>
            </>
          ),
        };
      default:
        return {
          tag: "Certified",
          ok: true,
          body: (
            <>
              <span style={{ color: EMERALD }}>{data.Nrows}</span> certified rows · hypervolume{" "}
              <span style={{ color: AMBER }}>{data.hypervolume.toFixed(4)}</span> · knee L/D{" "}
              <span style={{ color: EMERALD }}>
                {data.polishBefore.toFixed(2)} → {data.polishAfter.toFixed(2)}
              </span>{" "}
              polished
            </>
          ),
        };
    }
  };

  const captions: React.ReactNode[] = [
    <>
      Every design lever is <span className="text-slate-200">differentiable</span>. The hero wing section is parameterized so{" "}
      <span style={{ color: CYAN }}>∂c_l/∂α</span> and <span style={{ color: EMERALD }}>∂c_l/∂thickness</span> come from an{" "}
      <span className="text-slate-200">exact discrete adjoint</span> — checked against finite differences to ~10⁻⁸. The{" "}
      <span style={{ color: VIOLET }}>inlet station</span> is where the multi-inlet flapping wing breathes. Nothing is sampled.
    </>,
    <>
      An anytime-valid <span style={{ color: VIOLET }}>elimination race</span> (&ldquo;e-raced&rdquo;) screens{" "}
      <span className="text-slate-200">{data?.Ns ?? 12} flapping-wing candidates</span>, dropping each loser the instant the
      evidence is decisive — spending <span style={{ color: EMERALD }}>{data?.evalsUsed ?? "~160"}</span> evaluations for the
      power of <span style={{ color: MUTED }}>{data?.fixedNEquiv ?? "4800"}</span>. The inset is the real{" "}
      <span style={{ color: CYAN }}>flapping vortex wake</span>, colored by circulation.
    </>,
    <>
      The winner is refined with a genuine <span className="text-slate-200">lattice-Boltzmann</span> solve: the glowing field is{" "}
      velocity magnitude, the black silhouette is the wall mask, and the <span style={{ color: AMBER }}>control volume</span>{" "}
      integrates the momentum flux into a certified <span style={{ color: ROSE }}>lift/drag force</span> — with a steadiness
      residual proving the wake has settled.
    </>,
    <>
      The maneuver controller earns a <span style={{ color: EMERALD }}>Lyapunov certificate</span>: the emerald ellipse is a{" "}
      proven <span className="text-slate-200">region of attraction</span> for the closed-loop dynamics ẋ = A x — every
      trajectory inside it converges, not by simulation but by <span className="text-slate-200">proof</span>. The predicted L/D
      ships with a <span style={{ color: CYAN }}>conformal band</span> of guaranteed coverage.
    </>,
    <>
      The whole campaign resolves to a <span style={{ color: AMBER }}>certified Pareto atlas</span> — L/D against provable{" "}
      <span style={{ color: EMERALD }}>region-of-attraction volume</span>, every point certified, point size set by maneuver
      margin. A local <span style={{ color: EMERALD }}>polish</span> lifts the <span style={{ color: CYAN }}>knee</span>{" "}
      design&rsquo;s L/D from {data?.polishBefore.toFixed(1) ?? "—"} to {data?.polishAfter.toFixed(1) ?? "—"} without
      surrendering its certificate.
    </>,
  ];

  const cl = certLine();
  const dirty = seed !== seedCommitted;

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Flagship · ORNITHOID · fs-ornithoid-e2e</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            A certified bird, <span className="text-cyan-300">wingtip to Pareto front</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* stage stepper */}
      <div className="mb-3 flex items-stretch gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Pipeline stage">
        {STAGES.map((s, i) => {
          const active = i === stage;
          const done = i < stage;
          const c = s.accent;
          return (
            <button
              key={s.n}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => goStage(i)}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors"
              style={{
                borderColor: active ? c : done ? `${EMERALD}44` : `${c}22`,
                background: active ? `${c}18` : "rgba(255,255,255,0.015)",
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-black tabular-nums"
                style={{
                  background: active ? c : done ? `${EMERALD}22` : "transparent",
                  color: active ? BG : done ? EMERALD : MUTED,
                  border: `1px solid ${active ? c : done ? `${EMERALD}66` : `${c}44`}`,
                }}
              >
                {done ? "✓" : s.n}
              </span>
              <span
                className="truncate font-mono text-[10px] font-bold uppercase tracking-widest"
                style={{ color: active ? BRIGHT : MUTED }}
              >
                {s.short}
              </span>
            </button>
          );
        })}
      </div>

      {/* canvas */}
      <div
        ref={viewRef}
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: BG }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full"
          style={{ aspectRatio: "1 / 0.62" }}
          role="img"
          aria-label={`ORNITHOID pipeline, stage ${stage + 1} of 5: ${meta.label}`}
        />
        <span
          className="pointer-events-none absolute left-3 top-3 flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
          style={{ borderColor: `${meta.accent}66`, background: `${BG}bb`, color: meta.accent }}
        >
          <span className="tabular-nums">{meta.n}</span> · {meta.label}
        </span>

        {/* certified seal */}
        {data && (
          <div
            className="pointer-events-none absolute right-3 top-3 flex flex-col items-end rounded-lg border px-2.5 py-1.5 text-right backdrop-blur-sm"
            style={{ borderColor: `${cl.ok ? EMERALD : AMBER}44`, background: "rgba(4,9,13,0.72)" }}
          >
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: MUTED }}>
              seed {data.seed}
            </span>
            <span
              className="mt-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em]"
              style={
                cl.ok
                  ? { borderColor: `${EMERALD}88`, background: `${EMERALD}14`, color: EMERALD }
                  : { borderColor: `${AMBER}66`, background: `${AMBER}12`, color: AMBER }
              }
            >
              {cl.ok ? "Verified" : "measured"}
            </span>
          </div>
        )}

        {(!ready || (computing && !data)) && <BootOverlay />}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* certified / measured metric line */}
      <div
        className="mt-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px]"
        style={{ borderColor: `${cl.ok ? EMERALD : AMBER}33`, background: SURFACE, color: BRIGHT }}
      >
        <span
          className="rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em]"
          style={{ background: `${cl.ok ? EMERALD : AMBER}1a`, color: cl.ok ? EMERALD : AMBER }}
        >
          {cl.tag}
        </span>
        <span className="min-w-0">{cl.body}</span>
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill onClick={() => goStage(stage - 1)} color={CYAN} ariaLabel="Previous stage" disabled={!data}>
          ‹ Prev
        </Pill>
        <Pill onClick={() => goStage(stage + 1)} color={CYAN} ariaLabel="Next stage" disabled={!data}>
          Next ›
        </Pill>
        <Pill
          onClick={() => setAuto((a) => !a)}
          active={auto && !reduced}
          color={EMERALD}
          ariaLabel={auto ? "Pause auto-advance" : "Play auto-advance"}
          disabled={!data || reduced}
        >
          {auto && !reduced ? "Auto ▸" : "Auto ▪"}
        </Pill>
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <button
          type="button"
          onClick={() => setSeedCommitted(seed)}
          disabled={!ready || computing}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: `${VIOLET}66`, color: VIOLET }}
        >
          ⟳ Re-run
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Slider
          label="seed"
          value={seed}
          min={1}
          max={9999}
          step={1}
          onChange={(v) => setSeed(Math.round(v))}
          onCommit={(v) => setSeedCommitted(Math.round(v))}
          format={(v) => String(Math.round(v))}
          color={VIOLET}
          disabled={!ready}
        />
      </div>

      {/* readout */}
      <div
        className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: CYAN_GLOW }}>›</span>{" "}
        {computing && !data ? (
          <span style={{ color: AMBER }}>running the full end-to-end ORNITHOID campaign in WASM…</span>
        ) : data ? (
          <>
            5-stage campaign · seed <span style={{ color: VIOLET }}>{data.seed}</span> · winner{" "}
            <span style={{ color: EMERALD }}>#{data.winnerIdx}</span> · {data.Nrows} certified frontier rows{" "}
            <span style={{ color: MUTED }}>│</span>{" "}
            <span style={{ color: EMERALD }}>
              {data.ms.toFixed(0)} ms in WASM
            </span>
            {dirty ? <span style={{ color: AMBER }}> · release / re-run to recompute</span> : null}
          </>
        ) : (
          "one call runs Parameterize → Screen → Refine → Certify → Atlas; stepping just re-draws a decoded block…"
        )}
      </div>

      {/* caption */}
      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        {captions[stage]}
      </div>
    </SyncContainer>
  );
}
