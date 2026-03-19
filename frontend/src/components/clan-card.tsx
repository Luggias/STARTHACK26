"use client";

import type { Clan } from "@/lib/types";

interface ClanCardProps {
  clan: Clan;
  memberCount?: number;
  topMember?: string;
  isOwn?: boolean;
}

export default function ClanCard({ clan, memberCount, topMember, isOwn }: ClanCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${isOwn ? "border-[#00d4ff]/20 bg-[#00d4ff]/5" : "border-white/5 bg-[#0f0f1a]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{clan.name}</p>
          {memberCount !== undefined && (
            <p className="text-xs text-slate-500 mt-0.5">{memberCount} member{memberCount !== 1 ? "s" : ""}</p>
          )}
        </div>
        <span className="font-mono-data text-xs text-slate-600 border border-white/5 rounded px-2 py-1">
          {clan.join_code}
        </span>
      </div>
      {topMember && (
        <p className="mt-3 text-xs text-slate-500">
          Top: <span className="text-[#00d4ff]">{topMember}</span>
        </p>
      )}
    </div>
  );
}
