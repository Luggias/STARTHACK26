"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";
import IntroScenes from "@/components/intro-scenes";

export default function LandingPage() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName);
  const introSeen = useGameStore((s) => s.introSeen);
  const setIntroSeen = useGameStore((s) => s.setIntroSeen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Returning user (has account) — skip to sandbox login
    if (playerName) { router.replace("/sandbox"); return; }
    // New user who already saw intro — skip to sandbox create-account
    if (introSeen) { router.replace("/sandbox"); return; }
  }, [hydrated, playerName, introSeen, router]);

  if (!hydrated) return null;
  if (playerName || introSeen) return null;

  return (
    <IntroScenes
      onComplete={() => {
        setIntroSeen(true);
        router.push("/sandbox");
      }}
    />
  );
}
