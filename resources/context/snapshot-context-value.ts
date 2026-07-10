import { createContext } from "react";
import type * as Member from "../game/member";
import type { PlayerSnapshot } from "../hooks/player-snapshot";

export type SnapshotView = "lastVisit" | "lastWeek";

export interface SnapshotBaseline {
  snapshot: PlayerSnapshot;
  view: SnapshotView;
  hasSeenMarker: boolean;
}

interface SnapshotContextValue {
  getBaselineSnapshot: (playerName: Member.Name, view?: SnapshotView) => SnapshotBaseline | undefined;
  clearBaselineSnapshot: (playerName: Member.Name) => Promise<void>;
}

export const SnapshotContext = createContext<SnapshotContextValue>({
  getBaselineSnapshot: () => undefined,
  clearBaselineSnapshot: () => Promise.reject(new Error("Snapshot provider is unavailable.")),
});
