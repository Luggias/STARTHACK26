"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";
import IntroScenes from "@/components/intro-scenes";

export default function LandingPage() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && playerName) {
      router.replace("/sandbox");
    }
  }, [hydrated, playerName, router]);

  // Wait for hydration before deciding
  if (!hydrated) return null;

  // Already logged in — redirect (effect above handles it)
  if (playerName) return null;

  return <IntroScenes onComplete={() => router.push("/sandbox")} />;
}
