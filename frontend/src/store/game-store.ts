import { create } from "zustand";
import type { Allocation, Player } from "@/lib/types";
import { DEFAULT_ALLOCATION, ASSET_KEYS } from "@/lib/constants";

interface GameState {
  /* Player */
  player: Player | null;
  setPlayer: (p: Player) => void;

  /* Portfolio allocation (percentages, sum to 100) */
  allocation: Allocation;
  setAssetAllocation: (asset: keyof Allocation, value: number) => void;
  resetAllocation: () => void;
}

/**
 * When one slider changes, redistribute the delta proportionally among the other assets.
 * Ensures the total always sums to 100.
 */
function redistributeAllocation(
  current: Allocation,
  changedAsset: keyof Allocation,
  newValue: number,
): Allocation {
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const delta = clamped - current[changedAsset];

  if (delta === 0) return { ...current, [changedAsset]: clamped };

  const otherKeys = ASSET_KEYS.filter((k) => k !== changedAsset);
  const otherTotal = otherKeys.reduce((sum, k) => sum + current[k], 0);

  const next = { ...current, [changedAsset]: clamped };

  if (otherTotal === 0) {
    // Edge case: all others are 0, distribute evenly
    const perAsset = Math.floor((100 - clamped) / otherKeys.length);
    let remainder = 100 - clamped - perAsset * otherKeys.length;
    for (const k of otherKeys) {
      next[k] = perAsset + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
  } else {
    // Proportional redistribution
    let distributed = 0;
    for (let i = 0; i < otherKeys.length; i++) {
      const k = otherKeys[i];
      if (i === otherKeys.length - 1) {
        // Last one gets the remainder to avoid rounding errors
        next[k] = Math.max(0, 100 - clamped - distributed);
      } else {
        const proportion = current[k] / otherTotal;
        const adjusted = Math.max(0, Math.round(current[k] - delta * proportion));
        next[k] = adjusted;
        distributed += adjusted;
      }
    }
  }

  return next;
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  setPlayer: (p) => set({ player: p }),

  allocation: { ...DEFAULT_ALLOCATION },
  setAssetAllocation: (asset, value) =>
    set((state) => ({
      allocation: redistributeAllocation(state.allocation, asset, value),
    })),
  resetAllocation: () => set({ allocation: { ...DEFAULT_ALLOCATION } }),
}));
