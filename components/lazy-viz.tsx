"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mounts its children only once they scroll near the viewport, and applies
 * `content-visibility: auto` so off-screen instances are skipped by layout/paint.
 *
 * The homepage stacks ~12 always-animating framer-motion visualizations; mounting
 * them all at once on load is the main source of scroll jank. This defers each
 * viz's JS chunk + mount until it's about to be seen, then keeps it mounted.
 */
export default function LazyViz({
  children,
  minHeight = 460,
}: {
  children: React.ReactNode;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={
        {
          contentVisibility: "auto",
          containIntrinsicSize: `auto ${minHeight}px`,
          minHeight: show ? undefined : minHeight,
        } as React.CSSProperties
      }
    >
      {show ? children : null}
    </div>
  );
}
