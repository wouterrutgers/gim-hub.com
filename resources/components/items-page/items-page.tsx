import { type ReactElement, Fragment, memo, useContext, useEffect, useRef, useState, useCallback } from "react";
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
import { useModal } from "../modal/modal";

import "./items-page.css";

// Negate the filter, so that new/renamed members aren't filtered by default
type MemberNegativeFilter = Set<Member.Name>;

const ItemSortCategory = [
  "Total quantity",
  "HA total value",
  "HA unit value",
  "GE total price",
  "GE unit price",
  "Alphabetical",
] as const;
type ItemSortCategory = (typeof ItemSortCategory)[number];

const DEFAULT_SORT_CATEGORY: ItemSortCategory = "GE total price";

interface ItemPanelProps {
  itemName: string;
  itemID: ItemID;
  highAlchPer: number;
  alchable: boolean;
  gePricePer: number;
  imageURL: string;
  totalQuantity: number;
  memberFilter: MemberNegativeFilter;
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
    alchable,
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
      .filter(([name]) => !memberFilter.has(name))
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
        <div className="items-page-panel-top rsborder-tiny">
          <div>
            <Link className="items-page-panel-name rstext" to={wikiLink} target="_blank" rel="noopener noreferrer">
              {itemName}
            </Link>
            <button
              className={`items-page-panel-pin-button ${isPinned ? "pinned" : ""}`}
              onClick={() => onTogglePin(itemID)}
              title={isPinned ? "Unpin item" : "Pin item to top"}
              aria-label={isPinned ? "Unpin item" : "Pin item to top"}
            >
              {isPinned ? "★" : "☆"}
            </button>
            <div className="items-page-panel-item-details">
              <span>Quantity</span>
              <span>{totalQuantity.toLocaleString()}</span>
              <span>High alch</span>
              <span
                onPointerEnter={
                  alchable
                    ? (): void =>
                        showTooltip({
                          perPiecePrice: highAlchPer,
                          totalPrice: highAlch,
                          quantity: totalQuantity,
                        })
                    : undefined
                }
                onPointerLeave={alchable ? hideTooltip : undefined}
              >
                {alchable ? `${highAlch.toLocaleString()}gp` : "n/a"}
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
  alchable: boolean;
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
  memberFilter: MemberNegativeFilter;
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
                  alchable={item.alchable}
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

const validateItemSortCategory = (value: string | undefined): ItemSortCategory | undefined => {
  if (typeof value !== "string") return undefined;
  if (!ItemSortCategory.includes(value as ItemSortCategory)) return undefined;

  return value as ItemSortCategory;
};

type PinnedItems = Set<ItemID>;
const validatePinnedItems = (value: string | undefined): string | undefined => value;
const usePinnedItems = (): [PinnedItems, (toggleID: ItemID) => void] => {
  const [pinnedItemsUserString, setPinnedItemsUserString] = useLocalStorage({
    key: "pinned-items",
    defaultValue: "",
    validator: validatePinnedItems,
  });

  const pinnedItems = new Set<ItemID>(
    pinnedItemsUserString
      .split(",")
      .filter((id) => id.length > 0)
      .map((id) => parseInt(id, 10) as ItemID),
  );

  const togglePin = useCallback(
    (itemID: ItemID) => {
      const newPinnedItems = new Set(pinnedItems);
      if (newPinnedItems.has(itemID)) {
        newPinnedItems.delete(itemID);
      } else {
        newPinnedItems.add(itemID);
      }
      setPinnedItemsUserString(Array.from(newPinnedItems).join(","));
    },
    [pinnedItems, setPinnedItemsUserString],
  );

  return [pinnedItems, togglePin];
};

type ContainerFilter = "All" | Member.ItemContainer;
const DEFAULT_CONTAINER_FILTER: ContainerFilter = "All";
const validateContainerFilter = (value: string | undefined): ContainerFilter | undefined => {
  if (typeof value !== "string") return undefined;
  if (value !== "All" && !Member.ItemContainer.includes(value as Member.ItemContainer)) return undefined;

  return value as ContainerFilter;
};

interface SearchFilter {
  parts: (
    | {
        type: "Name";
        lowercase: string;
        exact: boolean;
      }
    | { type: "Tag"; bitmask: bigint }
  )[];
}
const validateSearchFilter = (value: string | undefined): string | undefined => value;
const useSearchFilter = (): [ReactElement, SearchFilter, () => void] => {
  const [filterUserString, setFilterUserString] = useLocalStorage({
    key: "search-filter",
    defaultValue: undefined,
    validator: validateSearchFilter,
  });
  const { itemTags } = useContext(GameDataContext);

  const parts = (filterUserString ?? "")
    .split("|")
    .map((s: string) => {
      return s.trim().toLocaleLowerCase();
    })
    .map<SearchFilter["parts"][number]>((s: string) => {
      if (s.length === 0) {
        return {
          type: "Name",
          lowercase: "",
          exact: false,
        };
      }

      const exact = s.startsWith('"') && s.endsWith('"');
      if (exact) {
        return {
          type: "Name",
          lowercase: s.slice(1, -1),
          exact: true,
        };
      }

      const splitForTag = s.split(":");
      const prefix = splitForTag[0];
      if (splitForTag.length === 1 || prefix !== "tag") {
        return {
          type: "Name",
          lowercase: s,
          exact: false,
        };
      }

      if (itemTags?.tags === undefined) {
        return {
          type: "Tag",
          bitmask: 0n,
        };
      }

      const suffix = splitForTag.slice(1).join(":").toLocaleLowerCase();

      let bitmask = 0n;
      for (const [tag, bitIndex] of itemTags?.tags ?? []) {
        const tagMatches = tag.toLocaleLowerCase() === suffix;
        if (tagMatches) {
          bitmask += 1n << BigInt(bitIndex);
        }
      }

      return {
        type: "Tag" as const,
        bitmask,
      };
    })
    .filter((part) => {
      if (part.type !== "Name") {
        return true;
      }
      return part.lowercase.length > 0;
    });

  const resetSearch = useCallback(() => {
    setFilterUserString(undefined);
  }, [setFilterUserString]);

  return [
    <SearchElement
      onChange={setFilterUserString}
      id="items-page-search"
      placeholder="Search"
      auto-focus
      value={filterUserString ?? ""}
      defaultValue={filterUserString}
    />,
    { parts },
    resetSearch,
  ];
};

const validateMemberFilter = (value: string | undefined): string | undefined => value;
const useMemberFilter = (): [ReactElement, MemberNegativeFilter, () => void] => {
  const [memberFilterUserString, setMemberFilterUserString] = useLocalStorage({
    key: "items-page-member-filter",
    defaultValue: undefined,
    validator: validateMemberFilter,
  });

  const members = useContext(GroupMemberNamesContext);

  const memberFilterRef = useRef<MemberNegativeFilter>(new Set());
  useEffect(() => {
    const newFilter = new Set(
      (memberFilterUserString ?? "").split(",").filter((name) => name.length > 0) as Member.Name[],
    );
    memberFilterRef.current = newFilter;
    if (members.size > 0) {
      memberFilterRef.current = memberFilterRef.current.intersection(members);
    }
    setMemberFilterUserString([...memberFilterRef.current.values()].join(","));
  }, [memberFilterUserString]);

  const element = (
    <span className="items-page-member-filter-container rsborder-tiny rsbackground">
      {[...members.values()].map((name, index, array) => (
        <Fragment key={name}>
          <span className="rsbackground-hover">
            <input
              id={`items-page-member-filter-${name}`}
              type="checkbox"
              checked={!memberFilterRef.current.has(name)}
              onChange={() => {
                const shouldDelete = memberFilterRef.current.has(name);
                const newFilter = new Set(memberFilterRef.current.values());
                if (shouldDelete) {
                  newFilter.delete(name);
                } else {
                  newFilter.add(name);
                }

                memberFilterRef.current = newFilter;
                if (members.size > 0) {
                  memberFilterRef.current = memberFilterRef.current.intersection(members);
                }
                setMemberFilterUserString([...memberFilterRef.current.values()].join(","));
              }}
            />
            <label htmlFor={`items-page-member-filter-${name}`}>{name}</label>
          </span>
          {index < array.length - 1 ? <hr /> : undefined}
        </Fragment>
      ))}
    </span>
  );

  const resetMemberFilter = useCallback(() => {
    setMemberFilterUserString(undefined);
  }, [setMemberFilterUserString]);

  return [element, memberFilterRef.current, resetMemberFilter];
};

const ItemsPageTutorialWindow = ({ onCloseModal }: { onCloseModal: () => void }): ReactElement => {
  const { itemTags } = useContext(GameDataContext);
  const [pinned, setPinned] = useState(true);

  return (
    <div className="items-page-tutorial-window rsborder rsbackground">
      <div className="items-page-tutorial-window-header">
        <button onClick={onCloseModal}>
          <CachedImage src="/ui/1731-0.png" alt={formatTitle("Close dialog")} title={formatTitle("Close dialog")} />
        </button>
      </div>
      <div className="items-page-tutorial-window-body">
        <h2>{formatTitle("Searching for items")}</h2>
        <p>Type in the 'Search' box to search item names, and display only the items that match.</p>
        <p>
          {`The match is not exact, unless the phrase is surrounded by double quotes. For example, searching `}
          <span className="items-page-tutorial-inline-search">coal</span>
          {` will display both the OSRS items `}
          <b className="items-page-tutorial-inline-item-name">Coal</b> and{" "}
          <b className="items-page-tutorial-inline-item-name">Coal bag</b>
          {`, while searching instead `}
          <span className="items-page-tutorial-inline-search">"coal"</span>
          {` will display only `}
          <b className="items-page-tutorial-inline-item-name">Coal</b>. Searches are never case-sensitive.
        </p>
        <p>
          {` You can combine searches separated with vertical bars to search for items that match any of the searches. For example, `}
          <span className="items-page-tutorial-inline-search">whip | coal</span> will display both{" "}
          <b className="items-page-tutorial-inline-item-name">Abyssal Whip</b>
          {` and `}
          <b className="items-page-tutorial-inline-item-name">Coal bag</b> (among other items).
        </p>
        <p>
          Type <span className="items-page-tutorial-inline-search">tag:</span> followed by an exact tag to search by
          category of item instead of name. The following tags are available, with some entries being aliases that
          contain the same items:
        </p>
        <div className="items-page-tutorial-tags rsborder-tiny">
          {itemTags?.tags.map(([tag]) => (
            <span>{tag}</span>
          ))}
        </div>
        <h2>{formatTitle("Item breakdown")}</h2>
        <ItemPanel
          containerFilter="All"
          gePricePer={200}
          highAlchPer={100}
          alchable={true}
          imageURL="/icons/items/4323.webp"
          isPinned={pinned}
          itemID={4323 as ItemID}
          itemName="Team-5 cape"
          memberFilter={new Set()}
          onTogglePin={() => {
            setPinned(!pinned);
          }}
          quantities={new Map([["Zezima" as Member.Name, { Total: 100, Bank: 100, Inventory: 15 }]])}
          totalQuantity={115}
        />
        <ul>
          <li>
            Hover over the numbers to see detailed tooltips, including a breakdown of where items are for each member.
          </li>
          <li>
            Hover over the upper right of the panel and click the star (★) to pin the item, causing it to appear before
            all other items regardless of sorting order.
          </li>
          <li>The name is an interactive link that leads to the item's page on the official OSRS wiki.</li>
        </ul>
      </div>
    </div>
  );
};

export const ItemsPage = (): ReactElement => {
  const [searchInputElement, searchFilter, resetSearchFilter] = useSearchFilter();
  const [memberFilterElement, memberFilter, resetMemberFilter] = useMemberFilter();

  const [pinnedItems, togglePin] = usePinnedItems();

  const [sortCategory, setSortCategory] = useLocalStorage<ItemSortCategory>({
    key: "items-page-sort-category",
    defaultValue: DEFAULT_SORT_CATEGORY,
    validator: validateItemSortCategory,
  });

  const { gePrices: geData, items: itemData, itemTags } = useContext(GameDataContext);
  const items = useContext(GroupItemsContext);
  const { open: openSearchTutorial, modal: searchTutorialModal } = useModal(ItemsPageTutorialWindow);

  const [containerFilter, setContainerFilter] = useLocalStorage<ContainerFilter>({
    key: "item-page-container-filter",
    defaultValue: DEFAULT_CONTAINER_FILTER,
    validator: validateContainerFilter,
  });

  const resetFilters = useCallback(() => {
    resetSearchFilter();
    resetMemberFilter();
    setSortCategory(undefined);
    setContainerFilter(undefined);
  }, [resetSearchFilter, resetMemberFilter, setSortCategory, setContainerFilter]);

  const hasActiveFilters =
    searchFilter.parts.length > 0 ||
    memberFilter.size > 0 ||
    sortCategory !== DEFAULT_SORT_CATEGORY ||
    containerFilter !== DEFAULT_CONTAINER_FILTER;

  interface ItemAggregates {
    totalHighAlch: number;
    totalGEPrice: number;
    filteredItems: FilteredItem[];
  }

  const { totalHighAlch, totalGEPrice, filteredItems } = [...(items ?? [])].reduce<ItemAggregates>(
    (previousValue, [itemID, breakdownByMember]) => {
      const itemDatum = itemData?.get(itemID);

      if (!itemDatum) return previousValue;

      if (searchFilter.parts.length > 0) {
        const itemLowercase = itemDatum.name.toLocaleLowerCase();
        const matches = searchFilter.parts.some((part) => {
          switch (part.type) {
            case "Name": {
              if (part.exact) {
                return part.lowercase === itemLowercase;
              } else {
                return itemLowercase.includes(part.lowercase);
              }
            }
            case "Tag": {
              return (part.bitmask & (itemTags?.items[itemID] ?? 0n)) !== 0n;
            }
          }
        });

        if (!matches) {
          return previousValue;
        }
      }

      let filteredTotalQuantity = 0;
      for (const [name, breakdown] of breakdownByMember) {
        if (memberFilter.has(name)) continue;

        for (const itemContainer of Member.ItemContainer) {
          if (containerFilter !== "All" && containerFilter !== itemContainer) continue;

          filteredTotalQuantity += breakdown[itemContainer] ?? 0;
        }
      }

      if (filteredTotalQuantity <= 0) return previousValue;

      const highAlch = itemDatum?.highalch ?? 0;
      const alchable = itemDatum.alchable;
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
        alchable,
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
      {searchTutorialModal}

      <div id="items-page-head">
        {searchInputElement}
        {hasActiveFilters ? (
          <button
            id="items-page-reset-filters-button"
            className="men-button"
            onClick={resetFilters}
            title="Reset all filters to default"
            aria-label="Reset all filters to default"
          >
            <CachedImage alt={"Reset filters"} src="/ui/1731-0.png" />
            Reset
          </button>
        ) : undefined}
        <button id="items-page-tutorial-button" className="men-button" onClick={openSearchTutorial}>
          <CachedImage alt={"items tutorial"} src="/ui/1094-0.png" />
          Tutorial
        </button>
      </div>
      <div className="items-page-utility">
        <select
          className="rsborder-tiny rsbackground rsbackground-hover"
          value={sortCategory}
          onChange={(e) => {
            const newCategory = e.target.value as ItemSortCategory;
            setSortCategory(newCategory);
          }}
        >
          {ItemSortCategory.map((category) => (
            <option key={category} value={category}>
              {`Sort: ${formatTitle(category)}`}
            </option>
          ))}
        </select>
        <select
          className="rsborder-tiny rsbackground rsbackground-hover"
          value={containerFilter}
          onChange={(e) => {
            setContainerFilter(validateContainerFilter(e.target.value));
          }}
        >
          {["All", ...Member.ItemContainer].map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {memberFilterElement}
      </div>
      <div className="items-page-utility">
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
