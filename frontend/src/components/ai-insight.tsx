"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AiInsightProps {
  text: string;
  /** Typewriter speed in ms per character */
  speed?: number;
}

export default function AiInsight({ text, speed = 20 }: AiInsightProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;

    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-brand-purple/30 bg-brand-purple/5 p-5"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-purple">
        <span>🤖</span>
        <span>AI Insight</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-300">
        {displayed}
        {!done && <span className="ml-0.5 inline-block animate-pulse">|</span>}
      </p>
    </motion.div>
  );
}
