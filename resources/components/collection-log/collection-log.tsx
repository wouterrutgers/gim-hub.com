import { Fragment, useContext, useState, type ReactElement } from "react";
import { GameDataContext } from "../../context/game-data-context";
import * as CollectionLog from "../../game/collection-log";
import type * as Member from "../../game/member";
import { useCollectionLogItemTooltip } from "./collection-log-tooltip";
import { PlayerIcon } from "../player-icon/player-icon";
import type { ItemID } from "../../game/items";
import { CachedImage } from "../cached-image/cached-image";

import "./collection-log.css";

interface CollectionLogPageItemProps {
  items: { item: ItemID; quantity: number; otherMembers: { name: Member.Name; quantity: number }[] }[];
}
const CollectionLogPageItems = ({ items }: CollectionLogPageItemProps): ReactElement => {
  const { tooltipElement, showTooltip, hideTooltip } = useCollectionLogItemTooltip();
  const { items: itemDatabase } = useContext(GameDataContext);

  const itemElements = items.map(({ item: itemID, quantity, otherMembers }) => {
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
        key={itemID}
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
  completions: { count: number; label: string }[];
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
      {label}: <span className="collection-log-page-completion-quantity">{count}</span>
      <br />
    </Fragment>
  ));

  let classNameCompletion = "collection-log-page-obtained-none";
  if (obtained >= obtainedPossible) classNameCompletion = "collection-log-page-obtained-all";
  else if (obtained > 0) classNameCompletion = "collection-log-page-obtained-some";

  return (
    <>
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
    </>
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

/**
 * Display a single member's collection log.
 */
export const CollectionLogWindow = ({
  player,
  collections,
  onCloseModal,
}: {
  player: Member.Name;
  collections: Map<Member.Name, Member.Collection>;
  onCloseModal: () => void;
}): ReactElement => {
  // TODO: display entire group's collection, but only focused on one.
  const { collectionLogInfo } = useContext(GameDataContext);
  const [currentTabName, setCurrentTabName] = useState<CollectionLog.TabName>("Bosses");
  const [pageIndex, setPageIndex] = useState<number>(0);

  const collection = collections.get(player);
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

  const totalCollected = collection?.obtainedItems.size ?? 0;

  const pageDirectory = [collectionLogInfo?.tabs.get(currentTabName) ?? []].map((pages) =>
    pages.map(({ name: pageName, items: pageItems }, index) => {
      const pageUniqueSlots = pageItems.length;

      let pageUnlockedSlots = 0;
      pageItems.forEach((itemID) => {
        const obtainedCount = collection?.obtainedItems.get(CollectionLog.deduplicateItemID(itemID)) ?? 0;
        const hasItem = obtainedCount > 0;
        if (hasItem) pageUnlockedSlots += 1;
      });

      let classNameCompletion = "collection-log-page-directory-page-none";
      if (pageUnlockedSlots >= pageUniqueSlots) classNameCompletion = "collection-log-page-directory-page-all";
      else if (pageUnlockedSlots > 0) classNameCompletion = "collection-log-page-directory-page-some";

      return (
        <button
          className={`collection-log-page-directory-page ${classNameCompletion}`}
          onClick={() => setPageIndex(index)}
          key={pageName}
        >
          {`${pageName}`}
          <span>
            {pageUnlockedSlots} / {pageUniqueSlots}
          </span>
        </button>
      );
    }),
  );

  let pageElement = undefined;
  const page = collectionLogInfo?.tabs.get(currentTabName)?.at(pageIndex);
  if (page) {
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

    page.completionLabels.forEach((label, index) => {
      const count = collection?.pageStats.get(page.name)?.completions.at(index) ?? 0;
      headerProps.completions.push({ label, count });
    });

    page.items.forEach((itemID) => {
      const deduplicateItemID = CollectionLog.deduplicateItemID(itemID);
      const quantity = collection?.obtainedItems.get(deduplicateItemID) ?? 0;

      if (quantity > 0) headerProps.obtained += 1;

      itemsProps.items.push({
        item: itemID,
        quantity: quantity,
        otherMembers: [
          ...collections
            .entries()
            .filter(([member]) => member !== player)
            .map(([name, collection]) => ({
              name,
              quantity: collection.obtainedItems.get(deduplicateItemID) ?? 0,
            }))
            .filter(({ quantity }) => quantity > 0),
        ],
      });
    });

    pageElement = (
      <>
        <CollectionLogPageHeader {...headerProps} />
        <CollectionLogPageItems {...itemsProps} />
      </>
    );
  }

  return (
    <div className="collection-log-container dialog-container metal-border rsbackground">
      <div className="collection-log-header">
        <h1 className="collection-log-title">
          {player}'s collection log - {totalCollected} / {collectionLogInfo?.uniqueSlots ?? 0}
        </h1>
        <button className="collection-log-close dialog__close" onClick={onCloseModal}>
          <CachedImage src="/ui/1731-0.png" alt="Close dialog" title="Close dialog" />
        </button>
      </div>
      <div className="collection-log-title-border" />
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
