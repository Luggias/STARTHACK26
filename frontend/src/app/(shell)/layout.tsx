"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";
import Sidebar from "@/components/sidebar";
import TickerBar from "@/components/ticker-bar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useGameStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      router.replace("/");
    }
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="bg-grid min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      {/* Main content — offset for sidebar + ticker bar */}
      <main className="ml-16 min-h-screen pb-8 md:ml-56">
        {children}
      </main>
      <TickerBar />
    </div>
  );
}
