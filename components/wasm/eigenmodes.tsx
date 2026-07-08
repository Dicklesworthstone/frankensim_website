"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion";
import { Waves, Play, Pause, AlertTriangle } from "lucide-react";
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
const TEAL = "#14b8a6";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";
const SLATE = "#64748b";

const K = 6; // modes solved
const MODE_COLORS = [CYAN_GLOW, VIOLET, EMERALD, AMBER, ROSE, TEAL];
const PERIOD1 = 5; // seconds for the fundamental to complete one oscillation

function useReducedMotionSafe(): boolean {
  const rm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Defer past hydration so the first client render matches the server (false),
    // then adopt the real preference — without a synchronous setState in the effect.
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
/*  Compute state                                                      */
/* ------------------------------------------------------------------ */

interface Mode {
  eig: number; // ω² (numeric eigenvalue)
  analytic: number; // 2 - 2cos(π m /(n+1))
  vec: Float64Array; // length n, unit-norm
  maxAbs: number;
  omegaNorm: number; // animation angular speed (rad/s)
}

interface EigState {
  n: number;
  modes: Mode[];
  ms: number;
}

/* canvas backing (2× for crisp lines) */
const CW = 1280;
const CH = 460;
const M_L = 52;
const M_R = 52;
const M_T = 48;

export default function Eigenmodes() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();

  const [n, setN] = useState(64);
  const [mode, setMode] = useState(1); // 1-indexed
  const [overlay, setOverlay] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [computing, setComputing] = useState(false);
  const [state, setState] = useState<EigState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // Virtual clock: advances only while the loop runs, so pausing off-screen and
  // resuming never snaps the standing wave to a new phase.
  const elapsedRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  const stateRef = useRef<EigState | null>(null);
  const modeRef = useRef(mode);
  const overlayRef = useRef(overlay);
  stateRef.current = state;
  modeRef.current = mode;
  overlayRef.current = overlay;

  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const out = await call<Float64Array>("laplacian_modes", n, K);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const eigs = out.slice(0, K);
        const omega1 = Math.sqrt(Math.max(eigs[0], 1e-12));
        const speed = (2 * Math.PI) / PERIOD1 / omega1; // normalize so mode 1 = PERIOD1 s
        const modes: Mode[] = [];
        for (let m = 0; m < K; m++) {
          const vec = out.slice(K + m * n, K + (m + 1) * n);
          let maxAbs = 0;
          for (let i = 0; i < vec.length; i++) maxAbs = Math.max(maxAbs, Math.abs(vec[i]));
          const analytic = 2 - 2 * Math.cos((Math.PI * (m + 1)) / (n + 1));
          modes.push({
            eig: eigs[m],
            analytic,
            vec,
            maxAbs: maxAbs || 1,
            omegaNorm: Math.sqrt(Math.max(eigs[m], 0)) * speed,
          });
        }
        setState({ n, modes, ms });
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, n, call]);

  /* ---- draw one frame at elapsed seconds ---- */
  const draw = useCallback((elapsed: number) => {
    const canvas = canvasRef.current;
    const st = stateRef.current;
    if (!canvas || !st) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const midY = CH / 2;
    const plotW = CW - M_L - M_R;
    const amp = (CH / 2 - M_T) * 0.84;
    const nn = st.n;

    // background: vignette + central glow band
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CW, CH);
    const vg = ctx.createRadialGradient(CW / 2, midY, 40, CW / 2, midY, CW * 0.62);
    vg.addColorStop(0, "rgba(11,26,36,0.9)");
    vg.addColorStop(1, "rgba(4,9,13,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CW, CH);

    const xAt = (i: number) => M_L + ((i + 1) / (nn + 1)) * plotW; // interior node i → x

    // baseline (string at rest)
    ctx.strokeStyle = `${SLATE}55`;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(M_L, midY);
    ctx.lineTo(CW - M_R, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    const strokeMode = (m: Mode, cosF: number, color: string, alpha: number, glow: number, width: number) => {
      const scale = (amp / m.maxAbs) * cosF;
      ctx.beginPath();
      ctx.moveTo(M_L, midY); // fixed left endpoint
      for (let i = 0; i < nn; i++) ctx.lineTo(xAt(i), midY - m.vec[i] * scale);
      ctx.lineTo(CW - M_R, midY); // fixed right endpoint
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      if (glow > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = glow;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    // faint overlay of every non-selected mode
    if (overlayRef.current) {
      for (let m = 0; m < st.modes.length; m++) {
        if (m + 1 === modeRef.current) continue;
        const mm = st.modes[m];
        strokeMode(mm, Math.cos(mm.omegaNorm * elapsed), MODE_COLORS[m], 0.14, 0, 2);
      }
    }

    const sel = st.modes[modeRef.current - 1];
    if (sel) {
      const color = MODE_COLORS[modeRef.current - 1];

      // resonance envelope — the region the string sweeps through (±max displacement)
      const envScale = amp / sel.maxAbs;
      ctx.beginPath();
      ctx.moveTo(M_L, midY);
      for (let i = 0; i < nn; i++) ctx.lineTo(xAt(i), midY - Math.abs(sel.vec[i]) * envScale);
      ctx.lineTo(CW - M_R, midY);
      for (let i = nn - 1; i >= 0; i--) ctx.lineTo(xAt(i), midY + Math.abs(sel.vec[i]) * envScale);
      ctx.closePath();
      const eg = ctx.createLinearGradient(0, M_T, 0, CH - M_T);
      eg.addColorStop(0, `${color}22`);
      eg.addColorStop(0.5, `${color}08`);
      eg.addColorStop(1, `${color}22`);
      ctx.fillStyle = eg;
      ctx.fill();

      // motion-blur trail: a few previous phases at decreasing alpha
      const dt = 0.05;
      for (let g = 3; g >= 1; g--) {
        strokeMode(sel, Math.cos(sel.omegaNorm * (elapsed - g * dt)), color, 0.06 * (4 - g), 0, 2.4);
      }

      // the bright, glowing instantaneous string
      const cosF = Math.cos(sel.omegaNorm * elapsed);
      strokeMode(sel, cosF, color, 1, 20, 4.5);

      const scale = (amp / sel.maxAbs) * cosF;

      // interior nodes (sign changes of the eigenvector) glow on the baseline
      for (let i = 0; i < nn - 1; i++) {
        if (sel.vec[i] === 0 || sel.vec[i] * sel.vec[i + 1] < 0) {
          const frac = sel.vec[i] === 0 ? 0 : Math.abs(sel.vec[i]) / (Math.abs(sel.vec[i]) + Math.abs(sel.vec[i + 1]));
          const nx = xAt(i) + (xAt(i + 1) - xAt(i)) * frac;
          ctx.beginPath();
          ctx.arc(nx, midY, 3.4, 0, Math.PI * 2);
          ctx.fillStyle = EMERALD;
          ctx.shadowColor = EMERALD;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // antinode markers (local extrema of |vec|), scaled with the oscillation
      for (let i = 0; i < nn; i++) {
        const a = Math.abs(sel.vec[i]);
        const l = i > 0 ? Math.abs(sel.vec[i - 1]) : -1;
        const r = i < nn - 1 ? Math.abs(sel.vec[i + 1]) : -1;
        if (a >= l && a >= r && a > 0.45 * sel.maxAbs) {
          ctx.beginPath();
          ctx.arc(xAt(i), midY - sel.vec[i] * scale, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = "#eafcff";
          ctx.shadowColor = color;
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(xAt(i), midY - sel.vec[i] * scale, 6.5, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    }

    // fixed clamps at the two ends
    ctx.fillStyle = MUTED;
    ctx.fillRect(M_L - 7, midY - 14, 7, 28);
    ctx.fillRect(CW - M_R, midY - 14, 7, 28);
  }, []);

  /* ---- animation loop (paused while the panel is off-screen) ---- */
  useEffect(() => {
    if (!state) return;
    if (reduced || !playing) {
      draw(0); // frozen at maximum displacement (cos = 1)
      return;
    }
    // Off-screen: hold the current frame, run no rAF (resumes on re-enter).
    if (!inView) {
      draw(elapsedRef.current);
      return;
    }
    lastTsRef.current = null;
    const tick = (now: number) => {
      if (lastTsRef.current !== null) elapsedRef.current += (now - lastTsRef.current) / 1000;
      lastTsRef.current = now;
      draw(elapsedRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [state, playing, reduced, inView, mode, overlay, draw]);

  const sel = state ? state.modes[mode - 1] : null;
  const eigErr = sel ? Math.abs(sel.eig - sel.analytic) : 0;
  const period = sel && sel.omegaNorm > 0 ? (2 * Math.PI) / sel.omegaNorm : 0;

  // frequency ladder + worst-case agreement across all modes
  const ladder = useMemo(() => {
    if (!state) return null;
    const freqs = state.modes.map((m) => Math.sqrt(Math.max(m.eig, 0)));
    const aFreqs = state.modes.map((m) => Math.sqrt(Math.max(m.analytic, 0)));
    const maxF = Math.max(...freqs, ...aFreqs, 1e-9);
    let worst = 0;
    for (const m of state.modes) worst = Math.max(worst, Math.abs(m.eig - m.analytic));
    return { freqs, aFreqs, maxF, worst };
  }, [state]);

  const LW = 720;
  const LH = 96;

  return (
    <SyncContainer withPulse accentColor="#06b6d4" className="p-4 md:p-6 bg-black/40">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Eyebrow>Demo 08 · fs-la · Jacobi eigensolver</Eyebrow>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${CYAN}33`, background: `${CYAN}12`, color: CYAN }}
            >
              <Waves className="h-5 w-5" />
            </div>
            <h3 className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              Standing waves, <span className="text-cyan-400">solved</span>.
            </h3>
          </div>
        </div>
        <LiveBadge computing={computing} />
      </div>

      {/* canvas */}
      <div ref={viewRef} className="relative min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="block w-full max-w-full"
          style={{ aspectRatio: `${CW} / ${CH}` }}
          role="img"
          aria-label={`Vibrational mode ${mode} of a clamped string, an eigenvector of the discrete Laplacian, oscillating as a standing wave.`}
        />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          <span
            className="w-fit rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest"
            style={{ borderColor: `${CYAN}44`, background: `${BG}cc`, color: MODE_COLORS[mode - 1] }}
          >
            mode {mode} · {mode} antinode{mode > 1 ? "s" : ""} · {mode - 1} node{mode - 1 === 1 ? "" : "s"}
          </span>
          {sel && (
            <span className="w-fit rounded px-2 py-0.5 font-mono text-[9px] font-semibold" style={{ background: `${BG}cc`, color: MUTED }}>
              ω = √λ = {Math.sqrt(sel.eig).toFixed(5)} · T ≈ {period.toFixed(2)}s
            </span>
          )}
        </div>
        {ladder && (
          <div className="pointer-events-none absolute right-3 top-3">
            <span
              className="w-fit rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest"
              style={{ borderColor: `${EMERALD}55`, background: `${BG}cc`, color: EMERALD }}
            >
              numeric = analytic · Δλ ≤ {ladder.worst.toExponential(0)}
            </span>
          </div>
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: `${AMBER}cc` }}>
              REANIMATING KERNEL…
            </span>
          </div>
        )}
      </div>

      {/* frequency ladder — numeric bars vs analytic ticks */}
      <div className="mt-3 min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <div className="flex items-center justify-between px-3 pt-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            frequency ladder √λₘ · numeric bars vs analytic ticks
          </span>
          <span className="font-mono text-[9px]" style={{ color: SLATE }}>
            {K} lowest modes
          </span>
        </div>
        <svg viewBox={`0 0 ${LW} ${LH}`} className="block w-full max-w-full" role="img" aria-label="Frequency ladder: each mode's numeric square-root eigenvalue as a bar with the analytic value marked, showing they coincide.">
          {ladder &&
            ladder.freqs.map((f, i) => {
              const pad = 14;
              const bw = (LW - 2 * pad) / K;
              const x = pad + i * bw;
              const maxH = LH - 30;
              const h = (f / ladder.maxF) * maxH;
              const y = LH - 14 - h;
              const aH = (ladder.aFreqs[i] / ladder.maxF) * maxH;
              const aY = LH - 14 - aH;
              const c = MODE_COLORS[i];
              const isSel = i + 1 === mode;
              return (
                <g key={`bar-${i}`}>
                  <rect x={x + bw * 0.2} y={y} width={bw * 0.6} height={h} rx={2} fill={isSel ? c : `${c}66`} style={isSel ? { filter: `drop-shadow(0 0 4px ${c})` } : undefined} />
                  {/* analytic tick */}
                  <line x1={x + bw * 0.14} y1={aY} x2={x + bw * 0.86} y2={aY} stroke="#eafcff" strokeWidth={1.4} />
                  <text x={x + bw / 2} y={LH - 3} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={isSel ? c : MUTED}>
                    m{i + 1}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {/* eigenvalue accuracy card */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${CYAN}33`, background: `${CYAN}0d` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            eigenvalue λ (numeric)
          </div>
          <div className="font-mono text-lg font-black tabular-nums" style={{ color: CYAN_GLOW }}>
            {sel ? sel.eig.toExponential(8) : "—"}
          </div>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${VIOLET}33`, background: `${VIOLET}0d` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            analytic 2−2cos(πm/(n+1))
          </div>
          <div className="font-mono text-lg font-black tabular-nums" style={{ color: VIOLET }}>
            {sel ? sel.analytic.toExponential(8) : "—"}
          </div>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${EMERALD}33`, background: `${EMERALD}0d` }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            |numeric − analytic|
          </div>
          <div className="font-mono text-lg font-black tabular-nums" style={{ color: EMERALD }}>
            {sel ? eigErr.toExponential(2) : "—"}
          </div>
        </div>
      </div>

      {error && <div className="mt-3">{<ErrorNote message={error} />}</div>}

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          mode
        </span>
        {[1, 2, 3, 4, 5, 6].map((m) => (
          <Pill key={m} onClick={() => setMode(m)} active={mode === m} color={MODE_COLORS[m - 1]} ariaLabel={`Show vibrational mode ${m}`} disabled={!ready}>
            {m}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
          nodes
        </span>
        {[32, 48, 64].map((g) => (
          <Pill key={g} onClick={() => setN(g)} active={n === g} ariaLabel={`Set string resolution to ${g} interior nodes`} disabled={!ready}>
            {g}
          </Pill>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: BORDER }} />
        <Pill onClick={() => setPlaying((p) => !p)} active={playing && !reduced} color={EMERALD} ariaLabel={playing ? "Pause vibration" : "Play vibration"} disabled={!ready || reduced}>
          {playing && !reduced ? <Pause size={13} /> : <Play size={13} />}
          {playing && !reduced ? "Pause" : "Play"}
        </Pill>
        <Pill onClick={() => setOverlay((v) => !v)} active={overlay} color={VIOLET} ariaLabel="Overlay all modes faintly">
          Overlay all
        </Pill>
      </div>

      {/* readout */}
      <div className="mt-4 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> {n}×{n} tridiagonal [−1, 2, −1] Laplacian · symmetric Jacobi eigensolve · {K} lowest modes
        {state ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> mode {mode} matches analytic to{" "}
            <span style={{ color: EMERALD }}>{eigErr.toExponential(1)}</span>{" "}
            <span style={{ color: MUTED }}>│</span> {state.ms.toFixed(1)} ms
          </>
        ) : (
          <span style={{ color: MUTED }}> · reanimating kernel…</span>
        )}
      </div>

      {/* caption */}
      <div className="mt-5 border-t pt-4 text-sm leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A real symmetric eigensolver,{" "}
        <span className="font-mono text-cyan-300">fs-la</span>&apos;s Jacobi rotation, diagonalizes the discrete 1-D
        Laplacian, and each eigenvector <em>is</em> a vibrational mode of a clamped string. The animation scales the
        eigenvector by cos(√λ·t), using the eigenvalue as ω², so higher modes vibrate faster in the exact ratio the
        physics demands; the shaded envelope traces the full sweep and the emerald dots pin the stationary nodes. The
        computed eigenvalues match the analytic standing-wave frequencies to machine precision (~1e-15). This is the
        math behind every drum, bridge and molecule, solved live rather than scripted.
      </div>
    </SyncContainer>
  );
}
