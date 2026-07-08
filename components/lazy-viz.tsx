"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Mounts its children only once they scroll near the viewport, and applies
 * `content-visibility: auto` so off-screen instances are skipped by layout/paint.
 *
 * The Lab stacks 20 always-animating live-WASM visualizations; mounting them all
 * at once — or several within a single frame during a fast scroll — is a primary
 * source of scroll jank. This defers each viz's JS chunk + mount until it is about
 * to be seen, then keeps it mounted.
 *
 * Two extra guards on top of plain lazy-mounting:
 *
 *  1. **Staggered mounting.** Demos are observed 400px early, but their actual
 *     mount (and first, heavy paint — dynamic `import("three")`, scene build, WASM
 *     result → geometry) is drained one-per-animation-frame through a shared
 *     module queue. A flick that crosses several demos therefore no longer mounts
 *     and first-paints them all in the same frame (previously ~200-280ms hitches);
 *     one-per-frame still lands well inside the 400px lead.
 *
 *  2. **Accurate reserved size.** `content-visibility: auto` reserves
 *     `contain-intrinsic-size` for skipped elements. Reserving a value far from
 *     the real rendered height (demos run 560-1700px tall) makes the first on-
 *     screen render reflow everything below it. Once a demo has rendered we pin
 *     the reserved size to its measured height, so any later skip/unskip while
 *     scrolling reserves exactly the right space and does not reflow.
 */

// ── Shared one-mount-per-frame stagger queue ────────────────────────────────
const mountQueue: Array<() => void> = [];
let draining = false;

function drainMountQueue() {
  const fn = mountQueue.shift();
  if (fn) fn();
  if (mountQueue.length > 0) {
    requestAnimationFrame(drainMountQueue);
  } else {
    draining = false;
  }
}

function requestMount(fn: () => void) {
  if (typeof requestAnimationFrame === "undefined") {
    fn();
    return;
  }
  mountQueue.push(fn);
  if (!draining) {
    draining = true;
    requestAnimationFrame(drainMountQueue);
  }
}

export default function LazyViz({
  children,
  minHeight = 460,
}: {
  children: React.ReactNode;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  // Real rendered height, captured once after first paint, so subsequent
  // off-screen skips reserve exactly the right space (no reflow when scrolling
  // back through).
  const [reserved, setReserved] = useState(minHeight);
  const measuredRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    let queued = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          if (!queued) {
            queued = true;
            requestMount(() => setShow(true));
          }
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // After the demo mounts, measure its true height once and pin the reserved
  // size to it. Measured a single time so animation-driven jitter can never
  // oscillate the reservation.
  useLayoutEffect(() => {
    if (!show || measuredRef.current) return;
    const el = ref.current;
    if (!el) return;
    const h = Math.round(el.getBoundingClientRect().height);
    if (h > 0) {
      measuredRef.current = true;
      if (Math.abs(h - reserved) > 8) setReserved(h);
    }
  }, [show, reserved]);

  return (
    <div
      ref={ref}
      style={
        {
          contentVisibility: "auto",
          containIntrinsicSize: `auto ${reserved}px`,
          minHeight: show ? undefined : reserved,
        } as React.CSSProperties
      }
    >
      {show ? children : null}
    </div>
  );
}
