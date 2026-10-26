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

function* cargoHoldsToItems(holds) {
  for (const hold of holds.values()) {
    yield* hold.items.values();
  }
}

export function cargoHoldLocations(holds, itemID) {
  return [...holds.values()]
    .filter(function containsItem(hold) {
      return hold.items.has(itemID);
    })
    .map(function describeLocation(hold) {
      return { id: hold.id, name: hold.name, quantity: hold.items.get(itemID).quantity };
    });
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
  { name: "Blast Furnace coffer", key: "blastFurnaceCoffer", getItems: mapToItems },
  { name: "Nightmare Zone coffer", key: "nightmareZoneCoffer", getItems: mapToItems },
  { name: "Scar Essence Mine coffer", key: "scarEssenceMineCoffer", getItems: mapToItems },
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
  { name: "Meat pouch", key: "meatPouch", itemIds: [29295, 29297, 29462, 29464], getItems: mapToItems },
  { name: "Log basket", key: "logBasket", itemIds: [28140, 28142, 28143, 28145], getItems: mapToItems },
  { name: "Reagent pouch", key: "reagentPouch", itemIds: [29996, 29998], getItems: mapToItems },
  { name: "Fur pouch", key: "furPouch", itemIds: [29299, 29301, 29303, 29466, 29468, 29470], getItems: mapToItems },
  { name: "Bolt pouch", key: "boltPouch", itemIds: [9433], getItems: mapToItems },
  { name: "Forestry kit", key: "forestryKit", itemIds: [28136, 28143, 28145], getItems: mapToItems },
  { name: "Huntsman's kit", key: "huntsmansKit", itemIds: [29309], getItems: mapToItems },
  { name: "Bow string spool", key: "bowStringSpool", itemIds: [31052], getItems: mapToItems },
  { name: "Steel key ring", key: "steelKeyRing", itemIds: [4446], getItems: mapToItems },
  { name: "Flamtaer bag", key: "flamtaerBag", itemIds: [12854], getItems: mapToItems },
  { name: "Bottomless compost bucket", key: "bottomlessCompostBucket", itemIds: [22994, 22997], getItems: mapToItems },
  { name: "Gnomish firelighter", key: "gnomishFirelighter", itemIds: [20275, 20278], getItems: mapToItems },
  { name: "Blast Furnace", key: "blastFurnace", getItems: mapToItems },
  { name: "Fossil storage", key: "fossilStorage", getItems: mapToItems },
  { name: "Balloon transport", key: "balloonTransport", getItems: mapToItems },
  { name: "Sandstorm", key: "sandstorm", getItems: mapToItems },
  { name: "Hallowed Sepulchre", key: "hallowedSepulchre", getItems: mapToItems },
  { name: "Cargo holds", key: "cargoHolds", getItems: cargoHoldsToItems },
  { name: "STASH units", key: "stashUnits", getItems: stashToItems },
];
export const itemContainerNames = itemContainers.map(function getContainerName({ name }) {
  return name;
});

export function portableStorageKeys(itemID) {
  return itemContainers
    .filter(function containsVariant(container) {
      return container.itemIds?.includes(itemID);
    })
    .map(function getKey(container) {
      return container.key;
    });
}
