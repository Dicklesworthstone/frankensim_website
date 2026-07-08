"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlitchText from "@/components/glitch-text";
import { glossaryTerms } from "@/lib/content";

type GlossaryRow =
  | { id: string; type: "heading"; letter: string }
  | { id: string; type: "term"; letter: string; term: (typeof glossaryTerms)[number] };

export default function GlossaryPage() {
  const searchForm = useForm({
    defaultValues: {
      query: "",
    },
    onSubmit: async () => {},
  });
  const search = useStore(searchForm.store, (state) => state.values.query);
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return glossaryTerms;
    const q = search.toLowerCase();
    return glossaryTerms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.short.toLowerCase().includes(q) ||
        t.long.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof glossaryTerms> = {};
    for (const term of filtered) {
      const letter = term.term[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(term);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const virtualRows = useMemo<GlossaryRow[]>(() => {
    const rows: GlossaryRow[] = [];
    for (const [letter, terms] of grouped) {
      rows.push({ id: `heading-${letter}`, type: "heading", letter });
      for (const term of terms) {
        rows.push({ id: term.term, type: "term", letter, term });
      }
    }
    return rows;
  }, [grouped]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (!row) return 96;
      if (row.type === "heading") return 44;
      return selected === row.term.term ? 180 : 104;
    },
    overscan: 10,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, selected, virtualRows.length]);

  return (
    <main id="main-content">
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-px w-8 bg-cyan-500/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/80">
              The Lexicon
            </span>
            <div className="h-px w-8 bg-cyan-500/40" />
          </div>
          <GlitchText trigger="hover" intensity="medium">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6">
              The <span className="text-cyan-400">vocabulary</span>.
            </h1>
          </GlitchText>
          <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto">
            The coined terms that make FrankenSim&apos;s typed continuum legible:
            Regions and Charts, the three colors, the Five Explicits, the Gauntlet.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 pb-32">
        {/* Search */}
        <div className="sticky top-24 z-30 mb-12">
          <div className="field group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#08131a]/80 px-4 shadow-[0_4px_24px_-1px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-xl">
            <Search className="h-5 w-5 shrink-0 text-slate-500 transition-colors group-focus-within:text-cyan-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => searchForm.setFieldValue("query", e.target.value)}
              placeholder="Search terms, definitions…"
              aria-label="Search glossary terms"
              className="min-w-0 flex-1 bg-transparent py-4 text-sm font-medium text-white outline-none placeholder:text-slate-500"
            />
            {search ? (
              <button
                onClick={() => searchForm.setFieldValue("query", "")}
                aria-label="Clear search"
                className="shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <span className="hidden shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-600 sm:flex">
                {filtered.length} terms
              </span>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="space-y-12">
          {virtualRows.length > 0 && (
            <div ref={listRef} className="max-h-[72vh] overflow-y-auto pr-2 custom-scrollbar">
              <div
                className="relative w-full"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const row = virtualRows[virtualItem.index]!;

                  return (
                    <div
                      key={row.id}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualItem.index}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualItem.start}px)` }}
                    >
                      {row.type === "heading" ? (
                        <div className="flex items-center gap-4 pb-3 pt-6">
                          <span className="text-gradient-sync text-2xl font-black leading-none tabular-nums">
                            {row.letter}
                          </span>
                          <span className="hairline flex-1" aria-hidden="true" />
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelected(selected === row.term.term ? null : row.term.term)}
                          aria-expanded={selected === row.term.term}
                          className="card card-hover group/term mb-3 w-full rounded-2xl p-5 text-left md:p-6"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <span
                                aria-hidden="true"
                                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] font-mono text-xs font-black text-cyan-400 transition-colors group-hover/term:border-cyan-500/40 group-hover/term:text-cyan-300"
                              >
                                {row.term.term[0].toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <h3 className="text-lg font-black leading-tight text-white transition-colors group-hover/term:text-cyan-300">
                                  {row.term.term}
                                </h3>
                                <p className="mt-1 text-sm leading-relaxed text-slate-400">{row.term.short}</p>
                              </div>
                            </div>
                            <ChevronRight
                              aria-hidden="true"
                              className={`mt-1 h-4 w-4 shrink-0 transition-all duration-300 ${
                                selected === row.term.term
                                  ? "rotate-90 text-cyan-400"
                                  : "text-slate-600 group-hover/term:translate-x-0.5 group-hover/term:text-cyan-400"
                              }`}
                            />
                          </div>

                          <AnimatePresence>
                            {selected === row.term.term && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <p className="mt-4 border-t border-cyan-500/10 pt-4 pl-10 text-sm leading-relaxed text-slate-300">
                                  {row.term.long}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-500 text-lg">No terms match &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>
    </main>
  );
}
