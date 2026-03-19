"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ASSET_INFO, ASSET_CHECKPOINT_LABELS } from "@/lib/constants";
import type { AssetKey } from "@/lib/constants";

const STEPS: AssetKey[] = ["stocks", "bonds", "gold", "cash", "crypto"];

const RISK_LABEL = ["", "Very Low", "Low", "Medium", "High", "Very High"];

export default function LearningPath({ unlockedAssets }: { unlockedAssets: string[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {STEPS.map((asset, i) => {
        const unlocked = unlockedAssets.includes(asset);
        const info     = ASSET_INFO[asset];
        const label    = ASSET_CHECKPOINT_LABELS[asset] ?? info.name;
        const isOpen   = open === asset;

        return (
          <div key={asset}>
            <button
              onClick={() => unlocked && setOpen(isOpen ? null : asset)}
              disabled={!unlocked}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                unlocked
                  ? "hover:bg-white/[0.04] cursor-pointer"
                  : "cursor-not-allowed opacity-40"
              } ${isOpen ? "bg-white/[0.06]" : ""}`}
            >
              {/* Step number / icon */}
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm ${
                  unlocked
                    ? "bg-[#0071e3]/20 text-[#2997ff] node-active"
                    : "bg-white/[0.06] text-white/20"
                }`}
              >
                {unlocked ? info.icon : <LockIcon />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-white/30">{RISK_LABEL[info.risk_level]} risk · {info.typical_return}</p>
              </div>

              {unlocked && (
                <ChevronIcon
                  className={`flex-shrink-0 text-white/30 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mx-3 mb-2 rounded-xl bg-[#0071e3]/[0.07] border border-[#0071e3]/15 p-4">
                    <p className="text-sm leading-relaxed text-white/60">{info.description}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  );
}
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}
