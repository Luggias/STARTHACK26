"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { createClan, joinClan, getClanLeaderboard } from "@/lib/api";
import type { Clan, LeaderboardEntry } from "@/lib/types";

export default function ClansPage() {
  const user = useGameStore((s) => s.user);
  const [clanName, setClanName]         = useState("");
  const [joinCode, setJoinCode]         = useState("");
  const [currentClan, setCurrentClan]   = useState<Clan | null>(null);
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([]);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    if (currentClan) getClanLeaderboard(currentClan.id).then((d) => setLeaderboard(d.leaderboard)).catch(() => {});
  }, [currentClan]);

  async function handleCreate() {
    if (!clanName.trim()) return;
    setLoading(true); setError("");
    try { const { clan } = await createClan(clanName.trim()); setCurrentClan(clan); setClanName(""); }
    catch { setError("Name taken or creation failed."); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading(true); setError("");
    try { const { clan } = await joinClan(joinCode.trim().toUpperCase()); setCurrentClan(clan); setJoinCode(""); }
    catch { setError("Invalid code."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-headline text-white">Clans</h1>
        <p className="mt-1 text-sm text-white/35">Squad up and compete on the leaderboard</p>
      </motion.div>

      {!currentClan ? (
        <div className="mt-10 grid gap-4 max-w-2xl sm:grid-cols-2">
          <div className="glass rounded-2xl p-6">
            <p className="mb-4 text-sm font-semibold text-white">Create a clan</p>
            <input
              value={clanName} onChange={(e) => setClanName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Clan name…" maxLength={30}
              className="mb-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/15"
            />
            <button
              onClick={handleCreate} disabled={loading || !clanName.trim()}
              className="w-full rounded-full bg-[#0071e3] py-3 text-sm font-semibold text-white hover:bg-[#0077ed] disabled:opacity-30 transition-all"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>

          <div className="glass rounded-2xl p-6">
            <p className="mb-4 text-sm font-semibold text-white">Join a clan</p>
            <input
              value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Join code…" maxLength={12}
              className="mb-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-mono-data text-white placeholder-white/20 outline-none focus:border-white/15"
            />
            <button
              onClick={handleJoin} disabled={loading || !joinCode.trim()}
              className="w-full rounded-full border border-white/[0.1] py-3 text-sm font-semibold text-white/60 hover:bg-white/[0.04] hover:text-white disabled:opacity-30 transition-all"
            >
              {loading ? "Joining…" : "Join"}
            </button>
          </div>

          {error && <p className="col-span-2 text-sm text-[#ff453a]">{error}</p>}
        </div>
      ) : (
        <div className="mt-10 max-w-lg space-y-5">
          {/* Clan header */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-white">{currentClan.name}</p>
                <p className="text-xs text-white/30 mt-0.5">{leaderboard.length} member{leaderboard.length !== 1 ? "s" : ""}</p>
              </div>
              <span className="font-mono-data text-xs text-white/30 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5">
                {currentClan.join_code}
              </span>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="glass rounded-2xl p-6">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">Leaderboard</p>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-white/25">No data yet. Play some battles!</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((e, i) => (
                  <div key={e.user_id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                    <span className="font-mono-data w-5 text-xs text-white/25">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-white">{e.username}</span>
                    {e.user_id === user?.id && (
                      <span className="rounded-full bg-[#0071e3]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2997ff]">You</span>
                    )}
                    <span className="font-mono-data text-sm text-[#2997ff]">{e.invest_iq}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setCurrentClan(null)} className="text-xs text-white/20 hover:text-white/50 transition-colors">
            ← Leave clan
          </button>
        </div>
      )}
    </div>
  );
}
