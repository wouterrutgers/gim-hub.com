import { type ReactElement, Fragment, memo, useContext, useEffect, useRef, useState } from "react";
import { SearchElement } from "../search-element/search-element";
import type * as Member from "../../game/member";
import { GameDataContext } from "../../context/game-data-context";
import { type ItemID, mappedGEPrice } from "../../game/items";
import { GroupItemsContext, GroupMemberNamesContext } from "../../context/group-context";
import { Link } from "react-router-dom";
import { useItemsPriceTooltip } from "./items-page-tooltip";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCachedImages } from "../../hooks/use-cached-images";
import { CachedImage } from "../cached-image/cached-image";

import "./items-page.css";

type ItemFilter = "All" | Member.Name;
const ItemSortCategory = [
  "Total quantity",
  "HA total value",
  "HA unit value",
  "GE total price",
  "GE unit price",
  "Alphabetical",
] as const;
type ItemSortCategory = (typeof ItemSortCategory)[number];

interface ItemPanelProps {
  itemName: string;
  itemID: ItemID;
  highAlchPer: number;
  gePricePer: number;
  imageURL: string;
  totalQuantity: number;
  memberFilter: ItemFilter;
  quantities: Map<Member.Name, number>;
}

// Memo works well here since all the props are primitives, except for
// `quantities` for which we guarantee referential stability in
// group-context.ts.
const ItemPanel = memo(
  ({
    itemName,
    itemID,
    highAlchPer,
    gePricePer,
    imageURL,
    totalQuantity,
    memberFilter,
    quantities,
  }: ItemPanelProps): ReactElement => {
    const { tooltipElement, hideTooltip, showTooltip } = useItemsPriceTooltip();

    const quantityBreakdown = [...quantities]
      .filter(([name]) => memberFilter === "All" || name === memberFilter)
      .map(([name, quantity]: [Member.Name, number]) => {
        const quantityPercent = (quantity / totalQuantity) * 100;
        return (
          <Fragment key={name}>
            <span>{name}</span>
            <span>{quantity.toLocaleString()}</span>
            <span
              className="items-page-panel-quantity-contribution"
              style={{ transform: `scaleX(${quantityPercent}%)`, background: `hsl(${quantityPercent}, 100%, 40%)` }}
            />
          </Fragment>
        );
      });

    const highAlch = highAlchPer * totalQuantity;
    const gePrice = gePricePer * totalQuantity;

    const wikiLink = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${itemID}`;

    return (
      <div className="items-page-panel rsborder rsbackground">
        <div className="items-page-panel-top rsborder-tiny">
          <div>
            <Link className="items-page-panel-name rstext" to={wikiLink} target="_blank" rel="noopener noreferrer">
              {itemName}
            </Link>
            <div className="items-page-panel-item-details">
              <span>Quantity</span>
              <span>{totalQuantity.toLocaleString()}</span>
              <span>High alch</span>
              <span
                onPointerEnter={() =>
                  showTooltip({
                    perPiecePrice: highAlchPer,
                    totalPrice: highAlch,
                    quantity: totalQuantity,
                  })
                }
                onPointerLeave={hideTooltip}
              >
                {highAlch.toLocaleString()}gp
              </span>
              <span>GE price</span>
              <span
                onPointerEnter={() =>
                  showTooltip({
                    perPiecePrice: gePricePer,
                    totalPrice: gePrice,
                    quantity: totalQuantity,
                  })
                }
                onPointerLeave={hideTooltip}
              >
                {gePrice.toLocaleString()}gp
              </span>
            </div>
          </div>
          <CachedImage
            loading="lazy"
            className="items-page-panel-icon"
            alt={itemName ?? "An unknown item"}
            src={imageURL}
          />
        </div>
        <div className="items-page-panel-quantity-breakdown">{quantityBreakdown}</div>
        {tooltipElement}
      </div>
    );
  },
);

interface FilteredItem {
  itemID: ItemID;
  itemName: string;
  imageURL: string;
  quantityByMemberName: Map<Member.Name, number>;
  totalQuantity: number;
  gePrice: number;
  highAlch: number;
}

// css width + gap
const PANEL_WIDTH_PIXELS = 280 + 16;

const ItemPanelsScrollArea = ({
  sortedItems,
  memberFilter,
}: {
  sortedItems: FilteredItem[];
  memberFilter: ItemFilter;
}): ReactElement => {
  const parentRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);
  const itemsVirtualizer = useVirtualizer({
    count: Math.ceil(sortedItems.length / columns),
    getScrollElement: () => parentRef.current,
    overscan: 3,
    estimateSize: () => 220,
    gap: 16,
  });

  useEffect(() => {
    const updateColumnsFromDivWidth = (): void => {
      const newColumns = Math.floor((childRef.current?.scrollWidth ?? 0) / PANEL_WIDTH_PIXELS);
      if (newColumns < 1) {
        setColumns(1);
        return;
      }

      setColumns(newColumns);
    };
    window.addEventListener("resize", updateColumnsFromDivWidth);

    updateColumnsFromDivWidth();

    return (): void => {
      window.removeEventListener("resize", updateColumnsFromDivWidth);
    };
  }, []);

  return (
    <div ref={parentRef} style={{ overflowY: "auto" }}>
      <div
        ref={childRef}
        style={{ height: `${itemsVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}
      >
        {itemsVirtualizer.getVirtualItems().map((rowOfItems) => {
          const items = sortedItems.slice(rowOfItems.index * columns, (rowOfItems.index + 1) * columns);

          return (
            <div
              key={rowOfItems.key}
              data-index={rowOfItems.index}
              ref={itemsVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${rowOfItems.start - itemsVirtualizer.options.scrollMargin}px)`,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {items.map((item) => (
                <ItemPanel
                  key={item.itemID}
                  itemID={item.itemID}
                  imageURL={item.imageURL}
                  totalQuantity={item.totalQuantity}
                  highAlchPer={item.highAlch}
                  gePricePer={item.gePrice}
                  itemName={item.itemName}
                  memberFilter={memberFilter}
                  quantities={item.quantityByMemberName}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ItemsPage = (): ReactElement => {
  const [filter, setFilter] = useState<ItemFilter>("All");
  const [searchString, setSearchString] = useState<string>("");
  const [sortCategory, setSortCategory] = useState<ItemSortCategory>("GE unit price");
  const { gePrices: geData, items: itemData } = useContext(GameDataContext);
  const { getItemIconUrl } = useCachedImages();

  const members = useContext(GroupMemberNamesContext);
  const items = useContext(GroupItemsContext);

  interface ItemAggregates {
    totalHighAlch: number;
    totalGEPrice: number;
    filteredItems: FilteredItem[];
  }
  const { totalHighAlch, totalGEPrice, filteredItems } = [...(items ?? [])].reduce<ItemAggregates>(
    (previousValue, [itemID, quantityByMemberName]) => {
      const itemDatum = itemData?.get(itemID);
      if (!itemDatum?.name.toLocaleLowerCase().includes(searchString)) return previousValue;

      let filteredTotalQuantity = 0;
      quantityByMemberName.forEach((quantity, name) => {
        if (filter !== "All" && filter !== name) return;

        filteredTotalQuantity += quantity;
      });

      if (filteredTotalQuantity <= 0) return previousValue;

      const highAlch = itemDatum?.highalch ?? 0;
      const gePrice = mappedGEPrice(itemID, geData, itemData);
      previousValue.totalHighAlch += filteredTotalQuantity * highAlch;
      previousValue.totalGEPrice += filteredTotalQuantity * gePrice;

      previousValue.filteredItems.push({
        itemID,
        itemName: itemDatum?.name ?? "@UNKNOWN",
        quantityByMemberName: quantityByMemberName,
        totalQuantity: filteredTotalQuantity,
        gePrice,
        highAlch,
        imageURL: getItemIconUrl({ itemID, quantity: filteredTotalQuantity }, itemDatum),
      });

      return previousValue;
    },
    { totalHighAlch: 0, totalGEPrice: 0, filteredItems: [] },
  );

  const sortedItems = [...filteredItems].sort((lhs, rhs) => {
    switch (sortCategory) {
      case "Total quantity":
        return rhs.totalQuantity - lhs.totalQuantity;
      case "HA total value":
        return rhs.highAlch * rhs.totalQuantity - lhs.highAlch * lhs.totalQuantity;
      case "HA unit value":
        return rhs.highAlch - lhs.highAlch;
      case "GE total price":
        return rhs.gePrice * rhs.totalQuantity - lhs.gePrice * lhs.totalQuantity;
      case "GE unit price":
        return rhs.gePrice - lhs.gePrice;
      case "Alphabetical":
        return lhs.itemName.localeCompare(rhs.itemName);
    }
  });

  if ((items?.size ?? 0) <= 0) {
    return (
      <div id="items-page-no-items" className="rsborder rsbackground">
        <h3>Your group has no recorded items!</h3>
        <p>
          Either no members have logged in with the plugin, or there is an issue. Please double check that the names in
          the{" "}
          <Link to="../settings" className="orange-link">
            settings
          </Link>{" "}
          page <span className="emphasize">exactly</span> match your group members' in-game display names.
        </p>
      </div>
    );
  }

  return (
    <>
      <div id="items-page-head">
        <SearchElement
          onChange={(string) => setSearchString(string.toLocaleLowerCase())}
          id="items-page-search"
          placeholder="Search"
          auto-focus
        />
      </div>
      <div id="items-page-utility">
        <div className="rsborder-tiny rsbackground rsbackground-hover">
          <select
            value={sortCategory}
            onChange={(e) => {
              setSortCategory(e.target.value as ItemSortCategory);
            }}
          >
            {ItemSortCategory.map((category) => (
              <option key={category} value={category}>
                Sort: {category}
              </option>
            ))}
          </select>
        </div>
        <div className="rsborder-tiny rsbackground rsbackground-hover">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as ItemFilter);
            }}
          >
            {["All", ...members].map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <span className="rsborder-tiny rsbackground rsbackground-hover">
          <span>{filteredItems.length.toLocaleString()}</span>&nbsp;
          <span>items</span>
        </span>
        <span className="rsborder-tiny rsbackground rsbackground-hover">
          HA:&nbsp;<span>{totalHighAlch.toLocaleString()}</span>
          <span>gp</span>
        </span>
        <span className="rsborder-tiny rsbackground rsbackground-hover">
          GE:&nbsp;<span>{totalGEPrice.toLocaleString()}</span>
          <span>gp</span>
        </span>
      </div>
      <ItemPanelsScrollArea sortedItems={sortedItems} memberFilter={filter} />
    </>
  );
};
