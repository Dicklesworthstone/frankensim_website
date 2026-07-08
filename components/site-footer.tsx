"use client";

import { Github, Twitter, ArrowUp, Activity } from "lucide-react";
import Link from "next/link";
import { siteConfig, navItems } from "@/lib/content";
import { SyncContainer } from "./sync-elements";
import { Magnetic } from "./motion-wrapper";
import GlitchText from "./glitch-text";
import { motion, useReducedMotion } from "framer-motion";

const socialLinks = [
  { href: siteConfig.social.github, icon: Github, label: "GitHub" },
  { href: siteConfig.social.x, icon: Twitter, label: "X" },
];

export default function SiteFooter() {
  const prefersReducedMotion = useReducedMotion();

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  return (
    <footer
      className="relative mt-40 pb-20 overflow-hidden"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="absolute inset-0 z-0">
         <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <SyncContainer withNodes={false} withPulse={true} accentColor="#06b6d4" className="glass-modern p-12 md:p-16 border-cyan-500/10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">

            {/* BRAND & STATUS */}
            <div className="md:col-span-5 space-y-8">
              <div className="space-y-4">
                <Link href="/" className="flex items-center gap-3 group w-fit">
                  <GlitchText trigger="hover" intensity="low">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500 flex items-center justify-center font-black text-white text-xs transition-transform group-hover:scale-110">F</div>
                  </GlitchText>
                  <span className="text-xl font-black text-white uppercase tracking-tighter group-hover:text-cyan-400 transition-colors">{siteConfig.name}</span>
                </Link>
                <p className="text-slate-400 font-medium leading-relaxed max-w-xs text-left">
                  The certified simulation & design kernel for Rust.
                  Geometry, physics, optimization, and rendering — with proofs inside every value.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/60">
                    <motion.div
                      animate={
                        prefersReducedMotion
                          ? { scale: 1, opacity: 0.6 }
                          : { scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }
                      }
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { duration: 1.5, repeat: Infinity }
                      }
                      className="h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"
                    />
                    <span>All Systems Certified</span>
                 </div>
                 <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
                    <Activity className="h-3 w-3" />
                    <span>Kernel v0.0.1 · 54 Crates</span>
                 </div>
              </div>
            </div>

            {/* NAVIGATION */}
            <div className="md:col-span-4 grid grid-cols-2 gap-8 text-left">
              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Kernel</h4>
                <nav className="flex flex-col gap-4">
                  {navItems.slice(0, 3).map((item) => (
                    <Link key={item.href} href={item.href} className="text-sm font-bold text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest hover:translate-x-1 duration-200">
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Resources</h4>
                <nav className="flex flex-col gap-4">
                  {navItems.slice(3).map((item) => (
                    <Link key={item.href} href={item.href} className="text-sm font-bold text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest hover:translate-x-1 duration-200">
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>

            {/* SOCIAL & ACTION */}
            <div className="md:col-span-3 flex flex-col items-end gap-10">
              <div className="flex items-center gap-4">
                {socialLinks.map((social) => (
                  <Magnetic key={social.label} strength={0.3}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={social.label}
                      data-magnetic="true"
                      className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all shadow-[0_0_20px_rgba(0,0,0,0.2)]"
                    >
                      <social.icon className="h-5 w-5" />
                    </a>
                  </Magnetic>
                ))}
              </div>

              <button
                onClick={handleBackToTop}
                className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 hover:text-cyan-400 transition-colors"
              >
                <span className="group-hover:tracking-[0.4em] transition-all duration-300">Back to top</span>
                <motion.div
                  animate={prefersReducedMotion ? { y: 0 } : { y: [0, -4, 0] }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                  }
                >
                  <ArrowUp className="h-3 w-3" />
                </motion.div>
              </button>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
             <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
               &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span> Jeffrey Emanuel. MIT License.
             </p>
             <div className="flex gap-8">
                <span className="text-[10px] font-black text-white/5 uppercase tracking-[0.5em] select-none">CERTIFIED BY CONSTRUCTION</span>
             </div>
          </div>
        </SyncContainer>
      </div>
    </footer>
  );
}
