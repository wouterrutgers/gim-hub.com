import {
  type ReactElement,
  Fragment,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { SearchElement } from "../search-element/search-element";
import * as Member from "../../game/member";
import { GameDataContext } from "../../context/game-data-context";
import { type ItemID, mappedGEPrice, composeItemIconHref } from "../../game/items";
import { GroupItemsContext, GroupMemberNamesContext } from "../../context/group-context";
import { Link } from "react-router-dom";
import { useItemsPriceTooltip } from "./items-page-tooltip";
import { useItemsBreakdownTooltip } from "./items-breakdown-tooltip";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CachedImage } from "../cached-image/cached-image";
import { formatTitle } from "../../ts/format-title";
import { useLocalStorage } from "../../hooks/local-storage";

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
  containerFilter: Member.ItemContainer | "All";
  quantities: Map<Member.Name, Member.ItemLocationBreakdown>;
  isPinned: boolean;
  onTogglePin: (itemID: ItemID) => void;
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
    containerFilter,
    quantities,
    isPinned,
    onTogglePin,
  }: ItemPanelProps): ReactElement => {
    const { tooltipElement, hideTooltip, showTooltip } = useItemsPriceTooltip();
    const {
      tooltipElement: breakdownTooltip,
      hideTooltip: hideBreakdownTooltip,
      showTooltip: showBreakdownTooltip,
    } = useItemsBreakdownTooltip();

    const quantityBreakdown = [...quantities]
      .filter(([name]) => memberFilter === "All" || name === memberFilter)
      .map(([name, breakdown]) => {
        let quantity = 0;

        for (const itemContainer of Member.ItemContainer) {
          if (containerFilter !== "All" && containerFilter !== itemContainer) continue;

          quantity += breakdown[itemContainer] ?? 0;
        }

        return { name, quantity, breakdown };
      })
      .filter(({ quantity }) => quantity > 0)
      .map(({ name, quantity, breakdown }) => {
        const quantityPercent = (quantity / totalQuantity) * 100;
        const onPointerEnter = (): void => {
          if (containerFilter !== "All") {
            return;
          }
          showBreakdownTooltip({
            name,
            filter: containerFilter,
            breakdown,
          });
        };
        return (
          <Fragment key={name}>
            <span onPointerEnter={onPointerEnter}>{name}</span>
            <span onPointerEnter={onPointerEnter}>{quantity.toLocaleString()}</span>
            <span
              className="items-page-panel-quantity-contribution"
              onPointerEnter={onPointerEnter}
              style={{ transform: `scaleX(${quantityPercent}%)`, background: `hsl(${quantityPercent}, 100%, 40%)` }}
            />
          </Fragment>
        );
      });

    const highAlch = highAlchPer * totalQuantity;
    const gePrice = gePricePer * totalQuantity;

    const wikiLink = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${itemID}`;

    return (
      <div className={`items-page-panel rsborder rsbackground ${isPinned ? "items-page-panel-pinned" : ""}`}>
        <button
          className={`items-page-panel-pin-button ${isPinned ? "pinned" : ""}`}
          onClick={() => onTogglePin(itemID)}
          title={isPinned ? "Unpin item" : "Pin item to top"}
          aria-label={isPinned ? "Unpin item" : "Pin item to top"}
        >
          {isPinned ? "★" : "☆"}
        </button>
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
        <div className="items-page-panel-quantity-breakdown" onPointerLeave={hideBreakdownTooltip}>
          {quantityBreakdown}
        </div>
        {tooltipElement}
        {breakdownTooltip}
      </div>
    );
  },
);

interface FilteredItem {
  itemID: ItemID;
  itemName: string;
  imageURL: string;
  breakdownByMember: Map<Member.Name, Member.ItemLocationBreakdown>;
  totalQuantity: number;
  gePrice: number;
  highAlch: number;
}

// Defines the minimal width of each column, which the panels flex to fill
const PANEL_WIDTH_PIXELS = 280;

const ItemPanelsScrollArea = ({
  sortedItems,
  memberFilter,
  containerFilter,
  pinnedItems,
  onTogglePin,
}: {
  sortedItems: FilteredItem[];
  memberFilter: ItemFilter;
  containerFilter: Member.ItemContainer | "All";
  pinnedItems: Set<ItemID>;
  onTogglePin: (itemID: ItemID) => void;
}): ReactElement => {
  const parentRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);
  const itemsVirtualizer = useVirtualizer({
    count: Math.ceil(sortedItems.length / columns),
    getScrollElement: () => parentRef.current,
    overscan: 3,
    estimateSize: () => 220,
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
    <div ref={parentRef} style={{ overflowY: "auto", paddingRight: "12px" }}>
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
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
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
                  containerFilter={containerFilter}
                  quantities={item.breakdownByMember}
                  isPinned={pinnedItems.has(item.itemID)}
                  onTogglePin={onTogglePin}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const STORAGE_KEY_SORT_CATEGORY = "items-page-sort-category";

const loadSortCategoryFromStorage = (): ItemSortCategory => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SORT_CATEGORY);
    if (stored && ItemSortCategory.includes(stored as ItemSortCategory)) {
      return stored as ItemSortCategory;
    }
  } catch (error) {
    console.warn("Failed to load sort category from localStorage:", error);
  }
  return "GE total price";
};

const validatePinnedItems = (value: string | undefined): string | undefined => value;
const validateContainerFilter = (value: string | undefined): Member.ItemContainer | "All" | undefined => {
  if (typeof value !== "string") return undefined;
  if (value !== "All" && !Member.ItemContainer.includes(value as Member.ItemContainer)) return undefined;

  return value as Member.ItemContainer | "All";
};

export const ItemsPage = (): ReactElement => {
  const [memberFilter, setMemberFilter] = useState<ItemFilter>("All");
  const [searchString, setSearchString] = useState<string>("");
  const [sortCategory, setSortCategory] = useState<ItemSortCategory>(loadSortCategoryFromStorage);
  const { gePrices: geData, items: itemData } = useContext(GameDataContext);

  const members = useContext(GroupMemberNamesContext);
  const items = useContext(GroupItemsContext);

  const [pinnedItemsString, setPinnedItemsString] = useLocalStorage({
    key: "pinned-items",
    defaultValue: "",
    validator: validatePinnedItems,
  });
  const [containerFilter, setContainerFilter] = useLocalStorage<Member.ItemContainer | "All">({
    key: "item-page-container-filter",
    defaultValue: "All",
    validator: validateContainerFilter,
  });

  const pinnedItems = useMemo(
    () =>
      new Set<ItemID>(
        pinnedItemsString
          .split(",")
          .filter((id) => id.length > 0)
          .map((id) => parseInt(id, 10) as ItemID),
      ),
    [pinnedItemsString],
  );

  const togglePin = useCallback(
    (itemID: ItemID) => {
      const newPinnedItems = new Set(pinnedItems);
      if (newPinnedItems.has(itemID)) {
        newPinnedItems.delete(itemID);
      } else {
        newPinnedItems.add(itemID);
      }
      setPinnedItemsString(Array.from(newPinnedItems).join(","));
    },
    [pinnedItems, setPinnedItemsString],
  );

  interface ItemAggregates {
    totalHighAlch: number;
    totalGEPrice: number;
    filteredItems: FilteredItem[];
  }
  const { totalHighAlch, totalGEPrice, filteredItems } = [...(items ?? [])].reduce<ItemAggregates>(
    (previousValue, [itemID, breakdownByMember]) => {
      const itemDatum = itemData?.get(itemID);
      if (!itemDatum) return previousValue;

      if (searchString.length > 0) {
        const name = itemDatum.name.toLocaleLowerCase();
        const parts = searchString
          .split("|")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        const matches = parts.length > 0 && parts.some((part) => name.includes(part));
        if (!matches) return previousValue;
      }

      let filteredTotalQuantity = 0;
      for (const [name, breakdown] of breakdownByMember) {
        if (memberFilter !== "All" && memberFilter !== name) continue;

        for (const itemContainer of Member.ItemContainer) {
          if (containerFilter !== "All" && containerFilter !== itemContainer) continue;

          filteredTotalQuantity += breakdown[itemContainer] ?? 0;
        }
      }

      if (filteredTotalQuantity <= 0) return previousValue;

      const highAlch = itemDatum?.highalch ?? 0;
      const gePrice = mappedGEPrice(itemID, geData, itemData);
      previousValue.totalHighAlch += filteredTotalQuantity * highAlch;
      previousValue.totalGEPrice += filteredTotalQuantity * gePrice;

      previousValue.filteredItems.push({
        itemID,
        itemName: itemDatum?.name ?? "@UNKNOWN",
        breakdownByMember,
        totalQuantity: filteredTotalQuantity,
        gePrice,
        highAlch,
        imageURL: composeItemIconHref({ itemID, quantity: filteredTotalQuantity }, itemDatum),
      });

      return previousValue;
    },
    { totalHighAlch: 0, totalGEPrice: 0, filteredItems: [] },
  );

  const sortedItems = [...filteredItems].sort((lhs, rhs) => {
    const lhsIsPinned = pinnedItems.has(lhs.itemID);
    const rhsIsPinned = pinnedItems.has(rhs.itemID);

    if (lhsIsPinned && !rhsIsPinned) return -1;
    if (!lhsIsPinned && rhsIsPinned) return 1;

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
        <h3>{formatTitle("Your group has no recorded items!")}</h3>
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
          onChange={(string) => setSearchString(string.toLocaleLowerCase().trim())}
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
              const newCategory = e.target.value as ItemSortCategory;
              setSortCategory(newCategory);
              try {
                localStorage.setItem(STORAGE_KEY_SORT_CATEGORY, newCategory);
              } catch (error) {
                console.warn("Failed to save sort category to localStorage:", error);
              }
            }}
          >
            {ItemSortCategory.map((category) => (
              <option key={category} value={category}>
                {`Sort: ${formatTitle(category)}`}
              </option>
            ))}
          </select>
        </div>
        <div className="rsborder-tiny rsbackground rsbackground-hover">
          <select
            value={memberFilter}
            onChange={(e) => {
              setMemberFilter(e.target.value as ItemFilter);
            }}
          >
            {["All", ...members].map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="rsborder-tiny rsbackground rsbackground-hover">
          <select
            value={containerFilter}
            onChange={(e) => {
              setContainerFilter(validateContainerFilter(e.target.value) ?? "All");
            }}
          >
            {["All", ...Member.ItemContainer].map((name) => (
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
      <ItemPanelsScrollArea
        sortedItems={sortedItems}
        memberFilter={memberFilter}
        containerFilter={containerFilter}
        pinnedItems={pinnedItems}
        onTogglePin={togglePin}
      />
    </>
  );
};
