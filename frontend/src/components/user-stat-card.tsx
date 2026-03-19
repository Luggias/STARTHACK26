"use client";

import type { User } from "@/lib/types";

const RISK_COLORS: Record<string, string> = {
  conservative: "text-green-400 bg-green-400/10 border-green-400/20",
  moderate: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  aggressive: "text-red-400 bg-red-400/10 border-red-400/20",
  unknown: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

interface UserStatCardProps {
  user: User;
}

export default function UserStatCard({ user }: UserStatCardProps) {
  const riskProfile = user.risk_profile ?? "unknown";
  const riskClass = RISK_COLORS[riskProfile] ?? RISK_COLORS.unknown;

  return (
    <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-600">Invest-IQ</p>
          <p className="font-mono-data text-4xl font-bold text-[#00d4ff] text-glow-cyan">
            {user.invest_iq ?? 0}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-slate-600 mb-2">Risk Profile</p>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${riskClass}`}>
            {riskProfile}
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-white/5 pt-4">
        <p className="text-sm font-semibold text-white">{user.full_name}</p>
        <p className="text-xs text-slate-500">@{user.username}</p>
      </div>
    </div>
  );
}
