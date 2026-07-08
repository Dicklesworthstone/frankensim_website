"use client";

import { useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";

interface SpecSearchProps {
  value: string;
  onChange: (value: string) => void;
}

// Fully controlled search input. The previous implementation held a
// separate form-store mirror of `value` via @tanstack/react-form and
// then ran two `useEffect`s that resynchronized prop ↔ form on every
// render with mutually-inverse conditions. The result was a feedback
// loop: a keystroke landed in the form store, effect-1 pushed it up
// to the parent, effect-2 (same render cycle, reading the parent's
// pre-update snapshot) reset the form back to the old prop, the next
// render saw the parent's new value mismatched with the reset form,
// and the cycle repeated until React tripped "Maximum update depth
// exceeded" (the minified error #185 surfaced as the spec-explorer
// Runtime_Fault on every keystroke — see asupersync#38).
//
// The fix is to drop the local form mirror entirely. The input is
// controlled directly by the parent's `value` prop and notifies via
// `onChange` on every keystroke. No internal state, no sync hops, no
// feedback loop.
export default function SpecSearch({ value, onChange }: SpecSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !isInputFocused()) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        handleClear();
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClear]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search docs…"
        aria-label="Search spec documents"
        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 focus:bg-white/[0.07] transition-all font-medium"
      />
      {value && (
        <button
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-all"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {!value && (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded pointer-events-none">
          /
        </kbd>
      )}
    </div>
  );
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
}
