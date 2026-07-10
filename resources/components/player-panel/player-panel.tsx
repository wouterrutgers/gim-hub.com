import { useCallback, useContext, useEffect, useState, type ReactElement } from "react";
import { Context as APIContext } from "../../context/api-context";
import { GroupMemberStatesContext } from "../../context/group-context";
import { SettingsContext } from "../../context/settings-context";
import { SnapshotContext } from "../../context/snapshot-context-value";
import * as Member from "../../game/member";
import { activityHasChanges, computeActivity, type PlayerActivity } from "../../hooks/player-snapshot";
import { CachedImage } from "../cached-image/cached-image";
import { BOSS_KC_KEYS } from "../collection-log/boss-kc";
import { CollectionLogWindow } from "../collection-log/collection-log";
import { useModal } from "../modal/modal";
import { PlayerActivityWindow } from "../player-activity/player-activity";
import { PlayerDiaries } from "./player-diaries";
import { PlayerEquipment } from "./player-equipment";
import { PlayerInventory } from "./player-inventory";
import { PlayerQuests } from "./player-quests";
import { PlayerSkills } from "./player-skills";
import { PlayerStats, PlayerStatsPlaceholder } from "./player-stats";

import "./player-panel.css";

// oxlint-disable-next-line no-unused-vars
const PlayerPanelSubcategories = ["Inventory", "Equipment", "Skills", "Quests", "Diaries", "Collection log"] as const;
type PlayerPanelSubcategory = (typeof PlayerPanelSubcategories)[number];

interface PlayerPanelButtonProps {
  category: PlayerPanelSubcategory;
  ariaLabel: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  class?: string;
  onClick: () => void;
}

