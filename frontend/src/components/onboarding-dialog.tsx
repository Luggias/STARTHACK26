"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ASSETS = [
  {
    name: "Equities",
    subtitle: "Stocks & Shares",
    icon: "📈",
    color: "#3B82F6",
    locked: false,
    tagline: "Own a piece of the world's biggest companies.",
  },
  {
    name: "ETFs",
    subtitle: "Index Funds",
    icon: "🧺",
    color: "#06B6D4",
    locked: true,
    tagline: "Instant diversification in a single trade.",
  },
  {
    name: "Fixed Income",
    subtitle: "Bonds",
    icon: "🏦",
    color: "#10B981",
    locked: true,
    tagline: "Steady returns, portfolio stability.",
  },
  {
    name: "Commodities",
    subtitle: "Gold & Raw Materials",
    icon: "🥇",
    color: "#F59E0B",
    locked: true,
    tagline: "Real assets for real-world protection.",
  },
  {
    name: "Crypto",
    subtitle: "Digital Assets",
    icon: "₿",
    color: "#8B5CF6",
    locked: true,
    tagline: "High risk, high reward digital frontier.",
  },
] as const;

interface Props {
  username: string;
  onComplete: () => void;
}

export default function OnboardingDialog({ username, onComplete }: Props) {
  const [step, setStep] = useState<"greeting" | "assets">("greeting");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <motion.div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A] shadow-2xl"
        initial={{ opacity: 0, scale: 0.93, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
      >
        <AnimatePresence mode="wait">

          {/* ── Step 1: Greeting ───────────────────────────────────────── */}
          {step === "greeting" && (
            <motion.div
              key="greeting"
              className="flex flex-col items-center gap-5 p-10 text-center"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }}
            >
              <span className="text-6xl">👋</span>
              <div>
                <h2 className="text-3xl font-black">
                  Hey,{" "}
                  <span className="bg-gradient-to-r from-brand-blue to-brand-purple bg-clip-text text-transparent">
                    {username}
                  </span>!
                </h2>
                <p className="mt-3 text-slate-400">
                  You&apos;re about to learn investing by doing — no textbooks, no lectures.
                  Build portfolios, run them through real market crises, and battle other players.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Every asset class has a different risk and return profile. Master them one by one.
                </p>
              </div>
              <motion.button
                className="mt-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-purple px-10 py-3.5 font-bold"
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => setStep("assets")}
              >
                Let&apos;s go →
              </motion.button>
              <button onClick={onComplete} className="text-xs text-slate-700 hover:text-slate-500 transition-colors">
                Skip
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Asset gate ─────────────────────────────────────── */}
          {step === "assets" && (
            <motion.div
              key="assets"
              className="flex flex-col gap-0"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }}
            >
              {/* Header */}
              <div className="border-b border-white/5 px-8 py-6">
                <h3 className="text-lg font-black">Your Asset Classes</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Start with Equities. Unlock the rest as you play.
                </p>
              </div>

              {/* Asset list */}
              <div className="divide-y divide-white/5">
                {ASSETS.map((asset, i) => (
                  <motion.div
                    key={asset.name}
                    className="flex items-center gap-4 px-8 py-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    {/* Icon */}
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl"
                      style={
                        asset.locked
                          ? { backgroundColor: "#1E293B" }
                          : { backgroundColor: asset.color + "20", border: `1px solid ${asset.color}30` }
                      }
                    >
                      {asset.locked ? "🔒" : asset.icon}
                    </div>

                    {/* Name + tagline */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-bold leading-tight"
                        style={{ color: asset.locked ? "#334155" : asset.color }}
                      >
                        {asset.name}
                        <span className="ml-2 text-xs font-normal" style={{ color: asset.locked ? "#1E293B" : "#64748B" }}>
                          {asset.subtitle}
                        </span>
                      </p>
                      <p className="text-xs text-slate-600">{asset.tagline}</p>
                    </div>

                    {/* Badge */}
                    {asset.locked ? (
                      <span className="flex-shrink-0 rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-600">
                        Locked
                      </span>
                    ) : (
                      <span
                        className="flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: asset.color + "20", color: asset.color }}
                      >
                        Available
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Footer CTA */}
              <div className="border-t border-white/5 px-8 py-6 flex items-center justify-between">
                <button
                  onClick={() => setStep("greeting")}
                  className="text-sm text-slate-600 hover:text-slate-400 transition-colors"
                >
                  ← Back
                </button>
                <motion.button
                  className="rounded-xl px-8 py-3 font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB)" }}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={onComplete}
                >
                  Start with Equities 🚀
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
