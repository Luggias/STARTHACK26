"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";

const NAV = [
  { href: "/home",      label: "Home",      icon: <HomeIcon /> },
  { href: "/dashboard", label: "Dashboard", icon: <ChartIcon /> },
  { href: "/sandbox",   label: "Sandbox",   icon: <FlaskIcon /> },
  { href: "/battle",    label: "Battle",    icon: <BattleIcon /> },
  { href: "/clans",     label: "Clans",     icon: <ClansIcon /> },
  { href: "/review",    label: "Review",    icon: <ReviewIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const logout   = useGameStore((s) => s.logout);
  const user     = useGameStore((s) => s.user);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[60px] flex-col items-center border-r border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-xl py-5 md:w-[220px] md:items-start md:px-3">
      {/* Logo mark */}
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#0071e3] text-white text-sm font-bold">
          C
        </div>
        <div className="hidden md:block">
          <p className="text-xs font-semibold text-white leading-tight">Cache Me</p>
          <p className="text-[10px] text-white/30 leading-tight">If You Can</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 w-full">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: active ? 0 : 2 }}
                whileTap={{ scale: 0.97 }}
                className={`relative flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors md:px-3 ${
                  active
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                }`}
              >
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {item.icon}
                </span>
                <span className="hidden text-sm font-medium md:block">{item.label}</span>
                {active && (
                  <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[#2997ff] md:block" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="mt-2 w-full">
        {user && (
          <div className="mb-2 hidden items-center gap-2.5 rounded-xl px-3 py-2 md:flex">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
              {user.username[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white/80">{user.username}</p>
              <p className="text-[10px] text-white/30">IQ {user.invest_iq}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => { logout(); router.push("/"); }}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/60 md:px-3"
        >
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            <LogoutIcon />
          </span>
          <span className="hidden text-sm font-medium md:block">Sign out</span>
        </button>
      </div>
    </aside>
  );
}

/* ── SVG icons ── */
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}
function FlaskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v10l3.5 6A1 1 0 0117.6 21H6.4a1 1 0 01-.9-1.5L9 13V3z"/>
    </svg>
  );
}
function BattleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
function ClansIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function ReviewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
