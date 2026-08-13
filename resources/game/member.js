function mapToItems(data) {
  return data.values();
}
export const itemContainers = [
  {
    name: "Bank",
    key: "bank",
    getItems: mapToItems,
  },
  {
    name: "Equipment",
    key: "equipment",
    getItems: mapToItems,
  },
  {
    name: "Quiver",
    key: "quiver",
    getItems: mapToItems,
  },
  {
    name: "Inventory",
    key: "inventory",
    getItems: mapToItems,
  },
  {
    name: "Rune Pouch",
    key: "runePouch",
    getItems: mapToItems,
  },
  {
    name: "Seed Vault",
    key: "seedVault",
    getItems: mapToItems,
  },
  {
    name: "Potion Storage",
    key: "potionStorage",
    getItems: mapToItems,
  },
  {
    name: "Costume Room",
    key: "pohCostumeRoom",
    getItems: mapToItems,
  },
  {
    name: "Plank Sack",
    key: "plankSack",
    getItems: mapToItems,
  },
  {
    name: "Master Scroll Book",
    key: "masterScrollBook",
    getItems: mapToItems,
  },
  {
    name: "Essence Pouches",
    key: "essencePouches",
    getItems: mapToItems,
  },
  {
    name: "Tackle Box",
    key: "tackleBox",
    getItems: mapToItems,
  },
  {
    name: "Tool Leprechaun",
    key: "toolLeprechaun",
    getItems: mapToItems,
  },
  {
    name: "Elnock Inquisitor",
    key: "elnockInquisitor",
    getItems: mapToItems,
  },
  {
    name: "Coal Bag",
    key: "coalBag",
    getItems: mapToItems,
  },
  {
    name: "Fish Barrel",
    key: "fishBarrel",
    getItems: mapToItems,
  },
];
export const itemContainerNames = itemContainers.map(function getContainerName({ name }) {
  return name;
});
