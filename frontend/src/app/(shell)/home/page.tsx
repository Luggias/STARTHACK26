"use client";

import { useGameStore } from "@/store/game-store";
import LearningPath from "@/components/learning-path";
import UserStatCard from "@/components/user-stat-card";
import LongtermSummaryCard from "@/components/longterm-summary-card";
import Link from "next/link";

export default function HomePage() {
  const user = useGameStore((s) => s.user);
  const unlockedAssets = useGameStore((s) => s.unlockedAssets);
  const longtermPortfolio = useGameStore((s) => s.longtermPortfolio);

  if (!user) return null;

  return (
    <div className="min-h-screen p-6 pt-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, <span className="text-[#00d4ff]">{user.username}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">Your financial learning journey</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* User stat card */}
          <UserStatCard user={user} />

          {/* Long-term portfolio */}
          {longtermPortfolio ? (
            <LongtermSummaryCard portfolio={longtermPortfolio} />
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#0f0f1a] p-6 text-center">
              <p className="text-sm text-slate-500 mb-3">No long-term portfolio yet</p>
              <Link
                href="/sandbox"
                className="inline-flex items-center gap-2 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 px-4 py-2 text-sm font-semibold text-[#00d4ff] hover:bg-[#00d4ff]/20 transition-colors"
              >
                Build One in Sandbox →
              </Link>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/sandbox"
              className="rounded-xl border border-white/5 bg-[#0f0f1a] p-4 hover:border-[#00d4ff]/20 hover:bg-[#00d4ff]/5 transition-all"
            >
              <p className="text-lg mb-1">⚗</p>
              <p className="text-sm font-semibold text-white">Sandbox</p>
              <p className="text-xs text-slate-500">Test strategies</p>
            </Link>
            <Link
              href="/battle"
              className="rounded-xl border border-white/5 bg-[#0f0f1a] p-4 hover:border-purple-500/20 hover:bg-purple-500/5 transition-all"
            >
              <p className="text-lg mb-1">⚔</p>
              <p className="text-sm font-semibold text-white">Battle</p>
              <p className="text-xs text-slate-500">Compete 1v1</p>
            </Link>
          </div>
        </div>

        {/* Right column — learning path */}
        <div>
          <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
            <p className="text-xs uppercase tracking-wider text-slate-600 mb-5">Learning Path</p>
            <LearningPath unlockedAssets={unlockedAssets} />
          </div>
        </div>
      </div>
    </div>
  );
}
