"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { getMyStrategies, getAiCoach } from "@/lib/api";
import type { Strategy } from "@/lib/types";
import StrategyCard from "@/components/strategy-card";
import AiInsight from "@/components/ai-insight";

const RISK_COLORS: Record<string, string> = {
  conservative: "text-green-400 bg-green-400/10 border-green-400/20",
  moderate: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  aggressive: "text-red-400 bg-red-400/10 border-red-400/20",
  unknown: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

export default function ReviewPage() {
  const token = useGameStore((s) => s.token);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  const [coachResult, setCoachResult] = useState<{
    personality_type: string;
    strengths: string[];
    blindspots: string[];
    risk_profile: string;
    narrative: string;
  } | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    getMyStrategies()
      .then((s) => setStrategies(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleGetCoach() {
    setCoachLoading(true);
    try {
      const result = await getAiCoach(strategies);
      setCoachResult(result);
    } catch {
      setCoachResult({
        personality_type: "Balanced Builder",
        strengths: ["Diversified thinking", "Risk awareness"],
        blindspots: ["Could explore more asset classes"],
        risk_profile: "moderate",
        narrative: "You tend to build balanced portfolios. Keep experimenting to refine your style.",
      });
    } finally {
      setCoachLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Review</h1>
        <p className="text-sm text-slate-500 mt-1">Your strategy history and investing personality</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 max-w-4xl">
        {/* Strategy timeline */}
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-600 mb-4">Strategy Timeline</p>
          {loading ? (
            <p className="text-sm text-slate-600">Loading...</p>
          ) : strategies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#0f0f1a] p-6 text-center">
              <p className="text-slate-500 text-sm">No strategies saved yet.</p>
              <p className="text-xs text-slate-600 mt-1">Run a simulation in Sandbox and save it!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {strategies.map((s, i) => (
                <motion.div
                  key={s.id ?? i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <StrategyCard strategy={s} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* AI Coach */}
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-600 mb-4">AI Invest Coach</p>

          <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
            <p className="text-sm text-slate-400 mb-5 leading-relaxed">
              Let AI analyse your strategy history and reveal your investing personality, strengths, and blindspots.
            </p>

            {!coachResult ? (
              <button
                onClick={handleGetCoach}
                disabled={coachLoading}
                className="w-full rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 py-3 text-sm font-bold text-purple-300 transition-all hover:bg-[#7c3aed]/30 disabled:opacity-40"
              >
                {coachLoading ? "Analysing..." : "Get My Investing Personality →"}
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Personality type */}
                  <div className="rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-4">
                    <p className="text-xs uppercase tracking-wider text-purple-400 mb-1">Personality Type</p>
                    <p className="text-xl font-bold text-white">{coachResult.personality_type}</p>
                  </div>

                  {/* Risk profile */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Risk Profile:</span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${RISK_COLORS[coachResult.risk_profile] ?? RISK_COLORS.unknown}`}>
                      {coachResult.risk_profile}
                    </span>
                  </div>

                  {/* Strengths */}
                  <div>
                    <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-2">Strengths</p>
                    <ul className="space-y-1">
                      {coachResult.strengths.map((s, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                          <span className="text-green-400">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Blindspots */}
                  <div>
                    <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider mb-2">Blindspots</p>
                    <ul className="space-y-1">
                      {coachResult.blindspots.map((b, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                          <span className="text-yellow-400">⚠</span> {b}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Narrative */}
                  <AiInsight text={coachResult.narrative} />

                  <button
                    onClick={() => setCoachResult(null)}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Re-analyse →
                  </button>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
