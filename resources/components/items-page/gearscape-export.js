function formatGearscapeItems(items) {
  return [
    "Item id\tItem name\tItem quantity",
    ...items.map((item) =>
      [item.itemID, item.itemName.replaceAll("\t", " ").replaceAll(/\r?\n/g, " "), item.totalQuantity].join("\t"),
    ),
  ]
    .join("\n")
    .concat("\n");
}
export async function copyGearscapeItems(items) {
  await navigator.clipboard.writeText(formatGearscapeItems(items));
}
