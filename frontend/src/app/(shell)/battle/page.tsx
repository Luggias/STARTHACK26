"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useGameStore } from "@/store/game-store";
import { quickmatch, createPrivateBattle, joinByInvite } from "@/lib/api";

type Status = "idle" | "searching" | "creating";

export default function BattleLobbyPage() {
  const router   = useRouter();
  const user     = useGameStore((s) => s.user);
  const [status, setStatus]         = useState<Status>("idle");
  const [joinCode, setJoinCode]     = useState("");
  const [joiningPrivate, setJoiningPrivate] = useState(false);
  const [error, setError]           = useState("");

  const playerId = user?.id ?? "guest-" + Math.random().toString(36).slice(2, 8);
  const username = user?.username ?? "Guest";

  async function handleFindMatch() {
    setStatus("searching"); setError("");
    try {
      const result = await quickmatch(playerId, username);
      router.push(`/battle/${result.room_id}`);
    } catch {
      setError("Could not reach server."); setStatus("idle");
    }
  }

  async function handleCreatePrivate() {
    setError("");
    try {
      const b = await createPrivateBattle(playerId, username);
      router.push(`/battle/${b.room_id}`);
    } catch { setError("Failed to create room."); }
  }

  async function handleJoinPrivate() {
    if (!joinCode.trim()) return;
    setJoiningPrivate(true); setError("");
    try {
      const r = await joinByInvite(joinCode.trim().toUpperCase());
      router.push(`/battle/${r.room_id}`);
    } catch {
      setError("Invalid invite code.");
      setJoiningPrivate(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-headline text-white">Battle</h1>
        <p className="mt-1 text-sm text-white/35">Same market. Different strategies. Who wins?</p>
      </motion.div>

      <div className="mt-10 grid gap-4 max-w-3xl lg:grid-cols-3">
        {/* Random match */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#bf5af2]/15 text-lg text-[#bf5af2]">
            ⚡
          </div>
          <p className="text-sm font-semibold text-white">Quick Match</p>
          <p className="mt-1 mb-5 text-xs text-white/35">Get matched with a random opponent</p>

          {status === "idle" ? (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleFindMatch}
              className="w-full rounded-full bg-[#bf5af2] py-3 text-sm font-semibold text-white hover:bg-[#c56df5] transition-all"
            >
              Find Opponent
            </motion.button>
          ) : (
            <div className="flex items-center gap-3 rounded-full bg-white/[0.06] px-5 py-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#bf5af2] border-t-transparent" />
              <span className="text-xs text-white/50">
                {status === "searching" ? "Searching…" : "Creating room…"}
              </span>
            </div>
          )}
        </motion.div>

        {/* Private battle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-6"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#2997ff]/15 text-lg text-[#2997ff]">
            🔗
          </div>
          <p className="text-sm font-semibold text-white">Challenge Friend</p>
          <p className="mt-1 mb-5 text-xs text-white/35">Create or join a private room</p>

          <button
            onClick={handleCreatePrivate}
            className="w-full rounded-full bg-[#0071e3] py-2.5 text-sm font-semibold text-white hover:bg-[#0077ed] transition-all mb-3"
          >
            Create Room
          </button>

          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinPrivate()}
              placeholder="Invite code"
              maxLength={12}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-mono-data text-white placeholder-white/20 outline-none focus:border-white/15"
            />
            <button
              onClick={handleJoinPrivate}
              disabled={joiningPrivate || !joinCode.trim()}
              className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.1] disabled:opacity-30 transition-all"
            >
              Join
            </button>
          </div>
        </motion.div>

        {/* Clans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#30d158]/15 text-lg text-[#30d158]">
            ◈
          </div>
          <p className="text-sm font-semibold text-white">Clan Battle</p>
          <p className="mt-1 mb-5 text-xs text-white/35">Compete with your squad's leaderboard</p>

          <Link
            href="/clans"
            className="block w-full rounded-full border border-white/[0.1] py-2.5 text-center text-sm font-semibold text-white/60 hover:bg-white/[0.04] hover:text-white transition-all"
          >
            View Clans →
          </Link>
        </motion.div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[#ff453a]">{error}</p>
      )}
    </div>
  );
}
