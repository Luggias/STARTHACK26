"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { createBattle, findOpenBattle, createPrivateBattle, joinByInvite } from "@/lib/api";
import Link from "next/link";

type Status = "idle" | "searching" | "creating";

export default function BattleLobbyPage() {
  const router = useRouter();
  const user = useGameStore((s) => s.user);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  // Private battle
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joiningPrivate, setJoiningPrivate] = useState(false);

  const playerId = user?.id ?? "guest-" + Math.random().toString(36).slice(2, 8);
  const username = user?.username ?? "Guest";

  async function handleFindMatch() {
    setStatus("searching");
    setError("");
    try {
      const { room } = await findOpenBattle();
      if (room) {
        router.push(`/battle/${room.room_id}`);
      } else {
        setStatus("creating");
        const battle = await createBattle(playerId, username);
        router.push(`/battle/${battle.room_id}`);
      }
    } catch {
      setError("Could not connect to server. Is the backend running?");
      setStatus("idle");
    }
  }

  async function handleCreatePrivate() {
    setError("");
    try {
      const battle = await createPrivateBattle(playerId, username);
      setInviteCode(battle.invite_code);
      // Navigate to the room immediately
      router.push(`/battle/${battle.room_id}`);
    } catch {
      setError("Failed to create private room");
    }
  }

  async function handleJoinPrivate() {
    if (!joinCode.trim()) return;
    setJoiningPrivate(true);
    setError("");
    try {
      const room = await joinByInvite(joinCode.trim().toUpperCase());
      router.push(`/battle/${room.room_id}`);
    } catch {
      setError("Invalid invite code");
      setJoiningPrivate(false);
    }
  }

  return (
    <div className="min-h-screen p-6 pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Battle Mode</h1>
        <p className="text-sm text-slate-500 mt-1">Challenge players to a portfolio showdown</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 max-w-4xl">
        {/* Random match */}
        <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Random Match</h2>
          <p className="text-xs text-slate-600 mb-5">Get matched with any available opponent</p>

          {status === "idle" && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleFindMatch}
              className="w-full rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 py-3 text-sm font-bold text-purple-300 transition-all hover:bg-[#7c3aed]/30"
            >
              Find Opponent
            </motion.button>
          )}

          {(status === "searching" || status === "creating") && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
              <p className="text-xs text-slate-400">
                {status === "searching" ? "Searching..." : "Creating room..."}
              </p>
            </div>
          )}
        </div>

        {/* Private battle */}
        <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Challenge a Friend</h2>
          <p className="text-xs text-slate-600 mb-5">Create a private room with an invite code</p>

          <button
            onClick={handleCreatePrivate}
            className="w-full rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 py-2.5 text-sm font-bold text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20 mb-3"
          >
            Create Private Room
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Invite code..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinPrivate()}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/30 font-mono-data"
              maxLength={12}
            />
            <button
              onClick={handleJoinPrivate}
              disabled={joiningPrivate || !joinCode.trim()}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>

        {/* Clan */}
        <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">My Clan</h2>
          <p className="text-xs text-slate-600 mb-5">Compete with your squad</p>

          <Link
            href="/clans"
            className="block w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-sm font-semibold text-slate-300 hover:bg-white/10 transition-all"
          >
            View Clans →
          </Link>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
