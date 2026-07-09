"use client";

/**
 * Campaign 03 — fluttercert(lo, hi, steps)  ·  fs-flutter-e2e
 * "Two proofs land on one boundary."
 *
 * A 2-DOF aeroelastic operator is asymptotically stable iff the added-mass
 * parameter μ < 2 — the flutter boundary μ* = 2. TWO independent certificates
 * recover the SAME proven boundary: a Lyapunov sum-of-squares certificate
 * (lyapunov_stable flips) and the symmetric-part spectral abscissa (which crosses
 * zero at the same μ). Their agreeing is the certifier cross-checking itself.
 * Separately, a naive partitioned FSI solve diverges early (~μ≈0.95) while Aitken
 * relaxation reaches the boundary (~μ≈1.95); the Verified witness μ is where the
 * proof holds, naive fails, and only Aitken converges.
 *
 * Top: μ-axis with a stable (emerald) / flutter (rose) split at the proven μ*, the
 * spectral-abscissa curve sweeping up through zero at that same μ. Bottom: the
 * naive-vs-Aitken reach, each dot a real per-μ convergence verdict.
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
  useReducedMotionSafe,
  Eyebrow,
  LiveBadge,
  Slider,
  ErrorNote,
  BootOverlay,
} from "@/components/wasm/deep/_chrome";

interface Sample {
  mu: number;
  lyapStable: boolean;
  abscissa: number;
  naive: boolean;
  aitken: boolean;
}
interface FCData {
  samples: Sample[];
  lyapBoundary: number;
  spectralBoundary: number;
  agree: boolean;
  naiveBoundary: number;
  aitkenBoundary: number;
  aitkenBeats: boolean;
  witnessMu: number;
  witnessVerified: boolean;
  ms: number;
}

export default function FlutterBoundary() {
  const { ready, call } = useFsWasm();
  const reduced = useReducedMotionSafe();
  const { ref: viewRef, inView, inViewRef } = useInView<HTMLDivElement>();

  const [lo, setLo] = useState(0.55);
  const [hi, setHi] = useState(2.45);
  const [steps, setSteps] = useState(20);
  const [data, setData] = useState<FCData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<FCData | null>(null);
  dataRef.current = data;
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);
  const revealRef = useRef(0);
  const seenRef = useRef(false);

  const muStarRef = useEasedText<HTMLSpanElement>(data?.lyapBoundary ?? 0, reduced, (v) => v.toFixed(3), {
    enabled: !!data && Number.isFinite(data.lyapBoundary),
    inViewRef,
  });

  /* -- compute (latest-wins) -- */
  useEffect(() => {
    if (!ready) return;
    const token = ++tokenRef.current;
    setComputing(true);
    setError(null);
    (async () => {
      try {
        const t0 = performance.now();
        const raw = await call<Float64Array>("fluttercert", lo, hi, steps);
        const ms = performance.now() - t0;
        if (tokenRef.current !== token) return;
        const S = Math.round(raw[0]);
        const samples: Sample[] = [];
        for (let i = 0; i < S; i++) {
          const b = 9 + 5 * i;
          samples.push({
            mu: raw[b],
            lyapStable: raw[b + 1] > 0.5,
            abscissa: raw[b + 2],
            naive: raw[b + 3] > 0.5,
            aitken: raw[b + 4] > 0.5,
          });
        }
        setData({
          samples,
          lyapBoundary: raw[1],
          spectralBoundary: raw[2],
          agree: raw[3] > 0.5,
          naiveBoundary: raw[4],
          aitkenBoundary: raw[5],
          aitkenBeats: raw[6] > 0.5,
          witnessMu: raw[7],
          witnessVerified: raw[8] > 0.5,
          ms,
        });
      } catch (e) {
        if (tokenRef.current === token) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (tokenRef.current === token) setComputing(false);
      }
    })();
  }, [ready, lo, hi, steps, call]);

  const draw = useCallback(
    (reveal: number, time: number) => {
      const canvas = canvasRef.current;
      const d = dataRef.current;
      if (!canvas || !d || d.samples.length === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      const padL = W * 0.06;
      const padR = W * 0.05;
      const plotW = W - padL - padR;
      const fs = Math.max(8, W / 60);

      const muLo = d.samples[0].mu;
      const muHi = d.samples[d.samples.length - 1].mu;
      const span = Math.max(1e-6, muHi - muLo);
      const X = (mu: number) => padL + ((mu - muLo) / span) * plotW;

      const topT = H * 0.09;
      const topB = H * 0.58;
      const midY = (topT + topB) / 2;
      const halfH = (topB - topT) / 2;
      const axisY = H * 0.64;
      const laneNaiveY = H * 0.79;
      const laneAitkenY = H * 0.92;

      let aMax = 1e-6;
      for (const s of d.samples) if (Number.isFinite(s.abscissa)) aMax = Math.max(aMax, Math.abs(s.abscissa));
      const AY = (a: number) => midY - (a / aMax) * halfH * 0.92;

      const muStar = Number.isFinite(d.lyapBoundary) ? d.lyapBoundary : muHi;
      const clipX = padL + reveal * plotW;

      // stable / flutter background split at μ*
      const sx = Math.min(W - padR, Math.max(padL, X(muStar)));
      ctx.fillStyle = "rgba(16,185,129,0.06)";
      ctx.fillRect(padL, topT, sx - padL, topB - topT);
      ctx.fillStyle = "rgba(244,63,94,0.07)";
      ctx.fillRect(sx, topT, W - padR - sx, topB - topT);

      // zero line (abscissa = 0)
      ctx.strokeStyle = "rgba(148,163,184,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(W - padR, midY);
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("spectral abscissa = 0", padL + 4, midY - 3);

      // region labels
      ctx.textBaseline = "top";
      ctx.fillStyle = EMERALD;
      ctx.textAlign = "left";
      ctx.fillText("STABLE", padL + 4, topT + 2);
      ctx.fillStyle = ROSE;
      ctx.textAlign = "right";
      ctx.fillText("FLUTTER", W - padR - 4, topT + 2);

      // abscissa curve (clipped reveal)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipX + 2, H);
      ctx.clip();
      ctx.beginPath();
      let started = false;
      for (const s of d.samples) {
        if (!Number.isFinite(s.abscissa)) {
          started = false;
          continue;
        }
        const px = X(s.mu);
        const py = AY(s.abscissa);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = CYAN_GLOW;
      ctx.lineWidth = Math.max(1.6, W / 320);
      ctx.shadowColor = CYAN_GLOW;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // sample markers colored by Lyapunov verdict
      for (const s of d.samples) {
        if (!Number.isFinite(s.abscissa)) continue;
        const px = X(s.mu);
        if (px > clipX + 2) continue;
        ctx.beginPath();
        ctx.arc(px, AY(s.abscissa), Math.max(0.1, Math.max(2, W / 260)), 0, Math.PI * 2);
        ctx.fillStyle = s.lyapStable ? EMERALD : ROSE;
        ctx.fill();
      }
      ctx.restore();

      // μ* divider (Lyapunov boundary) — bold, with a soft glow
      if (X(muStar) <= clipX + 2) {
        ctx.strokeStyle = `${CYAN_GLOW}22`;
        ctx.lineWidth = Math.max(3, W / 150);
        ctx.beginPath();
        ctx.moveTo(sx, topT);
        ctx.lineTo(sx, topB);
        ctx.stroke();
        ctx.strokeStyle = BRIGHT;
        ctx.lineWidth = Math.max(1.4, W / 380);
        ctx.setLineDash([2, 3]);
        ctx.shadowColor = CYAN_GLOW;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(sx, topT);
        ctx.lineTo(sx, topB);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.fillStyle = BRIGHT;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`μ* = ${muStar.toFixed(3)}`, sx, topT - 1 + fs);
      }

      // spectral zero-crossing needle + agreement marker
      if (Number.isFinite(d.spectralBoundary)) {
        const spx = X(d.spectralBoundary);
        if (spx <= clipX + 2) {
          ctx.strokeStyle = `${CYAN}88`;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(spx, topT);
          ctx.lineTo(spx, topB);
          ctx.stroke();
          ctx.setLineDash([]);
          // the two needles meeting the zero line
          const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(time * 0.005);
          const mc = d.agree ? EMERALD : AMBER;
          const halo = ctx.createRadialGradient(spx, midY, Math.max(0, 0), spx, midY, Math.max(0.1, W / 60));
          halo.addColorStop(0, `${mc}55`);
          halo.addColorStop(1, `${mc}00`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(spx, midY, Math.max(0.1, W / 60), 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(spx, midY, Math.max(0.1, Math.max(4, W / 130) * pulse), 0, Math.PI * 2);
          ctx.strokeStyle = mc;
          ctx.lineWidth = Math.max(1.4, W / 300);
          ctx.shadowColor = mc;
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(spx, midY, Math.max(0.1, Math.max(1.4, W / 300)), 0, Math.PI * 2);
          ctx.fillStyle = mc;
          ctx.fill();
        }
      }

      // μ ticks + axis marker. Reserve the right edge for the "μ →" marker and
      // right-align the last tick so its number can never collide with the arrow.
      ctx.fillStyle = MUTED;
      ctx.font = `${Math.max(7, W / 70)}px ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      const axisMark = "μ →";
      ctx.textAlign = "right";
      ctx.fillText(axisMark, W - padR, axisY);
      const markW = ctx.measureText(axisMark).width;
      const tickGap = Math.max(6, W / 90);
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) {
        const mu = muLo + (span * i) / ticks;
        if (i === ticks) {
          ctx.textAlign = "right";
          ctx.fillText(mu.toFixed(2), W - padR - markW - tickGap, axisY);
        } else {
          ctx.textAlign = "center";
          ctx.fillText(mu.toFixed(2), X(mu), axisY);
        }
      }

      // reach lanes (naive vs Aitken)
      const drawLane = (y: number, label: string, boundary: number, color: string, key: (s: Sample) => boolean) => {
        ctx.strokeStyle = "rgba(148,163,184,0.18)";
        ctx.lineWidth = Math.max(2, W / 260);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        // filled reach up to boundary (reveal-gated)
        if (Number.isFinite(boundary)) {
          const bx = Math.min(clipX, X(boundary));
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(2.4, W / 200);
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(Math.max(padL, bx), y);
          ctx.stroke();
          ctx.shadowBlur = 0;
          if (X(boundary) <= clipX) {
            ctx.beginPath();
            ctx.arc(X(boundary), y, Math.max(0.1, Math.max(3, W / 170)), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }
        }
        // per-μ convergence dots (real data)
        for (const s of d.samples) {
          const px = X(s.mu);
          if (px > clipX + 2) continue;
          ctx.beginPath();
          ctx.arc(px, y, Math.max(0.1, Math.max(1.4, W / 360)), 0, Math.PI * 2);
          ctx.fillStyle = key(s) ? EMERALD : "rgba(244,63,94,0.55)";
          ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.font = `${Math.max(7, W / 66)}px ui-monospace, monospace`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(label, padL - 2, y);
      };
      drawLane(laneNaiveY, "naive", d.naiveBoundary, ROSE, (s) => s.naive);
      drawLane(laneAitkenY, "Aitken", d.aitkenBoundary, CYAN_GLOW, (s) => s.aitken);

      // witness μ (proof holds · naive fails · only Aitken converges)
      if (Number.isFinite(d.witnessMu)) {
        const wx = X(d.witnessMu);
        if (wx <= clipX + 2) {
          ctx.strokeStyle = `${AMBER}cc`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(wx, laneNaiveY - H * 0.05);
          ctx.lineTo(wx, laneAitkenY + H * 0.05);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(wx, laneNaiveY - H * 0.055);
          ctx.lineTo(wx - W * 0.011, laneNaiveY - H * 0.02);
          ctx.lineTo(wx + W * 0.011, laneNaiveY - H * 0.02);
          ctx.closePath();
          ctx.fillStyle = AMBER;
          ctx.shadowColor = AMBER;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = AMBER;
          ctx.font = `${Math.max(7, W / 66)}px ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`witness ${d.witnessVerified ? "✓" : ""}`, wx, laneNaiveY - H * 0.065);
        }
      }
    },
    [reduced],
  );

  /* -- DPR sizing + redraw -- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const d = dpr();
      const cssW = canvas.clientWidth || 480;
      const w = Math.max(240, Math.min(1100, Math.round(cssW * d)));
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

  /* -- reveal on first data -- */
  useEffect(() => {
    if (!data) return;
    if (!seenRef.current) {
      seenRef.current = true;
      revealStartRef.current = performance.now();
      revealRef.current = 0;
    } else {
      revealRef.current = 1;
    }
  }, [data]);

  /* -- animation loop (gated) -- */
  useEffect(() => {
    if (!data) return;
    if (reduced || !inView) {
      revealRef.current = 1;
      revealStartRef.current = null;
      draw(1, 0);
      return;
    }
    const DUR = 1500;
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

  // keep lo < hi with the kernel's ≥ lo+0.1 gap
  const onLo = (v: number) => {
    setLo(v);
    if (hi < v + 0.1) setHi(Math.min(3.0, v + 0.1));
  };
  const onHi = (v: number) => setHi(Math.max(lo + 0.1, Math.min(3.0, v)));

  return (
    <SyncContainer withPulse accentColor={CYAN} className="bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Eyebrow>Campaign 03 · fs-flutter-e2e · Lyapunov × spectral</Eyebrow>
          <h3 className="text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
            Two proofs land on one <span className="text-cyan-400">boundary</span>.
          </h3>
        </div>
        <LiveBadge computing={computing} />
      </div>

      <div ref={viewRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: BG }}>
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full"
          style={{ aspectRatio: "1 / 0.62" }}
          role="img"
          aria-label="A mu-axis split into stable and flutter regions at the proven boundary, with the spectral-abscissa curve crossing zero at the same mu, and naive-versus-Aitken convergence reach below"
        />
        {!ready && <BootOverlay />}
      </div>

      {/* certificate chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px]">
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest"
          style={{
            borderColor: `${data?.agree ? EMERALD : AMBER}55`,
            background: `${data?.agree ? EMERALD : AMBER}12`,
            color: data?.agree ? EMERALD : AMBER,
          }}
        >
          boundaries {data?.agree ? "agree ✓" : "differ"}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest"
          style={{
            borderColor: `${data?.aitkenBeats ? CYAN_GLOW : MUTED}55`,
            background: `${data?.aitkenBeats ? CYAN_GLOW : MUTED}12`,
            color: data?.aitkenBeats ? CYAN_GLOW : MUTED,
          }}
        >
          Aitken {data?.aitkenBeats ? "beats naive" : "≈ naive"}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-widest"
          style={{
            borderColor: `${data?.witnessVerified ? EMERALD : MUTED}55`,
            background: `${data?.witnessVerified ? EMERALD : MUTED}12`,
            color: data?.witnessVerified ? EMERALD : MUTED,
          }}
        >
          witness {data && Number.isFinite(data.witnessMu) ? (data.witnessVerified ? "Verified" : "found") : "none"}
        </span>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <Slider label="μ lo" value={lo} min={0.05} max={2.9} step={0.05} onChange={onLo} format={(v) => v.toFixed(2)} disabled={!ready} />
        <Slider label="μ hi" value={hi} min={0.15} max={3.0} step={0.05} onChange={onHi} format={(v) => v.toFixed(2)} color={ROSE} disabled={!ready} />
        <Slider label="steps" value={steps} min={2} max={200} step={1} onChange={(v) => setSteps(Math.round(v))} format={(v) => String(Math.round(v))} color={VIOLET} disabled={!ready} />
      </div>

      <div className="mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}>
        <span style={{ color: CYAN_GLOW }}>›</span> Lyapunov μ* = <span style={{ color: EMERALD }}><span ref={muStarRef}>{data && Number.isFinite(data.lyapBoundary) ? data.lyapBoundary.toFixed(3) : "—"}</span></span> ·
        spectral μ* = <span style={{ color: CYAN_GLOW }}>{data && Number.isFinite(data.spectralBoundary) ? data.spectralBoundary.toFixed(3) : "—"}</span> · naive→
        <span style={{ color: ROSE }}>{data && Number.isFinite(data.naiveBoundary) ? data.naiveBoundary.toFixed(3) : "—"}</span> · Aitken→
        <span style={{ color: CYAN_GLOW }}>{data && Number.isFinite(data.aitkenBoundary) ? data.aitkenBoundary.toFixed(3) : "—"}</span>
        {data ? (
          <>
            {" "}
            <span style={{ color: MUTED }}>│</span> <span style={{ color: EMERALD }}>{data.ms.toFixed(2)} ms in WASM</span>
          </>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3 text-[13px] leading-relaxed text-slate-400" style={{ borderColor: BORDER }}>
        A 2-DOF <span className="text-slate-200">aeroelastic</span> operator is asymptotically stable exactly while the added-mass
        parameter <span className="text-slate-200">μ &lt; 2</span>. The flutter boundary sits at <span style={{ color: BRIGHT }}>μ* = 2</span>.
        FrankenSim certifies it two independent ways: a <span style={{ color: EMERALD }}>Lyapunov sum-of-squares</span> proof (the
        emerald/rose split) and the <span style={{ color: CYAN_GLOW }}>spectral abscissa</span> sweeping up through zero at the very
        same μ. When those two needles land on one line, the certifier has <span className="text-slate-200">cross-checked itself</span>.
        Below, a naive partitioned fluid–structure solve <span style={{ color: ROSE }}>diverges early</span> while{" "}
        <span style={{ color: CYAN_GLOW }}>Aitken relaxation</span> pushes almost to the boundary; the amber{" "}
        <span style={{ color: AMBER }}>witness</span> marks the Verified μ where only Aitken survives. Every dot is a real
        convergence verdict from compiled Rust.
      </div>
    </SyncContainer>
  );
}
