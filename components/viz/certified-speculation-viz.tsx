"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Play, Pause, StepForward, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const VIOLET = "#a855f7";
const AMBER = "#f59e0b";
const BLUE = "#3b82f6";
const ROSE = "#f43f5e";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Flywheel model                                                     */
/* ------------------------------------------------------------------ */

const SPAWN_X = 178;
const GATE_X = 372;
const SLOTS = 16;
const TARGET = 42; // total candidates the proposer bank will emit
const CORRECT = 9; // candidates that actually pass the certified accept test
const LANE_Y = [128, 210, 292];

const PROPOSERS = [
  { key: "surrogate", label: "surrogate model", tag: "NN emulator", color: VIOLET },
  { key: "coarse", label: "coarse solve", tag: "h/2 mesh", color: AMBER },
  { key: "ml", label: "ML guess", tag: "learned prior", color: BLUE },
] as const;

const GUESS_SYMS = ["σ", "κ", "ρ", "û", "ŷ"];

/* deterministic LCG — no Math.random anywhere */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* predetermined verdicts: exactly k correct out of n, shuffled deterministically */
function makeVerdicts(seed: number, n: number, k: number): boolean[] {
  const arr = Array.from({ length: n }, (_, i) => i < k);
  const rng = makeRng(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
const VERDICTS = makeVerdicts(0x5eed1234, TARGET, CORRECT);

function slotPos(slot: number): { x: number; y: number } {
  return { x: 500 + (slot % 4) * 60, y: 152 + Math.floor(slot / 4) * 50 };
}

type TokenKind = "verified" | "rejected" | "false";

interface Token {
  id: number;
  color: string;
  y0: number;
  guess: string;
  kind: TokenKind;
  slotX: number;
  slotY: number;
  totalMs: number;
  gateMs: number;
}

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  color,
  label,
  ariaLabel,
  active,
  children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  ariaLabel: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-xs transition-colors hover:bg-white/5",
      )}
      style={{
        borderColor: `${color}${active ? "" : "44"}`,
        color,
        background: active ? `${color}1a` : "transparent",
      }}
    >
      {children}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function CertifiedSpeculationViz() {
  const reduced = useReducedMotion() ?? false;

  const [tokens, setTokens] = useState<Token[]>([]);
  const [stats, setStats] = useState({ proposed: 0, verified: 0, rejected: 0 });
  const [playing, setPlaying] = useState(false);
  const [blind, setBlind] = useState(false);
  const [falseCert, setFalseCert] = useState(false);
  const [done, setDone] = useState(false);

  const rngRef = useRef(makeRng(0xa17f00d));
  const proposedRef = useRef(0);
  const slotRef = useRef(0);
  const slotOccupantRef = useRef<Record<number, number>>({});
  const idRef = useRef(0);
  const blindRef = useRef(false);
  const playingRef = useRef(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  const schedule = useCallback(
    (fn: () => void, ms: number) => {
      const id = setTimeout(fn, reduced ? 0 : ms);
      timersRef.current.push(id);
    },
    [reduced],
  );

  const stopPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    playingRef.current = false;
    setPlaying(false);
  }, []);

  /* ---- spawn one candidate through the flywheel ---- */
  const spawnOne = useCallback(() => {
    if (proposedRef.current >= TARGET) {
      stopPlay();
      setDone(true);
      return;
    }
    const rng = rngRef.current;
    const idx = proposedRef.current;
    const correct = VERDICTS[idx];
    const isBlind = blindRef.current;
    const accepted = isBlind ? true : correct;
    const isFalse = isBlind && !correct;

    const lane = Math.floor(rng() * 3);
    const y0 = LANE_Y[lane] + Math.round((rng() - 0.5) * 30);
    const color = PROPOSERS[lane].color;
    const guess = `${GUESS_SYMS[Math.floor(rng() * GUESS_SYMS.length)]}=${(rng() * 9).toFixed(1)}`;

    let slotX = 0;
    let slotY = 0;
    let prevOccupant = -1;
    if (accepted) {
      const slot = slotRef.current % SLOTS;
      slotRef.current += 1;
      const p = slotPos(slot);
      slotX = p.x;
      slotY = p.y;
      prevOccupant = slotOccupantRef.current[slot] ?? -1;
      slotOccupantRef.current[slot] = idRef.current;
    }

    const gateMs = reduced ? 0 : 1000;
    const totalMs = reduced ? 0 : accepted ? 1900 : 1650;
    const kind: TokenKind = accepted ? (isFalse ? "false" : "verified") : "rejected";
    const id = idRef.current++;

    const token: Token = { id, color, y0, guess, kind, slotX, slotY, totalMs, gateMs };
    proposedRef.current += 1;
    setStats((s) => ({ ...s, proposed: s.proposed + 1 }));
    setTokens((prev) => [...prev, token]);

    // resolve at the gate: tally + recycle the pile slot
    schedule(() => {
      setStats((s) =>
        accepted ? { ...s, verified: s.verified + 1 } : { ...s, rejected: s.rejected + 1 },
      );
      if (accepted && prevOccupant >= 0) {
        setTokens((prev) => prev.filter((t) => t.id !== prevOccupant));
      }
      if (isFalse) setFalseCert(true);
    }, gateMs);

    // rejected candidates bounce off and are removed once faded
    if (!accepted) {
      schedule(() => {
        setTokens((prev) => prev.filter((t) => t.id !== id));
      }, totalMs + 40);
    }

    if (proposedRef.current >= TARGET) {
      stopPlay();
      schedule(() => setDone(true), gateMs);
    }
  }, [reduced, schedule, stopPlay]);

  const start = useCallback(() => {
    if (playingRef.current || proposedRef.current >= TARGET) return;
    playingRef.current = true;
    setPlaying(true);
    spawnOne();
    intervalRef.current = setInterval(spawnOne, reduced ? 240 : 470);
  }, [spawnOne, reduced]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) stopPlay();
    else start();
  }, [start, stopPlay]);

  const step = useCallback(() => {
    stopPlay();
    spawnOne();
  }, [spawnOne, stopPlay]);

  const toggleBlind = useCallback(() => {
    setBlind((b) => {
      blindRef.current = !b;
      return !b;
    });
  }, []);

  const reset = useCallback(() => {
    stopPlay();
    clearTimers();
    rngRef.current = makeRng(0xa17f00d);
    proposedRef.current = 0;
    slotRef.current = 0;
    slotOccupantRef.current = {};
    idRef.current = 0;
    setTokens([]);
    setStats({ proposed: 0, verified: 0, rejected: 0 });
    setFalseCert(false);
    setDone(false);
  }, [stopPlay, clearTimers]);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  const saved =
    stats.proposed > 0 ? Math.floor((stats.rejected / stats.proposed) * 100) : 0;
  const readout = `proposed ${stats.proposed} · verified ${stats.verified} · rejected ${stats.rejected} · cost saved ${saved}%`;
  const lamp = falseCert ? ROSE : playing ? CYAN_GLOW : done ? CYAN : SLATE;

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border"
      style={{ background: SURFACE, borderColor: BORDER }}
    >
      {/* Header control bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: BORDER, background: BG }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: lamp, boxShadow: `0 0 8px ${lamp}aa` }}
          />
          <span className="truncate font-mono text-xs sm:text-sm" style={{ color: BRIGHT }}>
            {readout}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CtrlButton onClick={step} color={CYAN} label="Step" ariaLabel="Emit one candidate">
            <StepForward size={12} />
          </CtrlButton>
          <CtrlButton
            onClick={togglePlay}
            color={CYAN_GLOW}
            label={playing ? "Pause" : "Play"}
            ariaLabel={playing ? "Pause the candidate stream" : "Stream candidates through the verifier"}
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </CtrlButton>
          <CtrlButton
            onClick={toggleBlind}
            color={blind ? ROSE : SLATE}
            label="Trust blindly"
            ariaLabel="Toggle blindly trusting the proposer and bypassing the certified verifier"
            active={blind}
          >
            {blind ? <ShieldOff size={12} /> : <ShieldCheck size={12} />}
          </CtrlButton>
          <CtrlButton onClick={reset} color={SLATE} label="Reset" ariaLabel="Reset the flywheel">
            <RotateCcw size={12} />
          </CtrlButton>
        </div>
      </div>

      {/* SVG canvas */}
      <svg
        viewBox="0 0 760 440"
        className="w-full"
        style={{ maxHeight: 500 }}
        role="img"
        aria-label="Certified speculation flywheel: cheap proposers fire candidate answers into a certified equilibrated-flux verifier that either stamps a candidate verified or rejects it fail-closed, while a running tally shows how much expensive certification is saved"
      >
        <defs>
          <filter id="cs-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="cs-gate" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={CYAN} stopOpacity="0.05" />
            <stop offset="0.5" stopColor={CYAN_GLOW} stopOpacity="0.22" />
            <stop offset="1" stopColor={CYAN} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Column captions */}
        <text x={24} y={34} fill={MUTED} fontSize={11} fontFamily="monospace" letterSpacing={0.5}>
          PROPOSER BANK · cheap, possibly-wrong
        </text>
        <text x={GATE_X} y={34} textAnchor="middle" fill={CYAN_GLOW} fontSize={11} fontFamily="monospace" letterSpacing={0.5}>
          CERTIFIED VERIFIER
        </text>
        <text x={738} y={34} textAnchor="end" fill={CYAN_GLOW} fontSize={11} fontFamily="monospace" letterSpacing={0.5}>
          VERIFIED ✓ · accumulates
        </text>

        {/* Proposer nodes */}
        {PROPOSERS.map((p, i) => {
          const y = LANE_Y[i] - 26;
          return (
            <g key={p.key}>
              <rect x={22} y={y} width={150} height={52} rx={11} fill={`${p.color}14`} stroke={`${p.color}66`} strokeWidth={1} />
              <motion.circle
                cx={38}
                cy={y + 26}
                r={5}
                fill={p.color}
                animate={playing ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.7 }}
                transition={{ duration: reduced ? 0 : 0.9, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
              />
              <text x={54} y={y + 22} fill={BRIGHT} fontSize={12} fontFamily="monospace" fontWeight={600}>
                {p.label}
              </text>
              <text x={54} y={y + 38} fill={MUTED} fontSize={10} fontFamily="monospace">
                {p.tag}
              </text>
            </g>
          );
        })}

        {/* Feed rail */}
        <line x1={172} y1={210} x2={GATE_X - 34} y2={210} stroke={`${SLATE}55`} strokeWidth={1} strokeDasharray="3 4" />
        <text x={250} y={202} textAnchor="middle" fill={`${MUTED}88`} fontSize={9.5} fontFamily="monospace">
          propose →
        </text>

        {/* Verifier gate */}
        <rect x={GATE_X - 34} y={80} width={68} height={264} rx={14} fill="url(#cs-gate)" stroke={`${CYAN_GLOW}66`} strokeWidth={1.4} />
        <motion.line
          x1={GATE_X - 34}
          x2={GATE_X + 34}
          y1={92}
          y2={92}
          stroke={CYAN_GLOW}
          strokeWidth={1.6}
          opacity={0.8}
          animate={playing ? { y1: [92, 332, 92], y2: [92, 332, 92] } : { y1: 92, y2: 92 }}
          transition={{ duration: reduced ? 0 : 2.2, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
        />
        <text x={GATE_X} y={366} textAnchor="middle" fill={CYAN_GLOW} fontSize={10} fontFamily="monospace">
          Prager–Synge accept test
        </text>
        <text x={GATE_X} y={380} textAnchor="middle" fill={`${MUTED}aa`} fontSize={9} fontFamily="monospace">
          equilibrated-flux a-posteriori bound
        </text>
        {/* fail-closed drain */}
        <text x={GATE_X - 52} y={356} textAnchor="middle" fill={`${ROSE}bb`} fontSize={9.5} fontFamily="monospace">
          fail-closed ↓
        </text>

        {/* Pile backing */}
        <rect x={472} y={92} width={272} height={258} rx={14} fill={`${CYAN}08`} stroke={BORDER} strokeWidth={1} />
        {Array.from({ length: SLOTS }, (_, s) => {
          const p = slotPos(s);
          return <circle key={s} cx={p.x} cy={p.y} r={12} fill="none" stroke={`${SLATE}22`} strokeWidth={1} />;
        })}
        <text x={608} y={366} textAnchor="middle" fill={`${MUTED}aa`} fontSize={9.5} fontFamily="monospace">
          → certify (expensive) only survivors
        </text>

        {/* Candidate tokens */}
        <AnimatePresence>
          {tokens.map((t) => {
            const g = t.totalMs > 0 ? t.gateMs / t.totalMs : 0;
            const pass = t.kind !== "rejected";
            const dy = t.y0 < 210 ? -78 : 86;
            const stamp = t.kind === "false" ? ROSE : CYAN;
            const dur = t.totalMs / 1000;
            return (
              <motion.g
                key={t.id}
                initial={{ x: SPAWN_X, y: t.y0, opacity: 1 }}
                animate={
                  pass
                    ? { x: [SPAWN_X, GATE_X, t.slotX], y: [t.y0, t.y0, t.slotY] }
                    : {
                        x: [SPAWN_X, GATE_X, GATE_X - 16, GATE_X - 34],
                        y: [t.y0, t.y0, t.y0 + dy * 0.4, t.y0 + dy],
                        opacity: [1, 1, 1, 0],
                      }
                }
                exit={{ opacity: 0 }}
                transition={{
                  duration: dur,
                  times: pass ? [0, g, 1] : [0, g, g + 0.12, 1],
                  ease: "easeInOut",
                }}
              >
                <motion.rect
                  x={-19}
                  y={-10}
                  width={38}
                  height={20}
                  rx={6}
                  strokeWidth={1}
                  initial={{ fill: t.color, stroke: t.color }}
                  animate={
                    pass
                      ? { fill: [t.color, t.color, stamp], stroke: [t.color, t.color, stamp] }
                      : { fill: [t.color, t.color, ROSE, ROSE], stroke: [t.color, t.color, ROSE, ROSE] }
                  }
                  transition={{ duration: dur, times: pass ? [0, g, 1] : [0, g, g + 0.12, 1] }}
                  filter={t.kind === "false" ? "url(#cs-glow)" : undefined}
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill={BG}
                  fontSize={9}
                  fontFamily="monospace"
                  fontWeight={700}
                  style={{ pointerEvents: "none" }}
                >
                  {t.guess}
                </text>
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* False certificate alarm */}
        <AnimatePresence>
          {falseCert && (
            <motion.g
              key="false-cert"
              initial={{ opacity: 0, y: reduced ? 402 : 410 }}
              animate={{ opacity: 1, y: 402 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
            >
              <motion.rect
                x={210}
                y={0}
                width={340}
                height={26}
                rx={13}
                fill={`${ROSE}1e`}
                stroke={ROSE}
                strokeWidth={1.3}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: reduced ? 0 : 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
              <text x={380} y={17} textAnchor="middle" fill={ROSE} fontSize={11} fontFamily="monospace" fontWeight={700}>
                ⚠ false certificate! — verifier bypassed
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Motto (hidden while alarm shown) */}
        {!falseCert && (
          <text x={380} y={418} textAnchor="middle" fill={`${MUTED}88`} fontSize={11} fontFamily="monospace">
            machine learning proposes · certified numerics disposes
          </text>
        )}
      </svg>

      {/* Legend / footer */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 font-mono text-[10px]"
        style={{ borderColor: BORDER, color: MUTED }}
      >
        <LegendChip color={CYAN_GLOW} text="verified ✓ (accepted, cyan)" />
        <LegendChip color={ROSE} text="rejected · fail-closed" />
        <LegendChip color={VIOLET} text="proposer — never trusted alone" />
        <span style={{ color: `${SLATE}` }}>
          the cheap verifier screens most candidates; only survivors pay for expensive certification
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legend chip                                                        */
/* ------------------------------------------------------------------ */

function LegendChip({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
      <span style={{ color }}>{text}</span>
    </span>
  );
}
