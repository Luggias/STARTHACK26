"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import LearningPath from "@/components/learning-path";
import UserStatCard from "@/components/user-stat-card";
import LongtermSummaryCard from "@/components/longterm-summary-card";

const ACTIONS = [
  {
    href: "/sandbox",
    icon: "↗",
    title: "Sandbox",
    body: "Test strategies against history",
    accent: "#2997ff",
  },
  {
    href: "/battle",
    icon: "⚡",
    title: "Battle",
    body: "Compete in live 1v1 matchups",
    accent: "#bf5af2",
  },
  {
    href: "/dashboard",
    icon: "◎",
    title: "Dashboard",
    body: "Review your performance",
    accent: "#30d158",
  },
];

export default function HomePage() {
  const user             = useGameStore((s) => s.user);
  const unlockedAssets   = useGameStore((s) => s.unlockedAssets);
  const longtermPortfolio = useGameStore((s) => s.longtermPortfolio);

  if (!user) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen px-6 py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <p className="text-sm text-white/30">{greeting}</p>
        <h1 className="text-headline text-white">{user.full_name}</h1>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* User stat card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <UserStatCard user={user} />
          </motion.div>

          {/* Long-term portfolio */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
            {longtermPortfolio ? (
              <LongtermSummaryCard portfolio={longtermPortfolio} />
            ) : (
              <div className="glass rounded-2xl p-6">
                <p className="mb-1 text-sm font-semibold text-white">Long-term Portfolio</p>
                <p className="mb-4 text-sm text-white/40">
                  No portfolio yet. Build one in the Sandbox and save it.
                </p>
                <Link
                  href="/sandbox"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#0077ed]"
                >
                  Start in Sandbox →
                </Link>
              </div>
            )}
          </motion.div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ACTIONS.map((a, i) => (
              <motion.div
                key={a.href}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
              >
                <Link href={a.href}>
                  <div className="glass group rounded-2xl p-5 transition-all hover:bg-white/[0.06]">
                    <div
                      className="mb-3 text-2xl"
                      style={{ color: a.accent }}
                    >
                      {a.icon}
                    </div>
                    <p className="text-sm font-semibold text-white">{a.title}</p>
                    <p className="mt-0.5 text-xs text-white/35">{a.body}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Learning path */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-6"
        >
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/30">Learning Path</p>
            <p className="mt-1 text-sm text-white/50">
              {unlockedAssets.length} of 5 assets unlocked
            </p>
            {/* Progress bar */}
            <div className="mt-3 h-1 rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#0071e3] transition-all duration-700"
                style={{ width: `${(unlockedAssets.length / 5) * 100}%` }}
              />
            </div>
          </div>
          <LearningPath unlockedAssets={unlockedAssets} />
        </motion.div>
      </div>
    </div>
  );
}
