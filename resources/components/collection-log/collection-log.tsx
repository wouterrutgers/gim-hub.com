import { Fragment, type ReactElement, type ReactNode, useContext, useEffect, useState } from "react";
import { GameDataContext } from "../../context/game-data-context";
import * as CollectionLog from "../../game/collection-log";
import type * as Member from "../../game/member";
import { GroupCollectionsContext } from "../../context/group-context";
import { useCollectionLogItemTooltip } from "./collection-log-tooltip";
import { PlayerIcon } from "../player-icon/player-icon";
import type { ItemID } from "../../game/items";
import { CachedImage } from "../cached-image/cached-image";
import { Context as APIContext } from "../../context/api-context";
import { formatTitle } from "../../ts/format-title";

import "./collection-log.css";

interface CollectionLogPageItemProps {
  items: { item: ItemID; quantity: number; otherMembers: { name: Member.Name; quantity: number }[] }[];
}
const CollectionLogPageItems = ({ items }: CollectionLogPageItemProps): ReactElement => {
  const { tooltipElement, showTooltip, hideTooltip } = useCollectionLogItemTooltip();
  const { items: itemDatabase } = useContext(GameDataContext);

  const itemElements = items.map(({ item: itemID, quantity, otherMembers }, i): ReactElement => {
    const wikiLink = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${itemID}`;
    const itemName = itemDatabase?.get(itemID)?.name;

    const itemImage = (
      <CachedImage
        className={`${quantity === 0 ? "collection-log-page-item-missing" : ""}`}
        alt={itemName ?? "osrs item"}
        src={`/icons/items/${itemID}.webp`}
      />
    );
    const quantityLabel =
      quantity > 0 ? <span className="collection-log-page-item-quantity">{quantity}</span> : undefined;

    const otherMemberHaveItemLabel = (
      <span style={{ position: "absolute", bottom: 0, left: 0 }}>
        {otherMembers
          .filter(({ quantity }) => quantity > 0)
          .map(({ name }) => (
            <PlayerIcon key={name} name={name} />
          ))}
      </span>
    );

    return (
      <a
        key={`${itemID}-${i}`}
        onPointerEnter={() => {
          if (!itemName) {
            hideTooltip();
            return;
          }
          showTooltip({ name: itemName, memberQuantities: otherMembers });
        }}
        onPointerLeave={hideTooltip}
        className="collection-log-page-item"
        href={wikiLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        {itemImage}
        {quantityLabel}
        {otherMemberHaveItemLabel}
      </a>
    );
  });

  return (
    <>
      <div onPointerLeave={hideTooltip} className="collection-log-page-items">
        {itemElements}
        {/* The outer div is rectangular. Thus, when the item grid is not
         *  rectangular, the empty section at the end wouldn't hide the cursor.
         *  So we insert this span, and that hides the cursor.
         */}
        <span onPointerEnter={hideTooltip} style={{ flex: 1 }} />
      </div>
      {tooltipElement}
    </>
  );
};

interface CollectionLogPageHeaderProps {
  name: string;
  wikiLink: URL | undefined;
  obtained: number;
  obtainedPossible: number;
  completions: { count?: number; label: string }[];
}
const CollectionLogPageHeader = ({
  name,
  wikiLink,
  completions,
  obtained,
  obtainedPossible,
}: CollectionLogPageHeaderProps): ReactElement => {
  const completionElements = completions.map(({ count, label }) => (
    <Fragment key={label}>
      {label}:{" "}
      <span
        className={
          count === undefined
            ? "collection-log-page-completion-quantity-loading"
            : "collection-log-page-completion-quantity"
        }
      >
        {count ?? "-"}
      </span>
      <br />
    </Fragment>
  ));

  let classNameCompletion = "collection-log-page-obtained-none";
  if (obtained >= obtainedPossible) classNameCompletion = "collection-log-page-obtained-all";
  else if (obtained > 0) classNameCompletion = "collection-log-page-obtained-some";

  return (
    <div className="collection-log-page-top">
      <h2 className="collection-log-page-name-link">
        <a href={wikiLink?.href ?? ""} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
      </h2>
      Obtained:{" "}
      <span className={classNameCompletion}>
        {obtained}/{obtainedPossible}
      </span>{" "}
      <br />
      {completionElements}
    </div>
  );
};

const ResolvePageWikiLink = ({
  tab,
  page,
}: {
  tab: CollectionLog.TabName;
  page: CollectionLog.PageName;
}): URL | undefined => {
  let urlRaw = `https://oldschool.runescape.wiki/w/Special:Lookup?type=npc&name=${page}`;
  if (tab === "Clues") {
    if (page.startsWith("Shared")) {
      urlRaw = "https://oldschool.runescape.wiki/w/Collection_log#Shared_Treasure_Trail_Rewards";
    } else {
      const difficulty = page.split(" ")[0].toLowerCase();
      urlRaw = `https://oldschool.runescape.wiki/w/Clue_scroll_(${difficulty})`;
    }
  }

  if (!URL.canParse(urlRaw)) return undefined;

  return new URL(urlRaw);
};

const buildCompletionLines = (pageName: string): { label: string; lookupKey: string }[] => {
  const kills = (boss: string, key?: string): { label: string; lookupKey: string } => ({
    label: `${boss} kills`,
    lookupKey: key ?? boss,
  });

  const map: Record<string, { label: string; lookupKey: string }[]> = {
    "Callisto and Artio": [kills("Callisto"), kills("Artio")],
    "Dagannoth Kings": [kills("Dagannoth Rex"), kills("Dagannoth Prime"), kills("Dagannoth Supreme")],
    "Doom of Mokhaiotl": [{ label: "Deep delves", lookupKey: "Doom of Mokhaiotl" }],
    "The Gauntlet": [
      { label: "Gauntlet completion count", lookupKey: "The Gauntlet" },
      { label: "Corrupted Gauntlet completion count", lookupKey: "The Corrupted Gauntlet" },
    ],
    "The Inferno": [kills("TzKal-Zuk")],
    "The Nightmare": [kills("Phosani's Nightmare"), kills("Nightmare")],
    "Venenatis and Spindel": [kills("Venenatis"), kills("Spindel")],
    "Vet'ion and Calvar'ion": [kills("Vet'ion"), kills("Calvar'ion")],
    "Moons of Peril": [{ label: "Lunar Chests opened", lookupKey: "Lunar Chests" }],
    "The Fight Caves": [kills("TzTok-Jad")],
    "Fortis Colosseum": [kills("Sol Heredit")],
    "Royal Titans": [kills("Royal Titans", "The Royal Titans")],

    "Chambers of Xeric": [
      { label: "Chambers of Xeric completions", lookupKey: "Chambers of Xeric" },
      { label: "Chambers of Xeric (CM) completions", lookupKey: "Chambers of Xeric: Challenge Mode" },
    ],
    "Theatre of Blood": [
      { label: "Theatre of Blood completions", lookupKey: "Theatre of Blood" },
      { label: "Theatre of Blood (Hard) completions", lookupKey: "Theatre of Blood: Hard Mode" },
    ],
    "Tombs of Amascut": [
      { label: "Tombs of Amascut completions", lookupKey: "Tombs of Amascut" },
      { label: "Tombs of Amascut (Expert) completions", lookupKey: "Tombs of Amascut: Expert Mode" },
    ],

    "Beginner Treasure Trails": [{ label: "Beginner clues completed", lookupKey: "Clue Scrolls (beginner)" }],
    "Easy Treasure Trails": [{ label: "Easy clues completed", lookupKey: "Clue Scrolls (easy)" }],
    "Medium Treasure Trails": [{ label: "Medium clues completed", lookupKey: "Clue Scrolls (medium)" }],
    "Hard Treasure Trails": [{ label: "Hard clues completed", lookupKey: "Clue Scrolls (hard)" }],
    "Elite Treasure Trails": [{ label: "Elite clues completed", lookupKey: "Clue Scrolls (elite)" }],
    "Master Treasure Trails": [{ label: "Master clues completed", lookupKey: "Clue Scrolls (master)" }],
    "Hard Treasure Trails (Rare)": [{ label: "Hard clues completed", lookupKey: "Clue Scrolls (hard)" }],
    "Elite Treasure Trails (Rare)": [{ label: "Elite clues completed", lookupKey: "Clue Scrolls (elite)" }],
    "Master Treasure Trails (Rare)": [{ label: "Master clues completed", lookupKey: "Clue Scrolls (master)" }],
    "Shared Treasure Trail Rewards": [{ label: "Total clues completed", lookupKey: "Clue Scrolls (all)" }],
    "Scroll Cases": [],

    "Barbarian Assault": [],
    "Brimhaven Agility Arena": [],
    "Castle Wars": [],
    "Fishing Trawler": [],
    "Giants' Foundry": [],
    "Gnome Restaurant": [],
    "Guardians of the Rift": [],
    "Hallowed Sepulchre": [],
    "Last Man Standing": [],
    "Magic Training Arena": [],
    "Mahogany Homes": [],
    "Mastering Mixology": [],
    "Pest Control": [],
    "Rogues' Den": [],
    "Shades of Mort'ton": [],
    "Soul Wars": [],
    "Temple Trekking": [],
    "Tithe Farm": [],
    "Trouble Brewing": [],
    "Vale Totems": [],
    "Volcanic Mine": [],

    "Aerial Fishing": [],
    "All Pets": [],
    Camdozaal: [],
    "Champion's Challenge": [],
    "Chompy Bird Hunting": [],
    "Colossal Wyrm Agility": [],
    "Creature Creation": [],
    Cyclopes: [],
    "Elder Chaos Druids": [],
    Forestry: [],
    "Fossil Island Notes": [],
    "Glough's Experiments": [],
    "Hunter Guild": [],
    "Monkey Backpacks": [],
    "Motherlode Mine": [],
    "My Notes": [],
    "Random Events": [],
    Revenants: [],
    "Rooftop Agility": [],
    "Shayzien Armour": [],
    "Shooting Stars": [],
    "Skilling Pets": [],
    Slayer: [],
    "Tormented Demons": [],
    TzHaar: [],
    Miscellaneous: [],
  };

  return map[pageName] ?? [kills(pageName)];
};

/**
 * Display a single member's collection log.
 */
export const CollectionLogWindow = ({
  player,
  onCloseModal,
}: {
  player: Member.Name;
  onCloseModal: () => void;
}): ReactElement => {
  const { collectionLogInfo } = useContext(GameDataContext);
  const { fetchGroupCollectionLogs, fetchMemberHiscores } = useContext(APIContext)?.api ?? {};
  const [currentTabName, setCurrentTabName] = useState<CollectionLog.TabName>("Bosses");
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [hiscores, setHiscores] = useState<Map<string, number>>();

  const groupCollections = useContext(GroupCollectionsContext);

  useEffect(() => {
    fetchGroupCollectionLogs?.().catch((err) => console.error("Failed to fetch collection logs", err));
  }, [fetchGroupCollectionLogs]);

  useEffect(() => {
    if (!fetchMemberHiscores) return;
    fetchMemberHiscores(player)
      .then((map) => {
        setHiscores(map);
      })
      .catch((err) => console.error("Failed to get hiscores for collection log", err));
  }, [fetchMemberHiscores, player]);

  const collection = groupCollections.get(player);
  const tabButtons = CollectionLog.TabName.map((tab) => (
    <button
      key={tab}
      className={`${tab === currentTabName ? "collection-log-tab-button-active" : ""}`}
      onClick={() => {
        if (tab === currentTabName) return;
        setPageIndex(0);
        setCurrentTabName(tab);
      }}
    >
      {tab}
    </button>
  ));

  const totalCollected = collection?.size ?? 0;

  const pageDirectory: ReactElement[] = (collectionLogInfo?.tabs.get(currentTabName) ?? []).map(
    ({ name: pageName, items: pageItems }, index): ReactElement => {
      const pageUniqueSlots = pageItems.length;

      let pageUnlockedSlots = 0;
      pageItems.forEach((itemID) => {
        const obtainedCount = collection?.get(itemID) ?? 0;
        const hasItem = obtainedCount > 0;
        if (hasItem) pageUnlockedSlots += 1;
      });

      let classNameCompletion = "collection-log-page-directory-page-none";
      if (pageUnlockedSlots >= pageUniqueSlots) classNameCompletion = "collection-log-page-directory-page-all";
      else if (pageUnlockedSlots > 0) classNameCompletion = "collection-log-page-directory-page-some";

      return (
        <button
          className={`collection-log-page-directory-page ${classNameCompletion} ${index === pageIndex ? "collection-log-page-active" : ""}`}
          onClick={() => setPageIndex(index)}
          key={pageName}
        >
          {`${pageName}`}
          <span>
            {pageUnlockedSlots} / {pageUniqueSlots}
          </span>
        </button>
      );
    },
  );

  const pageElement = ((): ReactNode => {
    const page = collectionLogInfo?.tabs.get(currentTabName)?.at(pageIndex);
    if (!page) return undefined;

    const headerProps: CollectionLogPageHeaderProps = {
      name: page.name,
      wikiLink: ResolvePageWikiLink({ page: page.name, tab: currentTabName }),
      completions: [],
      obtained: 0,
      obtainedPossible: page.items.length,
    };
    const itemsProps: CollectionLogPageItemProps = {
      items: [],
    };

    const lookup = (key: string): number => hiscores?.get(key) ?? 0;

    const lines = buildCompletionLines(page.name);
    const isLoadingHiscores = hiscores === undefined;
    for (const { label, lookupKey } of lines) {
      headerProps.completions.push({ label, count: isLoadingHiscores ? undefined : lookup(lookupKey) });
    }

    page.items.forEach((itemID) => {
      const quantity: number = collection?.get(itemID) ?? 0;

      if (quantity > 0) {
        headerProps.obtained += 1;
      }

      const otherMembers = [];
      for (const [otherMember, otherCollection] of groupCollections) {
        if (otherMember === player) continue;

        const quantity = otherCollection.get(itemID) ?? 0;
        if (quantity <= 0) continue;

        otherMembers.push({
          name: otherMember,
          quantity: quantity,
        });
      }

      itemsProps.items.push({
        item: itemID,
        quantity: quantity,
        otherMembers,
      });
    });

    return (
      <>
        <CollectionLogPageHeader {...headerProps} />
        <CollectionLogPageItems {...itemsProps} />
      </>
    );
  })();

  return (
    <div className="collection-log-container dialog-container metal-border rsbackground">
      <div className="collection-log-header">
        <h1 className="collection-log-title">
          {formatTitle(`${player}'s collection log`)} - {totalCollected} / {collectionLogInfo?.uniqueSlots ?? 0}
        </h1>
        <button className="collection-log-close dialog__close" onClick={onCloseModal}>
          <CachedImage src="/ui/1731-0.png" alt="Close dialog" title="Close dialog" />
        </button>
      </div>
      <div className="collection-log-title-border" />
      <div className="collection-log-warning">
        Collection log is temporarily unavailable. This will become functional again once the RuneLite plugin update is
        approved.
      </div>
      <div className="collection-log-main">
        <div className="collection-log-tab-buttons">{tabButtons}</div>
        <div className="collection-log-tab-container">
          <div className="collection-log-tab-list">{pageDirectory}</div>
          <div className="collection-log-page-container">{pageElement}</div>
        </div>
      </div>
    </div>
  );
};
