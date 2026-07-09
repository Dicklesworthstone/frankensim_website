"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";

/* ───────────────────────────────────────────────────────────────────────────
 * Global visibility gate — pause animation ONLY when the tab is backgrounded.
 *
 * A hidden tab should burn zero CPU/GPU, and that pause is invisible to the
 * user. We deliberately do NOT pause on scroll: freezing visible panels mid-
 * gesture reads as "broken", and the cure is worse than the jank it prevents.
 * Folded into `useInView` so every demo (which already gates on it) inherits
 * the hidden-pause for free. Lazily initialised; a no-op on the server.
 * ────────────────────────────────────────────────────────────────────────── */
let gHidden = false;
let gateInited = false;
const gateSubs = new Set<() => void>();

function notifyGate() {
  for (const f of gateSubs) f();
}

function ensureGate() {
  if (gateInited || typeof window === "undefined" || typeof document === "undefined") return;
  gateInited = true;
  gHidden = document.hidden;
  document.addEventListener("visibilitychange", () => {
    const h = document.hidden;
    if (h !== gHidden) {
      gHidden = h;
      notifyGate();
    }
  });
}

/** Subscribe to visibility transitions (tab show/hide). */
export function subscribeGate(cb: () => void): () => void {
  ensureGate();
  gateSubs.add(cb);
  return () => {
    gateSubs.delete(cb);
  };
}

/**
 * Visibility gate for a live-WASM demo panel.
 *
 * Attach `ref` to the element whose visibility should drive animation. `inView`
 * re-renders only on enter/leave transitions (never per frame); `inViewRef`
 * mirrors it so rAF loops can read the latest value without becoming an effect
 * dependency. Animation loops gate on this and stop painting while the panel is
 * scrolled well out of view — the core anti-flicker mechanism: many canvas/WebGL
 * loops must not all run at once, only the handful actually on (or near) screen.
 *
 * The reported value is `on-screen AND not(tab hidden)`. Panels keep animating
 * while you scroll (freezing them mid-gesture reads as broken); they only pause
 * when scrolled away or when the tab is backgrounded.
 *
 * Defaults to visible so the first client paint animates immediately; the first
 * observer callback corrects it. A generous `rootMargin` keeps a panel "live"
 * slightly before it is fully on screen so entering never shows a frozen frame.
 */
export function useInView<T extends Element = HTMLDivElement>(
  rootMargin = "200px 0px",
): { ref: RefObject<T | null>; inView: boolean; inViewRef: MutableRefObject<boolean> } {
  const ref = useRef<T | null>(null);
  const ioVisibleRef = useRef(true); // raw IntersectionObserver visibility
  const inViewRef = useRef(true); // effective = ioVisible && !hidden
  const [inView, setInView] = useState(true);

  useEffect(() => {
    ensureGate();
    const recompute = () => {
      const eff = ioVisibleRef.current && !gHidden;
      inViewRef.current = eff;
      setInView((prev) => (prev === eff ? prev : eff));
    };

    const el = ref.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          ioVisibleRef.current = entries[entries.length - 1]?.isIntersecting ?? true;
          recompute();
        },
        { rootMargin },
      );
      io.observe(el);
    }

    const unsub = subscribeGate(recompute);
    recompute(); // fold in the current hidden state immediately
    return () => {
      io?.disconnect();
      unsub();
    };
  }, [rootMargin]);

  return { ref, inView, inViewRef };
}

/**
 * Ease a displayed number toward `target`, writing the formatted value straight
 * to a DOM node's `textContent` every frame — with NO React setState, so the
 * animation never forces a component re-render (the previous eased-counter hooks
 * re-rendered a whole SVG 45–90× per settle). Returns a ref to attach to the
 * element (span / svg <text> / <tspan>) that shows the number.
 *
 * Freezes under reduced-motion (snaps to target) and, when `inViewRef` is
 * supplied, snaps instead of animating while the panel is off-screen. Pass
 * `enabled: false` while the underlying data is absent so the element keeps its
 * JSX fallback (e.g. an em dash) untouched.
 */
export function useEasedText<T extends Element = HTMLSpanElement>(
  target: number,
  reduced: boolean,
  format: (v: number) => string,
  opts: {
    duration?: number;
    enabled?: boolean;
    inViewRef?: MutableRefObject<boolean>;
  } = {},
): RefObject<T | null> {
  const { duration = 750, enabled = true, inViewRef } = opts;
  const ref = useRef<T | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    if (!enabled) return;
    const write = (v: number) => {
      const el = ref.current;
      if (el) el.textContent = formatRef.current(v);
    };
    // Snap (no animation) under reduced-motion, non-finite targets, or off-screen.
    if (reduced || !isFinite(target) || (inViewRef && !inViewRef.current)) {
      if (isFinite(target)) fromRef.current = target;
      write(fromRef.current);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    write(from);
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const cur = from + (target - from) * e;
      fromRef.current = cur;
      write(cur);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // inViewRef is a stable ref object; excluded intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced, duration, enabled]);

  return ref;
}

/**
 * Toggles an `is-scrolling` class on <html> while the page is actively scrolling
 * (removed on a debounce ~`idleMs` after the last scroll event). Paired with the
 * globals.css rule that drops `backdrop-filter` while that class is present, this
 * removes the per-frame re-rasterization of every glass surface during scroll —
 * with zero at-rest change, since the blur is restored the moment scrolling
 * stops. The listener is `{ passive: true }`, reads no layout, and only mutates a
 * class (idempotently), so it costs at most two style recalcs per scroll gesture.
 *
 * Mount once near the root of a heavy page (e.g. the Lab); it is a no-op on the
 * server and harmless if mounted more than once.
 */
export function useScrollIdleClass(idleMs = 140): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    let scrolling = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      scrolling = false;
      timer = null;
      root.classList.remove("is-scrolling");
    };
    const onScroll = () => {
      if (!scrolling) {
        scrolling = true;
        root.classList.add("is-scrolling");
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(clear, idleMs);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
      root.classList.remove("is-scrolling");
    };
  }, [idleMs]);
}
