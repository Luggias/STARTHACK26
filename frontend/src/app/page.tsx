"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { registerPlayer } from "@/lib/api";
import IntroScenes from "@/components/intro-scenes";
import OnboardingDialog from "@/components/onboarding-dialog";

type Mode = "auth" | "intro" | "onboarding";
type Tab  = "new" | "returning";

export default function HomePage() {
  const router    = useRouter();
  const setPlayer = useGameStore((s) => s.setPlayer);

  const [mode, setMode]       = useState<Mode>("auth");
  const [tab, setTab]         = useState<Tab>("new");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit() {
    const trimmed = username.trim();
    if (!trimmed) { setError("Enter a username to continue"); return; }
    setLoading(true);
    setError("");
    try {
      const player = await registerPlayer(trimmed);
      setPlayer(player);
    } catch {
      setPlayer({ id: crypto.randomUUID(), username: trimmed });
    }
    setLoading(false);
    if (tab === "new") setMode("intro");
    else router.push("/sandbox");
  }

  /* ── Intro → onboarding → sandbox for new players ── */
  if (mode === "intro") {
    return <IntroScenes onComplete={() => setMode("onboarding")} />;
  }
  if (mode === "onboarding") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0F172A]">
        <OnboardingDialog username={username} onComplete={() => router.push("/sandbox")} />
      </main>
    );
  }

  /* ── Auth page ── */
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="absolute left-1/2 top-2/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-purple/10 blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
      >
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight">
            Cache{" "}
            <span className="bg-gradient-to-r from-brand-blue to-brand-purple bg-clip-text text-transparent">
              Me If You Can
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Learn investing by competing. No real money — just real knowledge.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-8 shadow-2xl">

          {/* Tab toggle */}
          <div className="mb-6 flex rounded-xl bg-slate-800/60 p-1">
            {(["new", "returning"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className="relative flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors"
                style={{ color: tab === t ? "#fff" : "#475569" }}
              >
                {tab === t && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-brand-blue to-brand-purple"
                    transition={{ type: "spring", damping: 22, stiffness: 300 }}
                  />
                )}
                <span className="relative">
                  {t === "new" ? "New Player" : "Returning Player"}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={tab}
              className="mb-5 text-center text-xs text-slate-600"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "new"
                ? "Pick a username to create your account."
                : "Enter your username to jump back in."}
            </motion.p>
          </AnimatePresence>

          {/* Input */}
          <input
            type="text"
            placeholder="Username..."
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-3.5
                       text-center text-base text-white placeholder-slate-600
                       outline-none transition-all focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            maxLength={20}
            autoFocus
          />

          {error && (
            <motion.p className="mt-2 text-center text-xs text-red-400"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {error}
            </motion.p>
          )}

          {/* CTA */}
          <motion.button
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-brand-blue to-brand-purple
                       py-3.5 font-bold shadow-lg shadow-brand-blue/20 disabled:opacity-50"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Loading..." : tab === "new" ? "Create Account →" : "Enter Game →"}
          </motion.button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-700">
          START Hack 2026 · Cache Me If You Can
        </p>
      </motion.div>
    </main>
  );
}
