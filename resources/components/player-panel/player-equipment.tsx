import { type ReactElement, useContext } from "react";
import { useItemTooltip } from "../tooltip/item-tooltip";
import { GameDataContext } from "../../context/game-data-context";
import { EquipmentSlot } from "../../game/equipment";
import type * as Member from "../../game/member";
import {
  useMemberEquipmentContext,
  useMemberInventoryContext,
  useMemberQuiverContext,
} from "../../context/group-context";
import { CachedImage } from "../cached-image/cached-image";

import "./player-equipment.css";
import type { ItemID } from "../../game/items";
import { composeItemIconHref, formatShortQuantity, mappedGEPrice } from "../../game/items";

const DIZANAS_IDS = new Set<ItemID>([
  28902 as ItemID, // Dizana's max cape
  28906 as ItemID, // Dizana's max cape (l)
  28947 as ItemID, // Dizana's quiver (uncharged)
  28949 as ItemID, // Dizana's quiver (uncharged) (l)
  28951 as ItemID, // Dizana's quiver
  28953 as ItemID, // Dizana's quiver (l)
  28955 as ItemID, // Blessed dizana's quiver
  28957 as ItemID, // Blessed dizana's quiver (l)
]);

const VisibleEquipmentSlots: EquipmentSlot[] = [
  "Head",
  "Cape",
  "Amulet",
  "Weapon",
  "Body",
  "Shield",
  "Legs",
  "Gloves",
  "Boots",
  "Ring",
  "Quiver",
  "Ammo",
];
const EquipmentSlotEmptyIcons = new Map<EquipmentSlot, string>([
  ["Head", "156-0.png"],
  ["Cape", "157-0.png"],
  ["Amulet", "158-0.png"],
  ["Weapon", "159-0.png"],
  ["Body", "161-0.png"],
  ["Shield", "162-0.png"],
  ["Legs", "163-0.png"],
  ["Gloves", "164-0.png"],
  ["Boots", "165-0.png"],
  ["Ring", "160-0.png"],
  ["Ammo", "166-0.png"],
  ["Quiver", "166-0.png"],
]);

export const PlayerEquipment = ({ member }: { member: Member.Name }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useItemTooltip();
  const { items: itemData, gePrices: geData } = useContext(GameDataContext);
  const equipment = useMemberEquipmentContext(member);
  const inventory = useMemberInventoryContext(member);
  const quiver = useMemberQuiverContext(member);

  const slotElements = [];

  const hasEquippedQuiver = Array.from(equipment?.values() ?? []).some((item) => DIZANAS_IDS.has(item.itemID));
  const hasInventoryQuiver = (inventory ?? []).some((item) => item !== undefined && DIZANAS_IDS.has(item.itemID));

  for (const slot of VisibleEquipmentSlots) {
    let item = equipment?.get(slot);
    let present = true;
    let isGrayed = false;

    if (slot === "Quiver") {
      present = hasEquippedQuiver || hasInventoryQuiver;
      isGrayed = !hasEquippedQuiver;

      const firstEntry = quiver?.entries().next().value;
      if (firstEntry) {
        const [itemID, quantity] = firstEntry;
        item = { itemID, quantity };
      }
    }

    if (!present) {
      continue;
    }

    const isFilled = Boolean(item);

    const classNames = [
      `equipment-${slot.toLowerCase()}`,
      isFilled ? "equipment-slot-filled" : "equipment-slot-empty",
      isGrayed ? "equipment-slot-grayed" : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (isFilled && item) {
      const itemDatum = itemData?.get(item.itemID);
      const iconHref = composeItemIconHref(item, itemDatum);
      const wikiLink = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.itemID}`;

      const onPointerEnter = itemDatum
        ? (): void => {
            showTooltip({
              type: "Item",
              name: itemDatum.name,
              quantity: item.quantity,
              highAlch: itemDatum.highalch,
              gePrice: mappedGEPrice(item.itemID, geData, itemData),
            });
          }
        : undefined;

      let quantityOverlay: ReactElement | undefined;
      if (item.quantity > 1) {
        quantityOverlay = <span className="player-equipment-item-quantity">{formatShortQuantity(item.quantity)}</span>;
      }

      slotElements.push(
        <a
          href={wikiLink}
          target="_blank"
          rel="noopener noreferrer"
          key={slot}
          onPointerEnter={onPointerEnter}
          onPointerLeave={hideTooltip}
          className={classNames}
        >
          {!iconHref && (
            <CachedImage alt={`empty equipment ${slot} slot`} src={`/ui/${EquipmentSlotEmptyIcons.get(slot) ?? ""}`} />
          )}
          {iconHref && <CachedImage alt={"equipment"} className="equipment-slot-item" src={iconHref} />}
          {quantityOverlay}
        </a>,
      );
      continue;
    }

    slotElements.push(
      <div key={slot} className={classNames}>
        <CachedImage alt={`empty equipment ${slot} slot`} src={`/ui/${EquipmentSlotEmptyIcons.get(slot) ?? ""}`} />
      </div>,
    );
  }

  return (
    <div className="player-equipment">
      {slotElements}
      {tooltipElement}
    </div>
  );
};
