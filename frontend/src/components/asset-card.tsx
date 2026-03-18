"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AssetKey } from "@/lib/constants";
import { ASSET_INFO } from "@/lib/constants";

interface AssetCardProps {
  assetKey: AssetKey;
}

export default function AssetCard({ assetKey }: AssetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const asset = ASSET_INFO[assetKey];

  return (
    <motion.div
      layout
      className="cursor-pointer rounded-xl border border-surface-lighter bg-surface-light/60 p-4
                 transition-colors hover:border-opacity-60"
      style={{ borderColor: expanded ? asset.color : undefined }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{asset.icon}</span>
        <div className="flex-1">
          <h3 className="font-bold">{asset.name}</h3>
          <p className="text-xs text-slate-400">{asset.typical_return}</p>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  i < asset.risk_level ? asset.color : "#334155",
              }}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {asset.description}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span>Risk Level:</span>
              <span
                className="font-semibold"
                style={{ color: asset.color }}
              >
                {asset.risk_level}/5
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
