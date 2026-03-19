"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { MarketEvent } from "@/lib/types";

export default function MarketEventModal({
  event,
  onDismiss,
}: {
  event: MarketEvent | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.key}
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onDismiss}
          />

          <motion.div
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] border border-white/[0.08]"
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0,  scale: 1,    opacity: 1 }}
            exit={{ y: 40, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
          >
            {/* Accent bar */}
            <div className="h-0.5 w-full bg-gradient-to-r from-[#ff9f0a] via-[#ff453a] to-[#bf5af2]" />

            <div className="p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ff9f0a]/10 px-3 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff9f0a]" />
                <span className="text-xs font-semibold text-[#ff9f0a]">Market Event</span>
              </div>

              <h3 className="mb-2 text-lg font-bold text-white leading-snug">{event.headline}</h3>
              <p className="text-sm leading-relaxed text-white/50">{event.description}</p>

              <button
                onClick={onDismiss}
                className="mt-6 w-full rounded-full bg-white py-3 text-sm font-semibold text-black transition-all hover:bg-white/90"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
