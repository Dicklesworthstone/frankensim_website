"use client";

import { comparisonData } from "@/lib/content";
import { cn } from "@/lib/utils";
import { SyncContainer } from "./sync-elements";
import GlitchText from "./glitch-text";
import { motion } from "framer-motion";

const COLUMNS: { key: keyof (typeof comparisonData)[number]; label: string; highlight?: boolean }[] = [
  { key: "frankensim", label: "FrankenSim", highlight: true },
  { key: "comsol", label: "COMSOL" },
  { key: "openfoam", label: "OpenFOAM + FEniCS" },
  { key: "scipy", label: "SciPy + Dakota" },
];

const INCUMBENTS = COLUMNS.filter((c) => !c.highlight);

const NEGATIVE = new Set([
  "No", "None", "Manual", "Required", "n/a", "External", "Add-on",
  "Kill process", "Best-effort", "Fixed-sample", "Ad hoc", "Per-solver",
  "MPI-dependent", "BLAS-dependent",
]);

function IncumbentCell({ value }: { value: string }) {
  const negative = NEGATIVE.has(value);
  return (
    <td className={cn("whitespace-nowrap px-4 py-3 text-sm font-medium", negative ? "text-slate-600" : "text-slate-400")}>
      {negative && <span className="mr-1.5 text-slate-700">&#10005;</span>}
      {value}
    </td>
  );
}

export default function ComparisonTable() {
  return (
    <SyncContainer withPulse={true} className="overflow-hidden border-cyan-500/10">
      {/* Mobile: one stacked card per capability (no awkward horizontal scroll) */}
      <div className="grid gap-3 p-3 md:hidden">
        {comparisonData.map((row) => (
          <div
            key={row.feature}
            className="card rounded-2xl p-4"
          >
            <div className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              {row.feature}
            </div>
            <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] px-3 py-2.5">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">FrankenSim</span>
              <span className="flex items-center gap-1.5 text-right text-sm font-bold text-cyan-300">
                <span className="text-cyan-400 drop-shadow-[0_0_8px_#06b6d4]">&#10003;</span>
                {row.frankensim}
              </span>
            </div>
            <dl className="divide-y divide-white/5">
              {INCUMBENTS.map((col) => {
                const value = row[col.key] as string;
                const negative = NEGATIVE.has(value);
                return (
                  <div key={col.key} className="flex items-center justify-between gap-3 px-1 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">{col.label}</dt>
                    <dd className={cn("text-right text-sm font-medium", negative ? "text-slate-600" : "text-slate-400")}>
                      {negative && <span className="mr-1 text-slate-700">&#10005;</span>}
                      {value}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      {/* Desktop: the full comparison matrix */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left" aria-label="FrankenSim vs incumbent simulation stacks">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Capability</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-4 text-xs font-bold uppercase tracking-widest",
                    col.highlight ? "text-cyan-400" : "text-slate-500",
                  )}
                >
                  {col.highlight ? (
                    <GlitchText trigger="hover" intensity="low">{col.label}</GlitchText>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {comparisonData.map((row) => (
              <motion.tr
                key={row.feature}
                whileHover={{ backgroundColor: "rgba(34, 211, 238, 0.05)" }}
                className="transition-colors group"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  <GlitchText trigger="hover" intensity="low" className="w-full">
                    {row.feature}
                  </GlitchText>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-cyan-300">
                  <span className="mr-1.5 text-cyan-400 drop-shadow-[0_0_8px_#06b6d4]">&#10003;</span>
                  {row.frankensim}
                </td>
                <IncumbentCell value={row.comsol} />
                <IncumbentCell value={row.openfoam} />
                <IncumbentCell value={row.scipy} />
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </SyncContainer>
  );
}
