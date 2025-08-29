import { useCallback, useState, type ReactElement } from "react";
import { PlayerSkills } from "./player-skills";
import { PlayerInventory } from "./player-inventory";
import { PlayerEquipment } from "./player-equipment";
import { PlayerStats } from "./player-stats";
import { PlayerQuests } from "./player-quests";
import { PlayerDiaries } from "./player-diaries";
import * as Member from "../../game/member";
import { useModal } from "../modal/modal";
import { CollectionLogWindow } from "../collection-log/collection-log";
import { useCachedImages } from "../../hooks/use-cached-images";
import { CachedImage } from "../cached-image/cached-image";

import "./player-panel.css";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PlayerPanelSubcategories = ["Inventory", "Equipment", "Skills", "Quests", "Diaries", "Collection Log"] as const;
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

export const PlayerPanel = ({ member }: { member: Member.Name }): ReactElement => {
  const [subcategory, setSubcategory] = useState<PlayerPanelSubcategory>();
  const { open: openCollectionLogModal, modal: collectionLogModal } = useModal(CollectionLogWindow);
  const { getUIImageUrl, getIconUrl } = useCachedImages();

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
        src: getUIImageUrl("777-0.png"),
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
        src: getUIImageUrl("778-0.png"),
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
        src: getUIImageUrl("3579-0.png"),
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
        src: getUIImageUrl("776-0.png"),
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
        src: getUIImageUrl("1298-0.png"),
        width: 22,
        height: 22,
        onClick: (): void => {
          toggleCategory("Diaries");
        },
      },
      {
        category: "Collection Log",
        ariaLabel: "collection-log",
        alt: "osrs collection log",
        src: getIconUrl("items/22711.webp"),
        width: 32,
        height: 32,
        class: "player-panel-collection-log",
        onClick: (): void => {
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
      onClick={props.onClick}
    >
      <CachedImage alt={props.alt} src={props.src} width={props.width} height={props.height} />
    </button>
  ));

  let content = undefined;
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

  return (
    <>
      {collectionLogModal}
      <div className={`player-panel rsborder rsbackground ${content !== undefined ? "expanded" : ""}`}>
        <PlayerStats member={member} />
        <div className="player-panel-minibar">{buttons}</div>
        <div className="player-panel-content">{content}</div>
      </div>
    </>
  );
};
