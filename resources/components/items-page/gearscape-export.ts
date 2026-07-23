interface GearscapeItem {
  itemID: number;
  itemName: string;
  totalQuantity: number;
}

export function formatGearscapeItems(items: GearscapeItem[]): string {
  return [
    "Item id\tItem name\tItem quantity",
    ...items.map((item) =>
      [item.itemID, item.itemName.replaceAll("\t", " ").replaceAll(/\r?\n/g, " "), item.totalQuantity].join("\t"),
    ),
  ]
    .join("\n")
    .concat("\n");
}

export async function copyGearscapeItems(items: GearscapeItem[]): Promise<void> {
  await navigator.clipboard.writeText(formatGearscapeItems(items));
}
