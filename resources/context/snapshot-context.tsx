import { type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Member from "../game/member";
import { Context as APIContext } from "./api-context";
import { SnapshotContext, type SnapshotBaseline, type SnapshotView } from "./snapshot-context-value";
import type { MemberSnapshotBaselines, SnapshotMarkers } from "../api/requests/player-snapshot";

interface SeenSnapshotState {
  groupName?: string;
  markers: SnapshotMarkers;
}

const snapshotSeenStorageKey = (groupName: string): string => `recent-activity-seen-${groupName}`;

const parseSeenSnapshotMarkers = (value: string | null): SnapshotMarkers => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    const markers: SnapshotMarkers = {};
    for (const [member, timestamp] of Object.entries(parsed)) {
      if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
        markers[member] = timestamp;
      }
    }

    return markers;
  } catch {
    return {};
  }
};

const loadSeenSnapshotMarkers = (storageKey: string): SnapshotMarkers =>
  parseSeenSnapshotMarkers(localStorage.getItem(storageKey));

const saveSeenSnapshotMarkers = (storageKey: string, markers: SnapshotMarkers): void => {
  localStorage.setItem(storageKey, JSON.stringify(markers));
  window.dispatchEvent(new CustomEvent("local-storage", { detail: { key: storageKey } }));
};

/**
 * Manages player data snapshots stored by the group API.
 */
export const SnapshotProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const apiContext = useContext(APIContext);

  const [serverSnapshots, setServerSnapshots] = useState<Map<Member.Name, MemberSnapshotBaselines>>();
  const [seenSnapshotState, setSeenSnapshotState] = useState<SeenSnapshotState>({ markers: {} });
  const [collectionLogsLoaded, setCollectionLogsLoaded] = useState(false);

  const api = apiContext?.api;
  const groupName = api?.getCredentials().name;
  const activeConnection = useRef({ api, groupName });
  activeConnection.current = { api, groupName };

  useEffect(() => {
    if (!groupName) {
      setSeenSnapshotState({ markers: {} });
      return;
    }

    const storageKey = snapshotSeenStorageKey(groupName);
    setSeenSnapshotState({ groupName, markers: loadSeenSnapshotMarkers(storageKey) });

    const handleStorageEvent = (event: CustomEvent | StorageEvent): void => {
      let eventKey: string | undefined = undefined;
      if (event.type === "local-storage") {
        eventKey = (event as CustomEvent<{ key: string }>).detail?.key;
      } else if (event.type === "storage") {
        eventKey = (event as StorageEvent).key ?? undefined;
      }

      if (eventKey === storageKey) {
        setSeenSnapshotState({ groupName, markers: loadSeenSnapshotMarkers(storageKey) });
      }
    };

    window.addEventListener("local-storage", handleStorageEvent);
    window.addEventListener("storage", handleStorageEvent);

    return (): void => {
      window.removeEventListener("local-storage", handleStorageEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [groupName]);

  // Reset when the API changes (new login / logout).
  useEffect(() => {
    setServerSnapshots(undefined);
    setCollectionLogsLoaded(false);
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    if (!api || !groupName || seenSnapshotState.groupName !== groupName) return;

    api
      .fetchMemberSnapshots(seenSnapshotState.markers)
      .then((snapshots) => {
        if (cancelled) return;
        setServerSnapshots(snapshots);
      })
      .catch((reason) => {
        console.error("Failed to fetch member snapshots", reason);
        if (cancelled) return;
        setServerSnapshots((snapshots) => snapshots ?? new Map());
      });

    return (): void => {
      cancelled = true;
    };
  }, [api, groupName, seenSnapshotState]);

  useEffect(() => {
    let cancelled = false;

    if (!api) return;

    const collectionLogsPromise = api.fetchGroupCollectionLogs?.() ?? Promise.resolve();
    collectionLogsPromise
      .catch((reason) => console.error("Failed to fetch collection logs", reason))
      .finally(() => {
        if (cancelled) return;
        setCollectionLogsLoaded(true);
      });

    return (): void => {
      cancelled = true;
    };
  }, [api]);

  const getBaselineSnapshot = useCallback(
    (playerName: Member.Name, view: SnapshotView = "lastVisit"): SnapshotBaseline | undefined => {
      if (!serverSnapshots || !collectionLogsLoaded) return undefined;

      const baselines = serverSnapshots.get(playerName);
      if (!baselines) return undefined;

      return {
        snapshot: baselines[view],
        view,
        hasSeenMarker: seenSnapshotState.groupName === groupName && seenSnapshotState.markers[playerName] !== undefined,
      };
    },
    [collectionLogsLoaded, groupName, seenSnapshotState, serverSnapshots],
  );

  const clearBaselineSnapshot = useCallback(
    async (playerName: Member.Name): Promise<void> => {
      if (!api || !groupName) {
        throw new Error("No active API connection.");
      }

      const snapshotApi = api;
      const snapshotGroupName = groupName;
      const snapshot = await snapshotApi.createMemberSnapshot(playerName);
      const storageKey = snapshotSeenStorageKey(snapshotGroupName);
      const markers = { ...loadSeenSnapshotMarkers(storageKey), [playerName]: snapshot.timestamp };
      saveSeenSnapshotMarkers(storageKey, markers);

      if (activeConnection.current.api !== snapshotApi || activeConnection.current.groupName !== snapshotGroupName) {
        return;
      }

      setServerSnapshots((previousSnapshots) => {
        const nextSnapshots = new Map(previousSnapshots);
        const previousBaselines = previousSnapshots?.get(playerName);
        nextSnapshots.set(playerName, {
          lastVisit: snapshot,
          lastWeek: previousBaselines?.lastWeek ?? snapshot,
        });
        return nextSnapshots;
      });

      setSeenSnapshotState({ groupName: snapshotGroupName, markers });
    },
    [api, groupName],
  );

  return <SnapshotContext value={{ getBaselineSnapshot, clearBaselineSnapshot }}>{children}</SnapshotContext>;
};
