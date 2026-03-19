"use client";

import type { User } from "@/lib/types";

const RISK_STYLES: Record<string, { label: string; color: string }> = {
  conservative: { label: "Conservative",  color: "#30d158" },
  moderate:     { label: "Moderate",      color: "#ff9f0a" },
  aggressive:   { label: "Aggressive",    color: "#ff453a" },
  unknown:      { label: "Not set",       color: "#86868b" },
};

export default function UserStatCard({ user }: { user: User }) {
  const risk = RISK_STYLES[user.risk_profile] ?? RISK_STYLES.unknown;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#0071e3]/20 text-2xl font-bold text-[#2997ff]">
          {user.username[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-white">{user.full_name}</p>
          <p className="text-sm text-white/40">@{user.username}</p>
        </div>
        <div
          className="ml-auto flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `${risk.color}18`, color: risk.color }}
        >
          {risk.label}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <StatTile label="Invest-IQ" value={String(user.invest_iq ?? 0)} accent />
        <StatTile label="Country" value={user.country ?? "—"} />
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-4">
      <p className="mb-1 text-xs text-white/40">{label}</p>
      <p className={`font-mono-data text-2xl font-bold ${accent ? "text-[#2997ff]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
