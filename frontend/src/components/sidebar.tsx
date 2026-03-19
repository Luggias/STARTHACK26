"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: "⌂" },
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/sandbox", label: "Sandbox", icon: "⚗" },
  { href: "/battle", label: "Battle", icon: "⚔" },
  { href: "/clans", label: "Clans", icon: "◈" },
  { href: "/review", label: "Review", icon: "✦" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useGameStore((s) => s.logout);

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-16 flex-col items-center border-r border-white/5 bg-[#0a0a0f] py-6 md:w-56 md:items-start md:px-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3 px-0 md:px-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00d4ff]/10 text-[#00d4ff] font-bold text-sm font-mono-data">
          C
        </div>
        <span className="hidden text-sm font-bold tracking-wider text-white md:block">
          CACHE ME
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1 w-full">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className="relative">
              <motion.div
                className={`flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors md:px-3 ${
                  active
                    ? "bg-[#00d4ff]/10 text-[#00d4ff]"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                }`}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg border border-[#00d4ff]/20"
                    style={{ boxShadow: "0 0 12px rgba(0,212,255,0.15)" }}
                    transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  />
                )}
                <span className={`relative text-base ${active ? "text-glow-cyan" : ""}`} style={{ width: 20, textAlign: "center" }}>
                  {item.icon}
                </span>
                <span className="relative hidden text-xs font-semibold tracking-wider uppercase md:block">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-4 flex items-center gap-3 rounded-lg px-2 py-2.5 text-slate-600 transition-colors hover:bg-white/5 hover:text-red-400 md:px-3 w-full"
      >
        <span className="text-base" style={{ width: 20, textAlign: "center" }}>⏻</span>
        <span className="hidden text-xs font-semibold tracking-wider uppercase md:block">Logout</span>
      </button>
    </aside>
  );
}
