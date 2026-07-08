"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * The atmosphere layer — film grain, flickering scanlines, a slow interference
 * sweep, and organic light leaks. Makes the lab feel alive without distracting.
 */
export default function SpectralBackground() {
  const isMounted = useSyncExternalStore(noop, () => true, () => false);
  const prefersReducedMotion = useReducedMotion();

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 z-[-5] pointer-events-none overflow-hidden select-none">
      {/* Film grain */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <filter id="spectralNoise">
            {/* Static grain — an animated feTurbulence re-rasterizes the whole
                viewport every frame, which is a major source of jank. A static
                filter is rasterized once and cached; the grain looks identical. */}
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#spectralNoise)" />
        </svg>
      </div>

      {/* Vertical scanlines */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 0.05 } : { opacity: [0.05, 0.08, 0.04, 0.07] }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.02)_1px,transparent_1px)] bg-[size:100px_100%]"
      />

      {/* Horizontal interference sweep */}
      <motion.div
        animate={{
          y: prefersReducedMotion ? 0 : ["-10vh", "110vh"],
          opacity: prefersReducedMotion ? 0 : [0, 0.3, 0],
        }}
        transition={{
          duration: prefersReducedMotion ? 0 : 8,
          repeat: prefersReducedMotion ? 0 : Infinity,
          ease: "linear",
          delay: prefersReducedMotion ? 0 : 2,
        }}
        className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent blur-[1px]"
      />

      {/* Organic light leaks — static. Pulsing a 120px-blurred half-viewport
          element forces a continuous full-screen repaint; static reads the same. */}
      <div className="absolute top-0 left-1/4 w-[50%] h-[50%] bg-cyan-500/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 right-1/4 w-[40%] h-[40%] bg-violet-500/5 blur-[100px] rounded-full" />
    </div>
  );
}
