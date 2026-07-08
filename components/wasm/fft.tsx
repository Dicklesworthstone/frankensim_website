"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "@/components/motion";
import { Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncContainer } from "@/components/sync-elements";
import { useFsWasm } from "@/lib/use-fs-wasm";
import { useInView } from "@/lib/use-viz-anim";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */
const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const AMBER = "#fbbf24";
const ROSE = "#f43f5e";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";

const PEAK_COLORS = [CYAN_GLOW, VIOLET, AMBER];

function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted ? !!rm : false;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="h-px w-8" style={{ background: `${CYAN}66` }} />
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">{children}</span>
    </div>
  );
}

function LiveBadge({ computing }: { computing: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.2em]"
      style={{ borderColor: `${CYAN}44`, background: `${CYAN}0d`, color: CYAN_GLOW }}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", computing && "animate-pulse")}
        style={{ background: computing ? AMBER : EMERALD, boxShadow: "0 0 6px currentColor" }}
      />
      {computing ? "Computing…" : "Computed live in WASM"}
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
      <AlertTriangle size={13} />
      kernel error: {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Peak detection: the 3 injected tones live at n/32, n/12, n/6.     */
/*  Snap each nominal frequency to the nearest measured local max.    */
/* ------------------------------------------------------------------ */

interface Peak {
  bin: number;
  power: number;
  nominal: number; // exact tone frequency (may be fractional)
  label: string;
}

function detectPeaks(power: Float64Array, n: number): Peak[] {
  const nominals = [
    { f: n / 32, label: "n/32" },
    { f: n / 12, label: "n/12" },
    { f: n / 6, label: "n/6" },
  ];
  const half = power.length - 1;
  return nominals.map(({ f, label }) => {
    const center = Math.round(f);
    let best = center;
    let bestP = -Infinity;
    for (let b = center - 2; b <= center + 2; b++) {
      if (b < 1 || b > half) continue;
      if (power[b] > bestP) {
        bestP = power[b];
        best = b;
      }
    }
    return { bin: best, power: bestP, nominal: f, label };
  });
}

interface FftState {
  n: number;
  power: Float64Array;
  peaks: Peak[];
  floor: number; // median-ish noise floor
  ms: number;
}

const SEEDS = [3, 11, 27, 55, 88];

export default function Fft() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [n, setN] = useState(512);
  const [seedIdx, setSeedIdx] = useState(0);
  const [showTime, setShowTime] = useState(true);
  const [computing, setComputing] = useState(false);
  const [state, setState] = useState<FftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    const seed = SEEDS[seedIdx % SEEDS.length];
    setComputing(true);
    setError(null);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const t0 = performance.now();
          const power = await call<Float64Array>("fft_power_spectrum", n, seed);
          const ms = performance.now() - t0;
          if (tokenRef.current !== token) return;
          const peaks = detectPeaks(power, n);
          // robust noise floor = median of the non-peak bins
          const peakBins = new Set(peaks.flatMap((p) => [p.bin - 1, p.bin, p.bin + 1]));
          const bg: number[] = [];
          for (let k = 1; k < power.length; k++) if (!peakBins.has(k)) bg.push(power[k]);
          bg.sort((a, b) => a - b);
          const floor = bg.length > 0 ? bg[Math.floor(bg.length / 2)] : 1e-6;
          setState({ n, power, peaks, floor, ms });
        } catch (e) {
          if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      })();
    }, 90);
    return () => clearTimeout(timer);
  }, [ready, n, seedIdx, call]);

  /* ---- spectrum plot geometry (log y) ---- */
  const VW = 720;
  const VH = 320;
  const L = 56;
  const R = 16;
  const T = 22;
  const B = 42;
  const pw = VW - L - R;
  const ph = VH - T - B;

  const geom = useMemo(() => {
    if (!state) return null;
    const half = state.power.length - 1;
    let hi = -Infinity;
    for (let k = 1; k < state.power.length; k++) hi = Math.max(hi, state.power[k]);
    const topDec = Math.ceil(Math.log10(hi) + 0.001);
    const botDec = Math.floor(Math.log10(Math.max(state.floor, 1e-9)) - 0.5);
    const span = Math.max(1, topDec - botDec);
    const xOf = (k: number) => L + (k / half) * pw;
    const yOf = (p: number) => {
      const lg = Math.log10(Math.max(p, Math.pow(10, botDec)));
      return T + (1 - (lg - botDec) / span) * ph;
    };
    const y0 = T + ph;
    // stem comb as a single path
    let stems = "";
    for (let k = 1; k < state.power.length; k++) {
      const x = xOf(k).toFixed(2);
      stems += `M ${x} ${y0.toFixed(2)} L ${x} ${yOf(state.power[k]).toFixed(2)} `;
    }
    const decades: number[] = [];
    for (let d = topDec; d >= botDec; d--) decades.push(d);
    // frequency ticks (every eighth of the band)
    const xTicks: number[] = [];
    for (let t = 0; t <= 8; t++) xTicks.push(Math.round((t / 8) * half));
    return { xOf, yOf, y0, stems, decades, xTicks, half, topDec, botDec };
  }, [state, pw, ph]);

  /* ---- reconstructed time-domain (inverse synthesis of the 3 peaks) ---- */
  const timeGeom = useMemo(() => {
    if (!state) return null;
    const amps = state.peaks.map((p) => (2 * Math.sqrt(Math.max(p.power, 0))) / state.n);
    return { amps, bins: state.peaks.map((p) => p.bin), n: state.n };
  }, [state]);

  const timeRef = useRef(timeGeom);
  timeRef.current = timeGeom;

  /* ---- animated oscilloscope canvas (real re-synthesized tones, flowing) ---- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // Virtual clock: advances only while the loop is actually running, so pausing
  // off-screen and resuming never produces a phase jump in the flowing wave.
  const elapsedRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const TCW = 1440;
  const TCH = 210;

  const drawTime = useCallback((elapsed: number) => {
    const canvas = canvasRef.current;
    const tg = timeRef.current;
    if (!canvas || !tg) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pad = 12;
    const mid = TCH / 2;
    const left = pad;
    const right = TCW - pad;
    const width = right - left;

    ctx.clearRect(0, 0, TCW, TCH);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, TCW, TCH);

    // faint horizontal grid
    ctx.strokeStyle = `${SLATE}22`;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(left, mid);
    ctx.lineTo(right, mid);
    ctx.stroke();
    ctx.setLineDash([]);

    const SAMPLES = 480;
    // phase advance (tones oscillate through time — the fundamental sets pace)
    const phase = elapsed * 0.65;
    let vmax = 1e-9;
    const vals: number[] = new Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      const frac = i / (SAMPLES - 1);
      const t = frac * tg.n;
      let s = 0;
      for (let j = 0; j < tg.bins.length; j++) {
        s += tg.amps[j] * Math.cos((2 * Math.PI * tg.bins[j] * (t / tg.n + phase)));
      }
      vals[i] = s;
      const a = Math.abs(s);
      if (a > vmax) vmax = a;
    }
    const amp = (TCH / 2 - pad) / vmax;

    const xAt = (i: number) => left + (i / (SAMPLES - 1)) * width;
    const yAt = (v: number) => mid - v * amp;

    // filled area under the wave
    const grad = ctx.createLinearGradient(0, 0, 0, TCH);
    grad.addColorStop(0, "rgba(34,211,238,0.20)");
    grad.addColorStop(0.5, "rgba(34,211,238,0.02)");
    grad.addColorStop(1, "rgba(34,211,238,0.20)");
    ctx.beginPath();
    ctx.moveTo(xAt(0), mid);
    for (let i = 0; i < SAMPLES; i++) ctx.lineTo(xAt(i), yAt(vals[i]));
    ctx.lineTo(xAt(SAMPLES - 1), mid);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // glowing waveform stroke
    ctx.beginPath();
    for (let i = 0; i < SAMPLES; i++) {
      const x = xAt(i);
      const y = yAt(vals[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineJoin = "round";
    ctx.strokeStyle = CYAN_GLOW;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = CYAN_GLOW;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // leading glow dot
    const lead = SAMPLES - 1;
    ctx.beginPath();
    ctx.arc(xAt(lead), yAt(vals[lead]), 4, 0, Math.PI * 2);
    ctx.fillStyle = "#e6feff";
    ctx.shadowColor = CYAN_GLOW;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  useEffect(() => {
    if (!showTime || !state) return;
    if (reduced) {
      drawTime(0);
      return;
    }
    // Off-screen: hold the current frame, run no rAF (resumes on re-enter).
    if (!inView) {
      drawTime(elapsedRef.current);
      return;
    }
    lastTsRef.current = null;
    const tick = (now: number) => {
      if (lastTsRef.current !== null) elapsedRef.current += (now - lastTsRef.current) / 1000;
      lastTsRef.current = now;
      drawTime(elapsedRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [showTime, state, reduced, inView, drawTime]);

  const runKey = `${n}-${seedIdx}`;
  const peakMax = state ? state.peaks.reduce((m, p) => Math.max(m, p.power), 0) : 0;
  const snrDb = state ? 10 * Math.log10(peakMax / Math.max(state.floor, 1e-12)) : 0;

  return (
    <SyncContainer withPulse accentColor="#06b6d4" className="p-4 md:p-6 bg-black/40">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Eyebrow>Demo 07 · fs-fft · radix FFT</Eyebrow>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${CYAN}33`, background: `${CYAN}12`, color: CYAN }}
            >
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              The spectrum, <span className="text-cyan-400">live</span>.
            </h3>
          </div>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* reconstructed time-domain oscilloscope */}
      {showTime && (
        <div className="mb-3 min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
              3 tones re-synthesized from the detected peaks
            </span>
            <span className="font-mono text-[9px]" style={{ color: SLATE }}>
              time domain · flowing
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={TCW}
            height={TCH}
            className="block w-full max-w-full"
            style={{ aspectRatio: `${TCW} / ${TCH}` }}
            role="img"
            aria-label="Reconstructed time-domain waveform: the sum of the three tones recovered from the spectrum's dominant peaks, oscillating in time."
          />
        </div>
      )}

      {/* spectrum plot */}
      <div ref={viewRef} className="min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full max-w-full"
          role="img"
          aria-label="Power spectrum on a logarithmic axis: a dense noise floor of stems with three sharp labeled peaks igniting far above it."
        >
          <defs>
            <linearGradient id="fft-stem" x1="0" y1={T} x2="0" y2={T + ph} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={CYAN_GLOW} stopOpacity="0.95" />
              <stop offset="55%" stopColor={CYAN} stopOpacity="0.55" />
              <stop offset="100%" stopColor={CYAN} stopOpacity="0.2" />
            </linearGradient>
            <radialGradient id="fft-vignette" cx="50%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#0b1a24" />
              <stop offset="100%" stopColor={SURFACE} />
            </radialGradient>
            <filter id="fft-glow" x="-40%" y="-60%" width="180%" height="220%">
              <feGaussianBlur stdDeviation="2.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="fft-reveal">
              <motion.rect
                key={`rev-${runKey}`}
                x={L}
                y={T - 20}
                height={ph + 40}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: pw }}
                transition={reduced ? { duration: 0 } : { duration: 1.1, ease: "easeInOut" }}
              />
            </clipPath>
          </defs>

          <rect x={L} y={T} width={pw} height={ph} fill="url(#fft-vignette)" stroke={BORDER} rx={4} />

          {geom &&
            geom.decades.map((d) => (
              <g key={`dec-${d}`}>
                <line x1={L} y1={geom.yOf(Math.pow(10, d))} x2={L + pw} y2={geom.yOf(Math.pow(10, d))} stroke={`${SLATE}18`} />
                <text x={L - 8} y={geom.yOf(Math.pow(10, d)) + 3} textAnchor="end" fontFamily="monospace" fontSize={9} fill={MUTED}>
                  1e{d}
                </text>
              </g>
            ))}

          {geom &&
            geom.xTicks.map((k) => (
              <text key={`xt-${k}`} x={geom.xOf(k)} y={T + ph + 15} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={SLATE}>
                {k}
              </text>
            ))}

          {geom && state && (
            <>
              {/* noise floor guide */}
              <line x1={L} y1={geom.yOf(state.floor)} x2={L + pw} y2={geom.yOf(state.floor)} stroke={`${ROSE}66`} strokeWidth={1} strokeDasharray="3 3" />
              <text x={L + pw - 4} y={geom.yOf(state.floor) - 4} textAnchor="end" fontFamily="monospace" fontSize={9} fill={`${ROSE}cc`}>
                noise floor
              </text>

              {/* the spectrum stems (swept in) */}
              <g clipPath="url(#fft-reveal)">
                <path d={geom.stems} stroke="url(#fft-stem)" strokeWidth={0.9} fill="none" />
              </g>

              {/* highlighted peaks igniting */}
              {state.peaks.map((p, i) => {
                const x = geom.xOf(p.bin);
                const y = geom.yOf(p.power);
                const c = PEAK_COLORS[i];
                const delay = reduced ? 0 : 0.3 + (p.bin / geom.half) * 0.85;
                return (
                  <g key={`peak-${runKey}-${i}`}>
                    {/* ignition burst ring (one-shot) */}
                    {!reduced && (
                      <motion.circle
                        cx={x}
                        cy={y}
                        r={4}
                        fill="none"
                        stroke={c}
                        strokeWidth={1.4}
                        initial={{ opacity: 0.9, scale: 0.4 }}
                        animate={{ opacity: 0, scale: 4 }}
                        transition={{ duration: 0.9, delay, ease: "easeOut" }}
                        style={{ transformOrigin: "center", transformBox: "fill-box" } as React.CSSProperties}
                      />
                    )}
                    <motion.g
                      initial={reduced ? false : { opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={reduced ? { duration: 0 } : { duration: 0.35, delay, ease: "backOut" }}
                      style={{ transformOrigin: "50% 100%", transformBox: "fill-box" } as React.CSSProperties}
                    >
                      <line x1={x} y1={geom.y0} x2={x} y2={y} stroke={c} strokeWidth={2.4} filter="url(#fft-glow)" />
                      <circle cx={x} cy={y} r={3.8} fill={c} stroke={BG} strokeWidth={1.2} filter="url(#fft-glow)" />
                    </motion.g>
                    <motion.g
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={reduced ? { duration: 0 } : { duration: 0.3, delay: delay + 0.15 }}
                    >
                      <text x={x} y={y - 11} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={c}>
                        {p.label}
                      </text>
                      <text x={x} y={y - 23} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={MUTED}>
                        bin {p.bin}
                      </text>
                    </motion.g>
                  </g>
                );
              })}
            </>
          )}

          <text x={L + pw / 2} y={VH - 3} textAnchor="middle" fontFamily="monospace" fontSize={10} fill={MUTED}>
            frequency bin k — cycles / window
          </text>
          <text
            x={14}
            y={T + ph / 2}
            textAnchor="middle"
            fontFamily="monospace"
            fontSize={10}
            fill={MUTED}
            transform={`rotate(-90 14 ${T + ph / 2})`}
          >
            power |X[k]|² (log)
          </text>

          {!ready && (
            <text x={VW / 2} y={VH / 2} textAnchor="middle" fontFamily="monospace" fontSize={12} fill={`${AMBER}cc`}>
              REANIMATING KERNEL…
            </text>
          )}
        </svg>
      </div>

      {/* detected-tone chips */}
      {state && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {state.peaks.map((p, i) => {
            const c = PEAK_COLORS[i];
            const db = 10 * Math.log10(p.power / Math.max(state.floor, 1e-12));
            return (
              <div key={`chip-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: `${c}33`, background: `${c}0d` }}>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: MUTED }}>
                    tone {p.label}
                  </div>
                  <div className="font-mono text-lg font-black tabular-nums" style={{ color: c }}>
                    bin {p.bin}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[9px]" style={{ color: SLATE }}>
                    SNR
                  </div>
                  <div className="font-mono text-sm font-bold tabular-nums" style={{ color: EMERALD }}>
                    {db.toFixed(0)} dB
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="mt-3">{<ErrorNote message={error} />}</div>}

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          window n
        </span>
        {[256, 512, 1024, 2048].map((g) => (
          <Pill key={g} onClick={() => setN(g)} active={n === g} ariaLabel={`Set FFT window to ${g} samples`} disabled={!ready}>
            {g}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill onClick={() => setSeedIdx((s) => s + 1)} color={CYAN} ariaLabel="Draw a fresh noise realization" disabled={!ready}>
          Reseed noise
        </Pill>
        <Pill onClick={() => setShowTime((v) => !v)} active={showTime} color={VIOLET} ariaLabel="Toggle reconstructed time-domain signal">
          Time signal
        </Pill>
      </div>

      {/* readout */}
      <div className="mt-4 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> n={n} radix FFT · {state ? state.power.length : "—"} bins
        {state ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> peaks @{" "}
            {state.peaks.map((p, i) => (
              <span key={i} style={{ color: PEAK_COLORS[i] }}>
                {i > 0 ? ", " : ""}
                {p.bin}
              </span>
            ))}{" "}
            <span style={{ color: MUTED }}>│</span> peak/floor ={" "}
            <span style={{ color: EMERALD }}>
              {Math.round(peakMax / Math.max(state.floor, 1e-9)).toLocaleString()}× ({snrDb.toFixed(0)} dB)
            </span>{" "}
            <span style={{ color: MUTED }}>│</span> {state.ms.toFixed(1)} ms
          </>
        ) : (
          <span style={{ color: MUTED }}> · reanimating kernel…</span>
        )}
      </div>

      {/* caption */}
      <div className="mt-5 border-t pt-4 text-sm leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A real radix fast Fourier transform,{" "}
        <span className="font-mono text-cyan-300">fs-fft</span>, running on your machine. Three pure tones sit buried
        in broadband noise at frequencies n/32, n/12 and n/6; the FFT resolves the whole {n}-sample window in O(n log n),
        and the three peaks ignite orders of magnitude above the floor, exactly where the tones were injected. It is
        the workhorse behind spectral PDE solvers, audio and signal processing, and here it runs as a genuine butterfly
        transform in your tab.
      </div>
    </SyncContainer>
  );
}
