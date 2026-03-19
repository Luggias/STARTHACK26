"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { createClan, joinClan, getClanLeaderboard } from "@/lib/api";
import type { Clan, LeaderboardEntry } from "@/lib/types";
import ClanCard from "@/components/clan-card";

export default function ClansPage() {
  const user = useGameStore((s) => s.user);
  const [clanName, setClanName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [currentClan, setCurrentClan] = useState<Clan | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentClan) {
      getClanLeaderboard(currentClan.id)
        .then((d) => setLeaderboard(d.leaderboard))
        .catch(() => {});
    }
  }, [currentClan]);

  async function handleCreateClan() {
    if (!clanName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { clan } = await createClan(clanName.trim());
      setCurrentClan(clan);
      setClanName("");
    } catch (e) {
      setError("Failed to create clan. Try a different name.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinClan() {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { clan } = await joinClan(joinCode.trim().toUpperCase());
      setCurrentClan(clan);
      setJoinCode("");
    } catch {
      setError("Invalid join code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Clans</h1>
        <p className="text-sm text-slate-500 mt-1">Compete with your squad</p>
      </div>

      {!currentClan ? (
        <div className="grid gap-6 lg:grid-cols-2 max-w-2xl">
          {/* Create */}
          <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Create a Clan</h2>
            <input
              type="text"
              placeholder="Clan name..."
              value={clanName}
              onChange={(e) => setClanName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateClan()}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/30 mb-3"
              maxLength={30}
            />
            <button
              onClick={handleCreateClan}
              disabled={loading || !clanName.trim()}
              className="w-full rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 py-2.5 text-sm font-bold text-[#00d4ff] hover:bg-[#00d4ff]/20 disabled:opacity-40 transition-all"
            >
              {loading ? "Creating..." : "Create Clan"}
            </button>
          </div>

          {/* Join */}
          <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Join a Clan</h2>
            <input
              type="text"
              placeholder="Join code..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinClan()}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/30 font-mono-data mb-3"
              maxLength={12}
            />
            <button
              onClick={handleJoinClan}
              disabled={loading || !joinCode.trim()}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10 disabled:opacity-40 transition-all"
            >
              {loading ? "Joining..." : "Join Clan"}
            </button>
          </div>

          {error && <p className="col-span-2 text-sm text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <ClanCard clan={currentClan} memberCount={leaderboard.length} isOwn />

          {/* Leaderboard */}
          <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
            <p className="text-xs uppercase tracking-wider text-slate-600 mb-4">Clan Leaderboard</p>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-slate-600">No data yet. Play some battles!</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={entry.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-data text-xs text-slate-600 w-4">{i + 1}</span>
                      <span className="text-sm font-semibold text-white">{entry.username}</span>
                      {entry.user_id === user?.id && (
                        <span className="rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 px-2 py-0.5 text-[10px] text-[#00d4ff]">You</span>
                      )}
                    </div>
                    <span className="font-mono-data text-sm text-[#00d4ff]">{entry.invest_iq} IQ</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setCurrentClan(null)}
            className="text-sm text-slate-600 hover:text-slate-400 transition-colors"
          >
            ← Leave / switch clan
          </button>
        </div>
      )}
    </div>
  );
}
