function mapToItems(data) {
  return data.values();
}
function* stashToItems(units) {
  for (const unit of units.values()) {
    if (unit.state === "filled") {
      yield* unit.items.values();
    }
  }
}

export function stashItemLocations(units, itemID) {
  return [...units.values()]
    .filter(function containsItem(unit) {
      return unit.state === "filled" && unit.items.has(itemID);
    })
    .map(function describeLocation(unit) {
      return { id: unit.id, name: unit.name, tier: unit.tier, quantity: unit.items.get(itemID).quantity };
    });
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
    itemIds: [28947, 28949, 28951, 28953, 28955, 28957],
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
  { name: "Spice rack", key: "pohSpiceRack", getItems: mapToItems },
  { name: "Pet house", key: "pohPetHouse", getItems: mapToItems },
  { name: "Servant’s moneybag", key: "pohServantsMoneybag", getItems: mapToItems },
  {
    name: "Plank Sack",
    key: "plankSack",
    itemIds: [24882, 25629],
    getItems: mapToItems,
  },
  {
    name: "Master Scroll Book",
    key: "masterScrollBook",
    itemIds: [21387, 21389],
    getItems: mapToItems,
  },
  {
    name: "Essence Pouches",
    key: "essencePouches",
    itemIds: [5509, 5510, 5511, 5512, 5513, 5514, 5515, 6819, 26784, 26786, 26906],
    getItems: mapToItems,
  },
  {
    name: "Tackle Box",
    key: "tackleBox",
    itemIds: [25580],
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
    itemIds: [12019, 24480, 25627],
    getItems: mapToItems,
  },
  {
    name: "Fish Barrel",
    key: "fishBarrel",
    itemIds: [25582, 25584, 25585, 25587],
    getItems: mapToItems,
  },
  {
    name: "Herb sack",
    key: "herbSack",
    itemIds: [13226, 24478, 33135, 33137],
    getItems: mapToItems,
  },
  { name: "Looting bag", key: "lootingBag", itemIds: [11941, 22586], getItems: mapToItems },
  { name: "Seed box", key: "seedBox", itemIds: [13639, 24482], getItems: mapToItems },
  { name: "Gem bag", key: "gemBag", itemIds: [12020, 24481], getItems: mapToItems },
  { name: "Chugging barrel", key: "chuggingBarrel", itemIds: [30000], getItems: mapToItems },
  { name: "STASH units", key: "stashUnits", getItems: stashToItems },
];
export const itemContainerNames = itemContainers.map(function getContainerName({ name }) {
  return name;
});

export function portableStorageKey(itemID) {
  return itemContainers.find(function containsVariant(container) {
    return container.itemIds?.includes(itemID);
  })?.key;
}
