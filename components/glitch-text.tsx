"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlitchTextProps {
  children: React.ReactNode;
  className?: string;
  trigger?: "hover" | "always" | "random";
  intensity?: "low" | "medium" | "high";
}

export default function GlitchText({
  children,
  className,
  trigger = "hover",
  intensity = "medium",
}: GlitchTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [isRandomGlitching, setIsRandomGlitching] = useState(false);
  const randomOffTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    if (trigger !== "random") return undefined;

    const intervalId = window.setInterval(() => {
      if (Math.random() > 0.85) {
        setIsRandomGlitching(true);
        if (randomOffTimeoutRef.current !== null) window.clearTimeout(randomOffTimeoutRef.current);
        randomOffTimeoutRef.current = window.setTimeout(() => {
          setIsRandomGlitching(false);
          randomOffTimeoutRef.current = null;
        }, 140 + Math.random() * 160);
      }
    }, 3200);

    return () => {
      window.clearInterval(intervalId);
      if (randomOffTimeoutRef.current !== null) {
        window.clearTimeout(randomOffTimeoutRef.current);
        randomOffTimeoutRef.current = null;
      }
    };
  }, [trigger, prefersReducedMotion]);

  const isGlitching =
    !prefersReducedMotion &&
    (trigger === "always" || (trigger === "hover" ? isHovered : isRandomGlitching));

  // A gentle chromatic "electrical hum" — a soft cyan/violet split with an
  // almost-imperceptible sub-pixel drift. No violent shaking.
  const glitchVariants = useMemo(() => {
    const off = intensity === "low" ? 0.8 : intensity === "medium" ? 1.4 : 2.2;
    return {
      initial: { x: 0, textShadow: "0 0 0 rgba(0,0,0,0)" },
      glitch: {
        x: [0, -off * 0.5, off * 0.5, 0],
        textShadow: [
          "0 0 0 rgba(0,0,0,0)",
          `${off}px 0 rgba(168,85,247,0.5), -${off}px 0 rgba(34,211,238,0.5)`,
          `-${off * 0.7}px 0 rgba(168,85,247,0.4), ${off * 0.7}px 0 rgba(34,211,238,0.4)`,
          "0 0 0 rgba(0,0,0,0)",
        ],
        transition: { duration: 1.6, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const },
      },
    };
  }, [intensity]);

  const splitOffset = intensity === "high" ? 3 : 2;

  return (
    <div
      className={cn("relative inline-block will-change-transform", className)}
      onMouseEnter={() => trigger === "hover" && setIsHovered(true)}
      onMouseLeave={() => trigger === "hover" && setIsHovered(false)}
      onTouchStart={() => trigger === "hover" && setIsHovered(true)}
      onTouchEnd={() => trigger === "hover" && setIsHovered(false)}
      style={{ transform: "translateZ(0)" }}
    >
      <motion.div
        variants={glitchVariants}
        animate={isGlitching ? "glitch" : "initial"}
        className="relative z-10"
        style={{ backfaceVisibility: "hidden" }}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {isGlitching && (
          <>
            <motion.div
              initial={{ opacity: 0, x: -splitOffset }}
              animate={{ opacity: 0.4, x: splitOffset }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              className="absolute inset-0 z-0 pointer-events-none text-violet-500/25 overflow-hidden"
              style={{ clipPath: "inset(0 0 60% 0)", transform: "translateZ(0)" }}
            >
              {children}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: splitOffset }}
              animate={{ opacity: 0.4, x: -splitOffset }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.1 }}
              className="absolute inset-0 z-0 pointer-events-none text-cyan-400/25 overflow-hidden"
              style={{ clipPath: "inset(60% 0 0 0)", transform: "translateZ(0)" }}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
