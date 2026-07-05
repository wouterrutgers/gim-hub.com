import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Member from "../game/member";
import { Context as APIContext } from "./api-context";
import { GroupMemberStatesContext } from "./group-context";
import { SettingsContext } from "./settings-context";
import { type PlayerSnapshot, loadSnapshot, saveSnapshot, snapshotFromMemberState } from "../hooks/player-snapshot";

interface SnapshotContextValue {
  getBaselineSnapshot: (playerName: Member.Name) => PlayerSnapshot | undefined;
  clearBaselineSnapshot: (playerName: Member.Name) => void;
}

export const SnapshotContext = createContext<SnapshotContextValue>({
  getBaselineSnapshot: () => undefined,
  clearBaselineSnapshot: () => undefined,
});

export const snapshotIntervalToMs = (minutes: string): number => Math.max(0, Number(minutes)) * 60 * 1000;

/**
 * Manages player data snapshots in localStorage.
 *
 * On each session, when live player data first arrives:
 * - If a stored snapshot exists and is older than the configured interval,
 *   it becomes the "baseline" for recent activity and a fresh snapshot is saved.
 * - If no stored snapshot exists, a fresh snapshot is saved (no activity yet).
 * - If a stored snapshot exists but is too recent, it is left unchanged.
 */
export const SnapshotProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const apiContext = useContext(APIContext);
  const memberStates = useContext(GroupMemberStatesContext);
  const { snapshotIntervalMinutes } = useContext(SettingsContext);

  // Baseline snapshots: loaded at session start for each member, locked for the session.
  const [baselineSnapshots, setBaselineSnapshots] = useState<Map<Member.Name, PlayerSnapshot>>(new Map());

  // Tracks members whose snapshot has already been handled this session.
  const handledMembersRef = useRef<Set<Member.Name>>(new Set());

  const api = apiContext?.api;

  // Reset when the API changes (new login / logout).
  useEffect(() => {
    setBaselineSnapshots(new Map());
    handledMembersRef.current = new Set();
  }, [api]);

  useEffect(() => {
    if (!api) return;

    const groupName = api.getCredentials().name;
    const intervalMs = snapshotIntervalToMs(snapshotIntervalMinutes);
    const now = Date.now();

    let baselineChanged = false;
    const newBaselines = new Map(baselineSnapshots);

    for (const [memberName, state] of memberStates) {
      if (handledMembersRef.current.has(memberName)) continue;
      handledMembersRef.current.add(memberName);

      const existing = loadSnapshot(groupName, memberName);

      const saveFreshWithHiscores = (fresh: PlayerSnapshot): void => {
        saveSnapshot(groupName, memberName, fresh);
        api
          .fetchMemberHiscores(memberName)
          .then((hiscores) => {
            const bossKc: Record<string, number> = Object.fromEntries(hiscores);
            const stored = loadSnapshot(groupName, memberName);
            if (stored && stored.timestamp === fresh.timestamp) {
              saveSnapshot(groupName, memberName, { ...stored, bossKc });
            }
          })
          .catch(() => {
            /* hiscores unavailable — bossKc stays absent */
          });
      };

      if (existing && now - existing.timestamp >= intervalMs) {
        newBaselines.set(memberName, existing);
        baselineChanged = true;
        saveFreshWithHiscores({ timestamp: now, ...snapshotFromMemberState(state) });
      } else if (!existing) {
        saveFreshWithHiscores({ timestamp: now, ...snapshotFromMemberState(state) });
      }
    }

    if (baselineChanged) {
      setBaselineSnapshots(newBaselines);
    }
  }, [memberStates, api]);

  const getBaselineSnapshot = (playerName: Member.Name): PlayerSnapshot | undefined =>
    baselineSnapshots.get(playerName);

  const clearBaselineSnapshot = useCallback(
    (playerName: Member.Name): void => {
      const currentState = memberStates.get(playerName);
      if (api && currentState) {
        const groupName = api.getCredentials().name;
        const fresh: PlayerSnapshot = {
          timestamp: Date.now(),
          ...snapshotFromMemberState(currentState),
        };
        saveSnapshot(groupName, playerName, fresh);
        api
          .fetchMemberHiscores(playerName)
          .then((hiscores) => {
            const bossKc: Record<string, number> = Object.fromEntries(hiscores);
            const stored = loadSnapshot(groupName, playerName);
            if (stored && stored.timestamp === fresh.timestamp) {
              saveSnapshot(groupName, playerName, { ...stored, bossKc });
            }
          })
          .catch(() => {
            /* hiscores unavailable — bossKc stays absent */
          });
      }

      setBaselineSnapshots((prev) => {
        if (!prev.has(playerName)) return prev;
        const next = new Map(prev);
        next.delete(playerName);
        return next;
      });
    },
    [api, memberStates],
  );

  return <SnapshotContext value={{ getBaselineSnapshot, clearBaselineSnapshot }}>{children}</SnapshotContext>;
};
