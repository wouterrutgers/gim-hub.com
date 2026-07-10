import { createContext } from "react";
import type { GameData } from "../api/api";
import { useContext, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Context as APIContext } from "./api-context";

/* oxlint-disable react/only-export-components */

/**
 * Provides static game data for OSRS such as quests, diaries, item
 * metadata, and more.
 */
export const GameDataContext = createContext<GameData>({});

/* oxlint-enable react/only-export-components */

/**
 * The provider for {@link GameDataContext}.
 */
export const GameDataProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [gameData, setGameData] = useState<GameData>({});
  const { setUpdateCallbacks } = useContext(APIContext)?.api ?? {};

  useEffect(() => {
    if (!setUpdateCallbacks) return;

    setUpdateCallbacks({
      onGameDataUpdate: (gameData) => setGameData(structuredClone(gameData)),
    });
  }, [setUpdateCallbacks]);

  return <GameDataContext value={gameData}>{children}</GameDataContext>;
};
