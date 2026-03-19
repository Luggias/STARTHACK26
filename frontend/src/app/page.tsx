"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { registerPlayer } from "@/lib/api";

/* ─── Scene definitions ──────────────────────────────────────────────────── */

interface Scene {
  id: string;
  duration: number; // auto-advance after ms (0 = manual)
}

const SCENES: Scene[] = [
  { id: "hook",    duration: 3500 },
  { id: "melt",    duration: 6500 },
  { id: "punchline", duration: 4000 },
  { id: "cta",     duration: 0 },
];

/* ─── Countdown data ─────────────────────────────────────────────────────── */

const COUNTDOWN = [
  { label: "Today",    value: 10000, display: "10,000" },
  { label: "5 years",  value: 8626,  display: "8,626" },
  { label: "10 years", value: 7441,  display: "7,441" },
  { label: "15 years", value: 6419,  display: "6,419" },
  { label: "20 years", value: 5537,  display: "5,537" },
  { label: "30 years", value: 4120,  display: "4,120" },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const setPlayer = useGameStore((s) => s.setPlayer);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [countStep, setCountStep] = useState(0);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scene = SCENES[sceneIndex];

  /* Auto-advance */
  useEffect(() => {
    if (scene.duration === 0) return;
    const t = setTimeout(() => {
      if (sceneIndex < SCENES.length - 1) setSceneIndex((i) => i + 1);
    }, scene.duration);
    return () => clearTimeout(t);
  }, [sceneIndex, scene.duration]);

  /* Countdown ticker for melt scene */
  useEffect(() => {
    if (scene.id !== "melt") return;
    setCountStep(0);
    const iv = setInterval(() => {
      setCountStep((p) => {
        if (p >= COUNTDOWN.length - 1) { clearInterval(iv); return p; }
        return p + 1;
      });
    }, 800);
    return () => clearInterval(iv);
  }, [scene.id]);

  /* Tap to advance */
  const handleTap = useCallback(() => {
    if (sceneIndex < SCENES.length - 1) setSceneIndex((i) => i + 1);
  }, [sceneIndex]);

  /* CTA */
  async function handleStart() {
    const trimmed = username.trim();
    if (!trimmed) { setError("Pick a username to continue"); return; }
    setLoading(true);
    setError("");
    try {
      const player = await registerPlayer(trimmed);
      setPlayer(player);
    } catch {
      setPlayer({ id: crypto.randomUUID(), username: trimmed });
    }
    router.push("/sandbox");
  }

  /* Derived */
  const lostAmount = 10000 - COUNTDOWN[countStep].value;
  const lostPct = Math.round((lostAmount / 10000) * 100);
  const isDramatic = sceneIndex >= 1 && sceneIndex <= 2;

  return (
    <main
      className="relative flex min-h-screen select-none flex-col items-center justify-center overflow-hidden px-6"
      onClick={handleTap}
    >
      {/* Red pulse background for dramatic scenes */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          background: isDramatic
            ? "radial-gradient(ellipse at center, rgba(127,29,29,0.25) 0%, rgba(15,23,42,1) 70%)"
            : "radial-gradient(ellipse at center, rgba(15,23,42,0) 0%, rgba(15,23,42,1) 70%)",
        }}
        transition={{ duration: 1.5 }}
      />

      {/* Skip */}
      {scene.id !== "cta" && (
        <button
          onClick={(e) => { e.stopPropagation(); setSceneIndex(SCENES.length - 1); }}
          className="absolute right-6 top-6 z-50 text-xs text-slate-600 transition-colors hover:text-slate-400"
        >
          Skip &rarr;
        </button>
      )}

      <AnimatePresence mode="wait">
        {/* ── Scene 1: Hook ─────────────────────────────────────────── */}
        {scene.id === "hook" && (
          <SceneWrapper key="hook">
            <motion.p
              className="font-mono text-5xl font-black text-green-400 sm:text-6xl"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              $10,000 saved.
            </motion.p>
            <motion.p
              className="mt-4 font-mono text-5xl font-black text-red-400 sm:text-6xl"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              $0 invested.
            </motion.p>
            <motion.p
              className="mt-8 text-2xl font-bold text-slate-300 sm:text-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
            >
              That&apos;s not saving.
            </motion.p>
            <motion.p
              className="mt-1 text-2xl font-black text-red-500 sm:text-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.3 }}
            >
              That&apos;s losing.
            </motion.p>
          </SceneWrapper>
        )}

        {/* ── Scene 2: Money melt countdown ─────────────────────────── */}
        {scene.id === "melt" && (
          <SceneWrapper key="melt">
            {/* Big counter */}
            <motion.div
              className="relative flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
                Your money is now worth
              </p>
              <motion.p
                className="mt-2 font-mono text-5xl font-black tabular-nums sm:text-7xl"
                key={countStep}
                initial={{ scale: 1.1, color: "#F8FAFC" }}
                animate={{
                  scale: 1,
                  color: countStep <= 1 ? "#4ADE80" : countStep <= 3 ? "#FBBF24" : "#EF4444",
                }}
                transition={{ type: "spring", damping: 12 }}
              >
                ${COUNTDOWN[countStep].display}
              </motion.p>
              <motion.p
                className="mt-3 text-2xl font-bold text-slate-400 sm:text-3xl"
                key={`label-${countStep}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {COUNTDOWN[countStep].label}
              </motion.p>
            </motion.div>

            {/* Loss indicator */}
            <motion.div
              className="mt-8 flex flex-col items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: countStep > 0 ? 1 : 0 }}
            >
              {/* Loss bar */}
              <div className="h-3 w-64 overflow-hidden rounded-full bg-surface-lighter sm:w-80">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600"
                  initial={{ width: "0%" }}
                  animate={{ width: `${lostPct}%` }}
                  transition={{ type: "spring", damping: 15, stiffness: 80 }}
                />
              </div>
              <motion.p
                className="text-lg font-extrabold text-red-400 sm:text-xl"
                key={`lost-${countStep}`}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10 }}
              >
                &minus;${lostAmount.toLocaleString()} gone
              </motion.p>
              <p className="text-xs text-slate-600">
                Just from inflation. No crash. No crisis.
              </p>
            </motion.div>

            {/* Final punch */}
            <AnimatePresence>
              {countStep >= COUNTDOWN.length - 1 && (
                <motion.div
                  className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-8 py-4 text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring" }}
                >
                  <p className="text-2xl font-black text-red-400 sm:text-3xl">
                    &minus;59% purchasing power
                  </p>
                  <p className="mt-1 text-sm text-red-300/60">
                    By doing absolutely nothing.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </SceneWrapper>
        )}

        {/* ── Scene 3: Punchline ───────────────────────────────────── */}
        {scene.id === "punchline" && (
          <SceneWrapper key="punchline">
            <motion.h2
              className="text-center text-3xl font-black leading-tight sm:text-4xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              The biggest risk?
            </motion.h2>
            <motion.h2
              className="mt-2 text-center text-3xl font-black leading-tight text-red-400 sm:text-4xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              Not investing at all.
            </motion.h2>
            <motion.p
              className="mt-6 max-w-sm text-center text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              But you can change that — in the next 5 minutes.
            </motion.p>
          </SceneWrapper>
        )}

        {/* ── Scene 4: CTA ─────────────────────────────────────────── */}
        {scene.id === "cta" && (
          <SceneWrapper key="cta">
            <motion.h2
              className="text-center text-3xl font-black sm:text-4xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Learn to invest.
              <br />
              <span className="bg-gradient-to-r from-brand-blue to-brand-purple bg-clip-text text-transparent">
                By playing.
              </span>
            </motion.h2>
            <motion.p
              className="mt-3 text-center text-slate-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              No real money. No risk. Just knowledge.
            </motion.p>

            {/* Username + CTA */}
            <motion.div
              className="mt-8 flex w-full max-w-sm flex-col items-center gap-3"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, type: "spring" }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                placeholder="Choose a username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                className="w-full rounded-xl border border-surface-lighter bg-surface-light px-5 py-3.5
                           text-center text-lg text-white placeholder-slate-500
                           outline-none transition-all focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
                maxLength={20}
                autoFocus
              />
              <motion.button
                className="w-full rounded-2xl bg-gradient-to-r from-brand-blue via-brand-purple to-brand-blue
                           py-4 text-xl font-extrabold shadow-lg shadow-brand-blue/20
                           transition-shadow hover:shadow-xl hover:shadow-brand-blue/30
                           disabled:opacity-50"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                disabled={loading}
              >
                {loading ? "Loading..." : "Start Playing"}
              </motion.button>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </motion.div>
          </SceneWrapper>
        )}
      </AnimatePresence>

    </main>
  );
}

/* ─── Shared sub-components ──────────────────────────────────────────────── */

function SceneWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      {children}
    </motion.div>
  );
}
