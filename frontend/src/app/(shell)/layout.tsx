"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";
import Sidebar from "@/components/sidebar";
import TickerBar from "@/components/ticker-bar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token  = useGameStore((s) => s.token);

  useEffect(() => {
    if (!token) router.replace("/");
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="ml-[60px] min-h-screen pb-7 md:ml-[220px]">
        {children}
      </main>
      <TickerBar />
    </div>
  );
}
