"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ASSET_INFO, ASSET_CHECKPOINT_LABELS } from "@/lib/constants";
import type { AssetKey } from "@/lib/constants";

const CHECKPOINTS: AssetKey[] = ["stocks", "bonds", "gold", "cash", "crypto"];

interface LearningPathProps {
  unlockedAssets: string[];
}

export default function LearningPath({ unlockedAssets }: LearningPathProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="relative flex flex-col gap-0">
      {CHECKPOINTS.map((asset, idx) => {
        const unlocked = unlockedAssets.includes(asset);
        const info = ASSET_INFO[asset];
        const label = ASSET_CHECKPOINT_LABELS[asset] ?? info.name;
        const isExpanded = expanded === asset;

        return (
          <div key={asset} className="relative flex items-start gap-4">
            {/* Connector line */}
            {idx < CHECKPOINTS.length - 1 && (
              <div className="absolute left-5 top-10 bottom-0 w-px bg-white/5" style={{ height: "calc(100% - 0px)", top: "40px" }} />
            )}

            {/* Node */}
            <button
              onClick={() => unlocked && setExpanded(isExpanded ? null : asset)}
              disabled={!unlocked}
              className="relative z-10 flex-shrink-0"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-all ${
                  unlocked
                    ? "border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff] node-active cursor-pointer hover:bg-[#00d4ff]/20"
                    : "border-white/10 bg-white/5 text-slate-600 cursor-not-allowed"
                }`}
              >
                {unlocked ? info.icon : "🔒"}
              </div>
            </button>

            {/* Label + panel */}
            <div className="flex-1 pb-6">
              <button
                onClick={() => unlocked && setExpanded(isExpanded ? null : asset)}
                disabled={!unlocked}
                className="text-left"
              >
                <p className={`text-sm font-semibold ${unlocked ? "text-white" : "text-slate-600"}`}>
                  {label}
                </p>
                <p className={`text-xs ${unlocked ? "text-slate-500" : "text-slate-700"}`}>
                  {unlocked ? info.typical_return : "Complete previous to unlock"}
                </p>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-xl border border-[#00d4ff]/10 bg-[#00d4ff]/5 p-4">
                      <p className="text-sm text-slate-300 leading-relaxed">{info.description}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-[#00d4ff] font-mono-data">
                          Risk Level: {info.risk_level}/5
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-400">{info.typical_return}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
