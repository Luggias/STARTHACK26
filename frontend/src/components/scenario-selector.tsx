"use client";

import { motion } from "framer-motion";
import type { ScenarioMeta } from "@/lib/types";

interface ScenarioSelectorProps {
  scenarios: ScenarioMeta[];
  selected: string | null;
  onSelect: (key: string) => void;
}

export default function ScenarioSelector({
  scenarios,
  selected,
  onSelect,
}: ScenarioSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {scenarios.map((s) => (
        <motion.button
          key={s.key}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`rounded-xl border p-4 text-left transition-all ${
            selected === s.key
              ? "border-brand-blue bg-brand-blue/10"
              : "border-surface-lighter bg-surface-light/30 hover:border-surface-lighter/80"
          }`}
          onClick={() => onSelect(s.key)}
        >
          <h3 className="font-bold">{s.name}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{s.period}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 line-clamp-2">
            {s.description}
          </p>
        </motion.button>
      ))}
    </div>
  );
}