export const PlayerPanel = ({ member }: { member?: Member.Name }): ReactElement => {
  const [subcategory, setSubcategory] = useState<PlayerPanelSubcategory>();
  const { open: openCollectionLogModal, modal: collectionLogModal } = useModal(CollectionLogWindow);

  const [readActivity, setReadActivity] = useState<PlayerActivity>();
  const [clearingActivity, setClearingActivity] = useState(false);
  const [clearActivityError, setClearActivityError] = useState<string>();
  const { open: openActivityModal, modal: activityModal } = useModal(PlayerActivityWindow);

  const { getBaselineSnapshot, clearBaselineSnapshot } = useContext(SnapshotContext);
  const memberStates = useContext(GroupMemberStatesContext);
  const { enableRecentActivity } = useContext(SettingsContext);
  const { fetchMemberHiscores } = useContext(APIContext)?.api ?? {};

  const baseline = member ? getBaselineSnapshot(member) : undefined;
  const baselineSnapshot = baseline?.snapshot;
  const baselineBossKc = baselineSnapshot?.bossKc;
  const currentState = member ? memberStates.get(member) : undefined;
  const activity = baselineSnapshot && currentState ? computeActivity(baselineSnapshot, currentState) : undefined;
  const hasActivity = activity ? activityHasChanges(activity) : false;

  const [hiscores, setHiscores] = useState<Map<string, number>>();

  useEffect(() => {
    if (!baselineBossKc || !fetchMemberHiscores || !member) return;
    fetchMemberHiscores(member)
      .then(setHiscores)
      .catch(() => setHiscores(new Map()));
  }, [baselineBossKc, fetchMemberHiscores, member]);

  const hasBossKcChanges =
    hiscores !== undefined && baselineBossKc !== undefined
      ? Object.entries(baselineBossKc).some(
          ([key, before]) => BOSS_KC_KEYS.has(key) && (hiscores.get(key) ?? 0) > before,
        )
      : false;

  const isRead = readActivity !== undefined;
  const showActivityRow =
    enableRecentActivity && (isRead || ((hasActivity || hasBossKcChanges) && activity !== undefined));
  const activityToDisplay = readActivity ?? activity;

  const handleClear = useCallback(async (): Promise<void> => {
    if (!member || clearingActivity) return;

    setClearingActivity(true);
    setClearActivityError(undefined);

    try {
      await clearBaselineSnapshot(member);
      setReadActivity(undefined);
    } catch (reason) {
      console.error("Failed to clear recent activity", reason);
      setClearActivityError("Could not clear activity. Please try again.");
      throw reason;
    } finally {
      setClearingActivity(false);
    }
  }, [clearBaselineSnapshot, clearingActivity, member]);

  const toggleCategory = useCallback(
    (newSubcategory: PlayerPanelSubcategory) => {
      const alreadySelected = newSubcategory === subcategory;
      if (alreadySelected) setSubcategory(undefined);
      else setSubcategory(newSubcategory);
    },
    [subcategory],
  );

  const buttons = (
    [
      {
        category: "Inventory",
        ariaLabel: "inventory",
        alt: "osrs inventory",
        src: "/ui/777-0.png",
        width: 26,
        height: 28,
        onClick: (): void => {
          toggleCategory("Inventory");
        },
      },
      {
        category: "Equipment",
        ariaLabel: "equipment",
        alt: "osrs t-posing knight",
        src: "/ui/778-0.png",
        width: 27,
        height: 32,
        onClick: (): void => {
          toggleCategory("Equipment");
        },
      },
      {
        category: "Skills",
        ariaLabel: "skills",
        alt: "osrs skills",
        src: "/ui/3579-0.png",
        width: 23,
        height: 22,
        onClick: (): void => {
          toggleCategory("Skills");
        },
      },
      {
        category: "Quests",
        ariaLabel: "quests",
        alt: "osrs quest",
        src: "/ui/776-0.png",
        width: 22,
        height: 22,
        onClick: (): void => {
          toggleCategory("Quests");
        },
      },
      {
        category: "Diaries",
        ariaLabel: "diaries",
        alt: "osrs diary",
        src: "/ui/1298-0.png",
        width: 22,
        height: 22,
        onClick: (): void => {
          toggleCategory("Diaries");
        },
      },
      {
        category: "Collection log",
        ariaLabel: "collection-log",
        alt: "osrs collection log",
        src: "/item-icons/22711.webp",
        width: 32,
        height: 32,
        class: "player-panel-collection-log",
        onClick: (): void => {
          if (!member) return;
          openCollectionLogModal({ player: member });
        },
      },
    ] satisfies PlayerPanelButtonProps[]
  ).map((props) => (
    <button
      key={props.category}
      className={`${props.category === subcategory ? "player-panel-tab-active" : ""} ${props.class}`}
      aria-label={props.ariaLabel}
      type="button"
      onClick={member && props.onClick}
    >
      <CachedImage alt={props.alt} src={props.src} width={props.width} height={props.height} />
    </button>
  ));

  if (!member) {
    return (
      <div className={`player-panel rsborder rsbackground`}>
        <PlayerStatsPlaceholder />
        <div className="player-panel-minibar">{buttons}</div>
        <div className="player-panel-content"></div>
      </div>
    );
  }

  let content = undefined;
  if (member) {
    switch (subcategory) {
      case "Inventory":
        content = <PlayerInventory member={member} />;
        break;
      case "Equipment":
        content = <PlayerEquipment member={member} />;
        break;
      case "Skills":
        content = <PlayerSkills member={member} />;
        break;
      case "Quests":
        content = <PlayerQuests member={member} />;
        break;
      case "Diaries":
        content = <PlayerDiaries member={member} />;
        break;
    }
  }

  return (
    <>
      {collectionLogModal}
      {activityModal}
      <div className={`player-panel rsborder rsbackground ${content !== undefined ? "expanded" : ""}`}>
        <PlayerStats member={member} />

        {showActivityRow && activityToDisplay && (
          <div className="player-panel-activity">
            <div className="player-panel-activity-row">
              <button
                className="player-panel-activity-btn"
                type="button"
                aria-label="View recent activity"
                disabled={clearingActivity}
                onClick={() => {
                  const frozen = readActivity ?? activity;
                  if (!frozen) return;
                  if (!isRead) setReadActivity(frozen);
                  openActivityModal({
                    player: member,
                    currentHiscores: hiscores,
                    onClearSnapshot: handleClear,
                  });
                }}
              >
                {isRead ? "View recent activity" : "New recent activity!"}
              </button>
              <button
                className="player-panel-activity-clear"
                type="button"
                aria-label={clearingActivity ? "Clearing activity" : "Clear activity"}
                disabled={clearingActivity}
                onClick={() => void handleClear().catch(() => undefined)}
              >
                ✕
              </button>
            </div>
            {clearActivityError && (
              <p className="player-panel-activity-error validation-error" role="alert">
                {clearActivityError}
              </p>
            )}
          </div>
        )}

        <div className="player-panel-minibar">{buttons}</div>
        <div className="player-panel-content">{content}</div>
      </div>
    </>
  );
};
