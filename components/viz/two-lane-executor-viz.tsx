"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/components/motion";
import { Play, Pause, StepForward, RotateCcw, Zap, Split } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Palette (FrankenSim)                                               */
/* ------------------------------------------------------------------ */

const BG = "#04090d";
const SURFACE = "#08131a";
const BORDER = "rgba(34,211,238,0.14)";
const CYAN = "#06b6d4";
const CYAN_GLOW = "#22d3ee";
const TEAL = "#14b8a6";
const VIOLET = "#a855f7";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const SLATE = "#64748b";
const MUTED = "#94a3b8";
const BRIGHT = "#e2e8f0";

/* ------------------------------------------------------------------ */
/*  Model                                                              */
/* ------------------------------------------------------------------ */

type TileState = "queued" | "inflight" | "cancelled" | "racing" | "won";
type Mode = "idle" | "running" | "cancelling" | "racing";

interface Tile {
  id: number;
  state: TileState;
  worker: number | null;
  prog: number;
}

const WORKER_COUNT = 4;
const QUEUE_TARGET = 6;
const DONE_TICKS = 3;
const RACE_DONE = 6;
const RACE_TICKS = 3;

/* SVG geometry */
const LANE_X = 40;
const LANE_W = 720;
const CELL_W = LANE_W / WORKER_COUNT; // 180
const SLOT_W = 140;
const SLOT_Y = 186;
const SLOT_H = 66;
const TS = 38; // tile size
const QUEUE_Y = 300;
const QUEUE_STEP = 44;

function slotX(i: number) {
  return LANE_X + i * CELL_W + (CELL_W - SLOT_W) / 2;
}
function tileSlotX(i: number) {
  return slotX(i) + (SLOT_W - TS) / 2;
}

/* ------------------------------------------------------------------ */
/*  Seed                                                               */
/* ------------------------------------------------------------------ */

function seedTiles(): { tiles: Tile[]; nextId: number } {
  const tiles: Tile[] = [];
  let id = 0;
  for (let w = 0; w < WORKER_COUNT; w++) {
    tiles.push({ id: id++, state: "inflight", worker: w, prog: w % 2 });
  }
  for (let q = 0; q < QUEUE_TARGET; q++) {
    tiles.push({ id: id++, state: "queued", worker: null, prog: 0 });
  }
  return { tiles, nextId: id };
}

/* ------------------------------------------------------------------ */
/*  Colors + geometry helpers                                          */
/* ------------------------------------------------------------------ */

function colorsFor(state: TileState) {
  switch (state) {
    case "queued":
      return { fill: `${SLATE}22`, stroke: `${SLATE}99`, bar: SLATE };
    case "inflight":
      return { fill: `${VIOLET}26`, stroke: VIOLET, bar: TEAL };
    case "racing":
      return { fill: `${CYAN}1f`, stroke: CYAN_GLOW, bar: CYAN_GLOW };
    case "won":
      return { fill: `${EMERALD}2e`, stroke: EMERALD, bar: EMERALD };
    case "cancelled":
      return { fill: `${ROSE}26`, stroke: ROSE, bar: ROSE };
  }
}

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

