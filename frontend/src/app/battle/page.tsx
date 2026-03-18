"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { createBattle, findOpenBattle } from "@/lib/api";

export default function BattleLobbyPage() {
  const router = useRouter();
  const player = useGameStore((s) => s.player);
  const [status, setStatus] = useState<"idle" | "searching" | "creating">("idle");
  const [error, setError] = useState("");

  async function handleFindMatch() {
    if (!player) return;

    setStatus("searching");
    setError("");

    try {
      // Try to find an open room
      const { room } = await findOpenBattle();

      if (room) {
        // Join existing room
        router.push(`/battle/${room.room_id}`);
      } else {
        // Create a new room and wait
        setStatus("creating");
        const battle = await createBattle(player.id, player.username);
        router.push(`/battle/${battle.room_id}`);
      }
    } catch {
      setError("Could not connect to server. Is the backend running?");
      setStatus("idle");
    }
  }

  // Redirect to landing if no player
  if (!player) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-slate-400">Please enter your username first.</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-brand-blue px-6 py-2 font-bold"
          >
            Go to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <motion.div
        className="max-w-md text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mb-2 text-4xl font-extrabold">Battle Mode</h1>
        <p className="mb-8 text-slate-400">
          Challenge another player to a portfolio showdown. Same market, different
          strategies — who comes out on top?
        </p>

        {status === "idle" && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleFindMatch}
            className="rounded-2xl bg-gradient-to-r from-brand-purple to-brand-blue px-12 py-4
                       text-xl font-extrabold shadow-lg shadow-brand-purple/20
                       transition-shadow hover:shadow-xl hover:shadow-brand-purple/30"
          >
            Find Opponent
          </motion.button>
        )}

        {status === "searching" && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
            <p className="text-sm text-slate-400">Searching for an opponent...</p>
          </div>
        )}

        {status === "creating" && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-purple border-t-transparent" />
            <p className="text-sm text-slate-400">
              No opponents found. Creating a room — share the link!
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          onClick={() => router.push("/sandbox")}
          className="mt-8 text-sm text-slate-600 transition-colors hover:text-slate-400"
        >
          Back to Sandbox
        </button>
      </motion.div>
    </main>
  );
}
