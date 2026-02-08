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
import mappings from "./mappings.json";

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
        src={`/item-icons/${itemID}.webp`}
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

  const map: Record<string, string | { label: string; lookupKey: string }[]> = mappings;

  const entry = map[pageName];
  if (entry === "kills") {
    return [kills(pageName)];
  }

  if (typeof entry === "string") {
    return [];
  }

  return entry;
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
  const [hiscoresError, setHiscoresError] = useState<string>();

  const groupCollections = useContext(GroupCollectionsContext);

  useEffect(() => {
    fetchGroupCollectionLogs?.().catch((err) => console.error("Failed to fetch collection logs", err));
  }, [fetchGroupCollectionLogs]);

  useEffect(() => {
    if (!fetchMemberHiscores) return;
    fetchMemberHiscores(player)
      .then((map) => {
        setHiscores(map);
        setHiscoresError(undefined);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unknown error";
        setHiscoresError(message);
        setHiscores(new Map<string, number>());

        console.warn(`Failed to get hiscores for '${player}': `, message);
      });
  }, [fetchMemberHiscores, player]);

  useEffect(() => {
    if (!import.meta.env.DEV || !collectionLogInfo) return;

    console.groupCollapsed("Collection log mappings");
    collectionLogInfo.tabs.forEach((pages) => {
      pages.forEach((page) => {
        buildCompletionLines(page.name);
      });
    });
    console.groupEnd();
  }, [collectionLogInfo]);

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
      {hiscoresError && (
        <div className="collection-log-error" role="alert">
          {hiscoresError === "User was not found in the hiscores" ? (
            <>User {player} was not found in the hiscores.</>
          ) : (
            <>
              Hiscores unavailable for {player}: {hiscoresError}
            </>
          )}
        </div>
      )}
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
