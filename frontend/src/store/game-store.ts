import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Allocation, User, Strategy, LongtermPortfolio, BattleRecord } from "@/lib/types";
import { DEFAULT_ALLOCATION, ASSET_KEYS } from "@/lib/constants";

interface GameState {
  /* Auth */
  user: User | null;
  token: string | null;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  logout: () => void;

  /* Player identity */
  playerName: string;
  setPlayerName: (n: string) => void;

  /* Learning progression */
  unlockedAssets: string[];
  unlockAsset: (asset: string) => void;

  /* Portfolio allocation (percentages, sum to 100) */
  allocation: Allocation;
  setAssetAllocation: (asset: keyof Allocation, value: number) => void;
  resetAllocation: () => void;

  /* Saved strategies */
  strategies: Strategy[];
  addStrategy: (s: Strategy) => void;
  updateStrategy: (index: number, s: Strategy) => void;
  deleteStrategy: (index: number) => void;

  /* Battle records (local leaderboard) */
  battleRecords: BattleRecord[];
  addBattleRecord: (r: BattleRecord) => void;

  /* Long-term portfolio */
  longtermPortfolio: LongtermPortfolio | null;
  setLongtermPortfolio: (p: LongtermPortfolio | null) => void;
}

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
    const perAsset = Math.floor((100 - clamped) / otherKeys.length);
    let remainder = 100 - clamped - perAsset * otherKeys.length;
    for (const k of otherKeys) {
      next[k] = perAsset + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
  } else {
    let distributed = 0;
    for (let i = 0; i < otherKeys.length; i++) {
      const k = otherKeys[i];
      if (i === otherKeys.length - 1) {
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

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (u) => set({ user: u }),
      setToken: (t) => set({ token: t }),
      logout: () => set({ user: null, token: null, unlockedAssets: ["stocks"], strategies: [], longtermPortfolio: null }),

      playerName: "",
      setPlayerName: (n) => set({ playerName: n }),

      unlockedAssets: ["stocks"],
      unlockAsset: (asset) =>
        set((state) => ({
          unlockedAssets: state.unlockedAssets.includes(asset)
            ? state.unlockedAssets
            : [...state.unlockedAssets, asset],
        })),

      allocation: { ...DEFAULT_ALLOCATION },
      setAssetAllocation: (asset, value) =>
        set((state) => ({
          allocation: redistributeAllocation(state.allocation, asset, value),
        })),
      resetAllocation: () => set({ allocation: { ...DEFAULT_ALLOCATION } }),

      strategies: [],
      addStrategy: (s) => set((state) => ({ strategies: [s, ...state.strategies].slice(0, 20) })),
      updateStrategy: (index, s) => set((state) => ({ strategies: state.strategies.map((st, i) => i === index ? s : st) })),
      deleteStrategy: (index) => set((state) => ({ strategies: state.strategies.filter((_, i) => i !== index) })),

      battleRecords: [],
      addBattleRecord: (r) => set((state) => ({ battleRecords: [r, ...state.battleRecords].slice(0, 20) })),

      longtermPortfolio: null,
      setLongtermPortfolio: (p) => set({ longtermPortfolio: p }),
    }),
    {
      name: "cmiyc-game-store",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        playerName: state.playerName,
        unlockedAssets: state.unlockedAssets,
        strategies: state.strategies,
        battleRecords: state.battleRecords,
        longtermPortfolio: state.longtermPortfolio,
      }),
    },
  ),
);
