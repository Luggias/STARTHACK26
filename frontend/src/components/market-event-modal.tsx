"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { MarketEvent } from "@/lib/types";

interface MarketEventModalProps {
  event: MarketEvent | null;
  onDismiss: () => void;
}

export default function MarketEventModal({ event, onDismiss }: MarketEventModalProps) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.key}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} />

          {/* Panel */}
          <motion.div
            className="relative z-10 w-full max-w-md rounded-2xl border border-[#00d4ff]/20 bg-[#0f0f1a] p-8 shadow-2xl"
            style={{ boxShadow: "0 0 40px rgba(0,212,255,0.1)" }}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Alert badge */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Market Event</span>
            </div>

            <h2 className="text-xl font-bold text-white leading-tight mb-3">{event.headline}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{event.description}</p>

            <button
              onClick={onDismiss}
              className="mt-6 w-full rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 py-3 text-sm font-semibold text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20"
            >
              Continue →
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
