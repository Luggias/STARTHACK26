"use client";

import { useRouter } from "next/navigation";
import IntroScenes from "@/components/intro-scenes";

export default function LandingPage() {
  const router = useRouter();
  return <IntroScenes onComplete={() => router.push("/sandbox")} />;
}
