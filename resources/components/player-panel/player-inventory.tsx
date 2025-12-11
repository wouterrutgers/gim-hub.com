import { useContext, type ReactElement, type ReactNode } from "react";
import { useItemTooltip, type ItemTooltipProps } from "../tooltip/item-tooltip";
import { GameDataContext } from "../../context/game-data-context";
import * as Member from "../../game/member";
import { useMemberInventoryContext, useMemberRunePouchContext } from "../../context/group-context";
import {
  composeItemIconHref,
  formatShortQuantity,
  formatVeryShortQuantity,
  isRunePouch,
  mappedGEPrice,
} from "../../game/items";
import { CachedImage } from "../cached-image/cached-image";

import "./player-inventory.css";

interface ItemBoxPouchRuneProps {
  iconSource: string;
  name: string;
  quantity: number;
}
const ItemBoxPouchRune = ({ iconSource, name, quantity }: ItemBoxPouchRuneProps): ReactElement => {
  return (
    <div className="player-inventory-pouch-item-box">
      <CachedImage alt={name} src={iconSource} />
      <span className="player-inventory-item-quantity">{formatVeryShortQuantity(quantity)}</span>
    </div>
  );
};

interface ItemBoxProps {
  link: string;
  iconSource: string;
  quantity: number;
  onPointerEnter: () => void;
  children?: ReactNode;
}
const ItemBox = ({ link, iconSource, quantity, onPointerEnter, children }: ItemBoxProps): ReactElement => {
  let quantityOverlay = undefined;
  if (quantity > 1) {
    quantityOverlay = <span className="player-inventory-item-quantity">{formatShortQuantity(quantity)}</span>;
  }

  return (
    <a
      href={link}
      className="player-inventory-item-box"
      target="_blank"
      rel="noopener noreferrer"
      onPointerEnter={onPointerEnter}
    >
      <CachedImage alt="osrs item" src={iconSource} />
      {quantityOverlay}
      {children}
    </a>
  );
};

export const PlayerInventory = ({ member }: { member: Member.Name }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useItemTooltip();

  const { items: itemData, gePrices: geData } = useContext(GameDataContext);
  const items = useMemberInventoryContext(member);
  const runePouch = useMemberRunePouchContext(member);

  const itemElements = [];
  for (let index = 0; index < 28; index++) {
    const item = items?.get(index);
    if (!item || !itemData?.has(item.itemID)) {
      itemElements.push(<span onPointerEnter={hideTooltip} key={`empty ${index}`} />);
      continue;
    }

    const { itemID, quantity } = item;
    const itemDatum = itemData.get(itemID)!;

    const wikiLinkHref = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.itemID}`;
    const iconHref = composeItemIconHref(item, itemDatum);

    let pouchOverlay = undefined;

    let key = `${item.itemID} ${item.quantity} ${index} `;
    let tooltipProps: ItemTooltipProps = {
      type: "Item",
      name: itemDatum.name,
      quantity: quantity,
      highAlch: itemDatum.highalch,
      gePrice: mappedGEPrice(itemID, geData, itemData),
    };
    if (isRunePouch(itemID) && runePouch) {
      const overlayItemIcons = [];
      let totalHighAlch = 0;
      let totalGePrice = 0;
      const runes: { name: string; quantity: number }[] = [];
      for (const [runeID, { quantity: runeQuantity }] of runePouch) {
        const runeDatum = itemData?.get(runeID);
        if (!runeDatum) continue;

        const runeKey = `${runeID} ${runeQuantity}`;
        key += runeKey;
        totalGePrice += mappedGEPrice(runeID, geData, itemData) * runeQuantity;
        totalHighAlch += runeDatum.highalch * runeQuantity;
        runes.push({ name: runeDatum.name, quantity: runeQuantity });

        const runeIconSource = composeItemIconHref({ itemID: runeID, quantity: runeQuantity }, runeDatum);
        overlayItemIcons.push(
          <ItemBoxPouchRune key={runeKey} iconSource={runeIconSource} name={runeDatum.name} quantity={runeQuantity} />,
        );
      }
      tooltipProps = {
        type: "Rune Pouch",
        name: itemDatum.name,
        totalHighAlch,
        totalGePrice,
        runes,
      };
      if (overlayItemIcons.length > 0) {
        const containerClass =
          overlayItemIcons.length <= 3
            ? "player-inventory-pouch-container player-inventory-pouch-vertical"
            : "player-inventory-pouch-container";
        pouchOverlay = <div className={containerClass}>{overlayItemIcons}</div>;
      }
    }

    itemElements.push(
      <ItemBox
        key={key}
        quantity={quantity}
        link={wikiLinkHref}
        iconSource={iconHref}
        onPointerEnter={() => {
          if (!tooltipProps) return;
          showTooltip(tooltipProps);
        }}
      >
        {pouchOverlay}
      </ItemBox>,
    );
  }

  return (
    <div className="player-inventory">
      <div onPointerLeave={hideTooltip} className="player-inventory-background">
        {itemElements}
      </div>
      {tooltipElement}
    </div>
  );
};
