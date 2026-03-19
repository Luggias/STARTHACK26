"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { getMyStrategies, getAiCoach } from "@/lib/api";
import type { Strategy } from "@/lib/types";
import StrategyCard from "@/components/strategy-card";
import AiInsight from "@/components/ai-insight";

const RISK_STYLES: Record<string, { color: string }> = {
  conservative: { color: "#30d158" },
  moderate:     { color: "#ff9f0a" },
  aggressive:   { color: "#ff453a" },
  unknown:      { color: "#86868b" },
};

type CoachResult = {
  personality_type: string;
  strengths: string[];
  blindspots: string[];
  risk_profile: string;
  narrative: string;
};

export default function ReviewPage() {
  const token = useGameStore((s) => s.token);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading]       = useState(true);
  const [coach, setCoach]           = useState<CoachResult | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    getMyStrategies().then(setStrategies).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  async function handleCoach() {
    setCoachLoading(true);
    try { setCoach(await getAiCoach(strategies)); }
    catch { setCoach({ personality_type: "Balanced Builder", strengths: ["Diversified thinking"], blindspots: ["More data needed"], risk_profile: "moderate", narrative: "You build balanced portfolios. Keep experimenting." }); }
    finally { setCoachLoading(false); }
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-headline text-white">Review</h1>
        <p className="mt-1 text-sm text-white/35">Your strategies and investing personality</p>
      </motion.div>

      <div className="mt-10 grid gap-6 max-w-4xl lg:grid-cols-2">
        {/* Strategy timeline */}
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">
            Strategies ({strategies.length})
          </p>
          {loading ? (
            <p className="text-sm text-white/25">Loading…</p>
          ) : strategies.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-sm text-white/40">No strategies yet.</p>
              <p className="mt-1 text-xs text-white/20">Run a simulation in Sandbox and save it.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {strategies.map((s, i) => (
                <motion.div
                  key={s.id ?? i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <StrategyCard strategy={s} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* AI Coach */}
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">
            AI Invest Coach
          </p>

          {!coach ? (
            <div className="glass rounded-2xl p-6">
              <p className="mb-1 text-sm font-semibold text-white">Discover your investing personality</p>
              <p className="mb-6 text-sm text-white/40 leading-relaxed">
                Claude analyses your strategy history to reveal your strengths,
                blindspots, and risk profile.
              </p>
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handleCoach}
                disabled={coachLoading}
                className="w-full rounded-full bg-[#bf5af2] py-3.5 text-sm font-semibold text-white hover:bg-[#c56df5] disabled:opacity-30 transition-all"
              >
                {coachLoading ? "Analysing…" : "Get My Profile →"}
              </motion.button>
            </div>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Personality card */}
                <div className="glass rounded-2xl p-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/25 mb-2">Personality</p>
                  <p className="text-2xl font-bold text-white">{coach.personality_type}</p>
                  <div
                    className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize"
                    style={{ background: `${RISK_STYLES[coach.risk_profile]?.color ?? "#86868b"}18`, color: RISK_STYLES[coach.risk_profile]?.color ?? "#86868b" }}
                  >
                    {coach.risk_profile}
                  </div>
                </div>

                {/* Strengths */}
                <div className="glass rounded-2xl p-5">
                  <p className="mb-3 text-xs font-medium text-[#30d158]">Strengths</p>
                  <ul className="space-y-2">
                    {coach.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#30d158]" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Blindspots */}
                <div className="glass rounded-2xl p-5">
                  <p className="mb-3 text-xs font-medium text-[#ff9f0a]">Blindspots</p>
                  <ul className="space-y-2">
                    {coach.blindspots.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#ff9f0a]" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <AiInsight text={coach.narrative} />

                <button
                  onClick={() => setCoach(null)}
                  className="text-xs text-white/20 hover:text-white/50 transition-colors"
                >
                  Re-analyse →
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