function CtrlButton({
  onClick,
  disabled,
  color,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5",
        "font-mono text-xs font-semibold tracking-wide transition-colors",
        "hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35",
      )}
      style={{ borderColor: `${color}55`, color }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function TwoLaneExecutorViz() {
  const reduced = !!useReducedMotion();

  const [tiles, setTiles] = useState<Tile[]>(() => seedTiles().tiles);
  const [mode, setMode] = useState<Mode>("idle");
  const [playing, setPlaying] = useState(false);
  const [budget, setBudget] = useState(false);
  const [status, setStatus] = useState(
    "L0 executor idle · latency lane ≤100ms · throughput lane: work-stealing fork-join",
  );

  const tilesRef = useRef<Tile[]>(tiles);
  const nextIdRef = useRef(WORKER_COUNT + QUEUE_TARGET);
  const completedRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  /* ---- generic scheduler tick (Play / Step) ---- */
  const stepOnce = useCallback(() => {
    const prev = tilesRef.current.map((t) => ({ ...t }));
    let delta = 0;
    const kept: Tile[] = [];

    for (const t of prev) {
      if (t.state === "inflight") {
        t.prog += 1;
        if (t.prog >= DONE_TICKS) {
          delta++;
          continue; // completed -> removed (AnimatePresence exit)
        }
        kept.push(t);
      } else if (t.state === "cancelled" || t.state === "won") {
        continue; // terminal visual states clear on next step
      } else {
        kept.push(t);
      }
    }

    const busy = new Set<number>();
    for (const t of kept) {
      if (t.state === "inflight" && t.worker !== null) busy.add(t.worker);
    }

    // work-stealing: idle worker slots pull the oldest queued tile (FIFO by id)
    const queued = kept.filter((t) => t.state === "queued").sort((a, b) => a.id - b.id);
    let qi = 0;
    for (let w = 0; w < WORKER_COUNT; w++) {
      if (busy.has(w)) continue;
      if (qi < queued.length) {
        const tile = queued[qi++];
        tile.state = "inflight";
        tile.worker = w;
        tile.prog = 0;
        busy.add(w);
      }
    }

    // refill the steal queue
    let qCount = kept.filter((t) => t.state === "queued").length;
    while (qCount < QUEUE_TARGET) {
      kept.push({ id: nextIdRef.current++, state: "queued", worker: null, prog: 0 });
      qCount++;
    }

    tilesRef.current = kept;
    setTiles(kept);
    setMode("running");
    setBudget(false);
    const total = completedRef.current + delta;
    completedRef.current = total;
    setStatus(
      `running · workers: ${WORKER_COUNT} · completed: ${total} · ≈ ${(WORKER_COUNT * 1.05).toFixed(1)}M tiles/s`,
    );
  }, []);

  const play = useCallback(() => {
    if (intervalRef.current) return;
    setPlaying(true);
    setMode("running");
    stepOnce();
    intervalRef.current = setInterval(stepOnce, reduced ? 260 : 780);
  }, [reduced, stepOnce]);

  const togglePlay = useCallback(() => {
    if (playing) stopPlay();
    else play();
  }, [playing, play, stopPlay]);

  const step = useCallback(() => {
    stopPlay();
    stepOnce();
  }, [stopPlay, stepOnce]);

  /* ---- Fire cancel: bounded latency-to-cancel ---- */
  const fireCancel = useCallback(() => {
    stopPlay();
    clearTimers();
    const prev = tilesRef.current;
    const halted = prev.filter((t) => t.state === "inflight" || t.state === "racing").length;
    const next = prev.map((t) =>
      t.state === "inflight" || t.state === "racing" ? { ...t, state: "cancelled" as const } : t,
    );
    tilesRef.current = next;
    setTiles(next);
    setMode("cancelling");
    setBudget(true);
    setStatus(
      `cancel token fired · latency-to-cancel: 180µs ≤ 200µs ✓ · ${halted} in-flight tiles halted`,
    );
    // tear down cancelled tiles once the visual budget elapses
    schedule(() => {
      const cur = tilesRef.current.filter((t) => t.state !== "cancelled");
      tilesRef.current = cur;
      setTiles(cur);
      setBudget(false);
    }, 780);
  }, [stopPlay, clearTimers, schedule]);

  /* ---- Speculative race: 3 candidates, cancel the losers ---- */
  const speculativeRace = useCallback(() => {
    stopPlay();
    clearTimers();
    setMode("racing");
    setBudget(false);
    const cands: Tile[] = [0, 1, 2].map((w) => ({
      id: nextIdRef.current++,
      state: "racing" as const,
      worker: w,
      prog: 0,
    }));
    tilesRef.current = cands;
    setTiles(cands);
    setStatus("speculative race · 3 candidates running · losers get cancelled");

    for (let s = 1; s <= RACE_TICKS; s++) {
      schedule(() => {
        setTiles((cur) => {
          const upd = cur.map((t) =>
            t.state === "racing"
              ? {
                  ...t,
                  prog:
                    t.worker === 1
                      ? Math.min(RACE_DONE, t.prog + 2)
                      : Math.min(RACE_DONE - 2, t.prog + 1),
                }
              : t,
          );
          tilesRef.current = upd;
          return upd;
        });
      }, s * 280);
    }

    schedule(
      () => {
        setTiles((cur) => {
          const upd = cur.map((t) =>
            t.state === "racing"
              ? t.worker === 1
                ? { ...t, state: "won" as const, prog: RACE_DONE }
                : { ...t, state: "cancelled" as const }
              : t,
          );
          tilesRef.current = upd;
          return upd;
        });
        setStatus("speculative race: candidate W1 won · 2 losers cancelled ✓");
        completedRef.current += 1;
      },
      (RACE_TICKS + 1) * 280,
    );
  }, [stopPlay, clearTimers, schedule]);

  /* ---- Reset ---- */
  const reset = useCallback(() => {
    stopPlay();
    clearTimers();
    const s = seedTiles();
    tilesRef.current = s.tiles;
    nextIdRef.current = s.nextId;
    completedRef.current = 0;
    setTiles(s.tiles);
    setMode("idle");
    setBudget(false);
    setStatus(
      "L0 executor idle · latency lane ≤100ms · throughput lane: work-stealing fork-join",
    );
  }, [stopPlay, clearTimers]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  /* ---- derived positions ---- */
  const queueOrder = new Map<number, number>();
  tiles
    .filter((t) => t.state === "queued")
    .sort((a, b) => a.id - b.id)
    .forEach((t, i) => queueOrder.set(t.id, i));

  function posOf(t: Tile) {
    if (t.state === "queued") {
      return { x: LANE_X + 20 + (queueOrder.get(t.id) ?? 0) * QUEUE_STEP, y: QUEUE_Y };
    }
    const w = t.worker ?? 0;
    return { x: tileSlotX(w), y: SLOT_Y + 10 };
  }

  /* latency-lane pills (decorative). Each sits centered in its own evenly-sized
     slot along the lane and gently bobs by a bounded amount, so they are always
     cleanly spaced — no start-of-animation stacking, no overflow. */
  const pills = [
    { label: "resp", w: 66 },
    { label: "ledger", w: 78 },
    { label: "progress", w: 92 },
    { label: "poll", w: 56 },
  ];
  const PILL_SLOT = LANE_W / pills.length; // 180
  const PILL_DRIFT = 12; // bob amplitude « inter-pill gap, so never overlaps
  const pillBaseX = (i: number, w: number) =>
    LANE_X + i * PILL_SLOT + (PILL_SLOT - w) / 2; // centered in its slot

  const statusColor =
    mode === "cancelling" ? ROSE : mode === "racing" ? CYAN_GLOW : mode === "running" ? EMERALD : SLATE;

  return (
    <section
      className="w-full rounded-2xl border p-4 sm:p-5"
      style={{ background: BG, borderColor: BORDER }}
      aria-label="Two-lane executor visualization"
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-bold tracking-tight" style={{ color: BRIGHT }}>
            L0 · The Two-Lane Executor
          </h3>
          <p className="mt-0.5 font-mono text-[11px]" style={{ color: MUTED }}>
            latency lane + work-stealing throughput lane · latency-to-cancel ≤ 200µs
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-full border px-3 py-1"
          style={{ borderColor: BORDER }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
          />
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
            {mode}
          </span>
        </div>
      </div>

      {/* SVG */}
      <svg
        viewBox="0 0 800 400"
        className="w-full"
        role="img"
        aria-label="Two cooperating lanes: a latency lane of orchestration tasks above a throughput lane of tiles pulled by four work-stealing worker slots"
      >
        <defs>
          <filter id="tle-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ---- Latency lane ---- */}
        <rect
          x={LANE_X}
          y={40}
          width={LANE_W}
          height={70}
          rx={12}
          fill={`${CYAN}0c`}
          stroke={`${CYAN}44`}
        />
        <text x={LANE_X + 12} y={34} fontFamily="monospace" fontSize={11} fill={CYAN_GLOW}>
          latency lane · async orchestration · ledger I/O · responses ≤100ms
        </text>
        {pills.map((p, i) => {
          const baseX = pillBaseX(i, p.w);
          return (
            <motion.g
              key={p.label}
              initial={false}
              animate={
                reduced
                  ? { x: baseX }
                  : { x: [baseX - PILL_DRIFT, baseX + PILL_DRIFT, baseX - PILL_DRIFT] }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 5.2, ease: "easeInOut", repeat: Infinity, delay: i * 0.5 }
              }
            >
              <rect y={62} width={p.w} height={26} rx={13} fill={`${CYAN}22`} stroke={CYAN} strokeWidth={1} />
              <text x={p.w / 2} y={79} textAnchor="middle" fontFamily="monospace" fontSize={11} fill={CYAN_GLOW}>
                {p.label}
              </text>
            </motion.g>
          );
        })}

        {/* ---- Throughput lane ---- */}
        <rect
          x={LANE_X}
          y={130}
          width={LANE_W}
          height={228}
          rx={12}
          fill={`${VIOLET}08`}
          stroke={`${VIOLET}3a`}
        />
        <text x={LANE_X + 12} y={150} fontFamily="monospace" fontSize={11} fill={VIOLET}>
          throughput lane · fork-join work-stealing pool · unit of work = TILE
        </text>

        {/* worker slots */}
        {Array.from({ length: WORKER_COUNT }).map((_, i) => (
          <g key={i}>
            <rect
              x={slotX(i)}
              y={SLOT_Y}
              width={SLOT_W}
              height={SLOT_H}
              rx={9}
              fill="none"
              stroke={`${TEAL}55`}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={slotX(i) + SLOT_W / 2}
              y={SLOT_Y - 6}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={10}
              fill={`${TEAL}cc`}
            >
              worker W{i}
            </text>
          </g>
        ))}

        {/* steal-queue label */}
        <text x={LANE_X + 20} y={QUEUE_Y - 10} fontFamily="monospace" fontSize={10} fill={`${SLATE}dd`}>
          steal queue →
        </text>

        {/* tiles */}
        <AnimatePresence>
          {tiles.map((t) => {
            const p = posOf(t);
            const c = colorsFor(t.state);
            const max = t.state === "racing" || t.state === "won" ? RACE_DONE : DONE_TICKS;
            const showBar = t.state === "inflight" || t.state === "racing" || t.state === "won";
            return (
              <motion.g
                key={t.id}
                initial={{ opacity: 0, scale: 0.6, x: p.x, y: p.y }}
                animate={{
                  opacity: t.state === "cancelled" ? 0.4 : 1,
                  scale: 1,
                  x: p.x,
                  y: p.y,
                }}
                exit={{ opacity: 0, scale: 1.35, transition: { duration: reduced ? 0 : 0.4 } }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
                style={{ pointerEvents: "none" }}
              >
                <rect
                  width={TS}
                  height={TS}
                  rx={7}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={1.5}
                  filter={t.state === "won" ? "url(#tle-glow)" : undefined}
                />
                {/* inner tile motif */}
                <rect x={TS / 2 - 6} y={TS / 2 - 6} width={12} height={12} rx={2} fill={c.stroke} opacity={0.5} />
                {showBar && (
                  <>
                    <rect x={2} y={TS + 3} width={TS - 4} height={4} rx={2} fill={`${c.bar}22`} />
                    <rect
                      x={2}
                      y={TS + 3}
                      width={(TS - 4) * (t.prog / max)}
                      height={4}
                      rx={2}
                      fill={c.bar}
                    />
                  </>
                )}
                {t.state === "won" && (
                  <text x={TS / 2} y={-6} textAnchor="middle" fontFamily="monospace" fontSize={10} fill={EMERALD}>
                    won ✓
                  </text>
                )}
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* cancel token marker */}
        <AnimatePresence>
          {budget && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
            >
              <rect x={LANE_X} y={366} width={LANE_W} height={7} rx={3.5} fill={`${SURFACE}`} stroke={`${ROSE}33`} />
              <motion.rect
                x={LANE_X}
                y={366}
                height={7}
                rx={3.5}
                fill={ROSE}
                initial={{ width: 0 }}
                animate={{ width: LANE_W * 0.9 }}
                transition={{ duration: reduced ? 0 : 0.7, ease: "easeOut" }}
              />
              <text
                x={LANE_X + LANE_W}
                y={362}
                textAnchor="end"
                fontFamily="monospace"
                fontSize={10}
                fill={ROSE}
              >
                cancel budget · 180µs / 200µs
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CtrlButton onClick={togglePlay} color={EMERALD} label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? "Pause" : "Play"}
        </CtrlButton>
        <CtrlButton onClick={step} color={TEAL} label="Step one scheduler tick">
          <StepForward size={13} />
          Step
        </CtrlButton>
        <CtrlButton onClick={fireCancel} color={ROSE} label="Fire cancel token">
          <Zap size={13} />
          Fire cancel
        </CtrlButton>
        <CtrlButton onClick={speculativeRace} color={CYAN_GLOW} label="Start speculative race">
          <Split size={13} />
          Speculative race
        </CtrlButton>
        <CtrlButton onClick={reset} color={SLATE} label="Reset">
          <RotateCcw size={13} />
          Reset
        </CtrlButton>
      </div>

      {/* Status readout */}
      <div
        className="mt-3 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{ borderColor: BORDER, background: SURFACE, color: BRIGHT }}
      >
        <span style={{ color: statusColor }}>›</span> {status}
      </div>
    </section>
  );
}
