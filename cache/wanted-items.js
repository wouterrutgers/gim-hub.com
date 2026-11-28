const { setTimeout } = require("node:timers/promises");
const fetchWiki = require("./wiki");
const { loadSeasonalItemPages } = require("./seasonal-items");
const { loadRestrictedItemPages, loadUnavailableItemIds } = require("./unavailable-items");

const BUCKET_PAGE_SIZE = 500;
const INTERFACE_GAMEVAL = /(?:^|_)skillguide_|^poh_.*_league_?\d|^league_\d+_(?:poh_|pool_)/;
const ELEMENTAL_COMBINATION_RUNES = {
  554: [4694, 4697, 4699], // Fire: steam, smoke, lava
  555: [4694, 4695, 4698], // Water: steam, mist, mud
  556: [4695, 4696, 4697], // Air: mist, dust, smoke
  557: [4696, 4698, 4699], // Earth: dust, mud, lava
};

function buildItemStateVariants(items, cacheItems, itemVariations) {
  const equivalents = {};
  const idsByGameVal = new Map();
  const families = new Map();

  for (const itemId of Object.keys(items)) {
    const gameVal = cacheItems[itemId].gameVal;
    if (gameVal) {
      idsByGameVal.set(gameVal, Number(itemId));
    }
  }

  for (const family of Object.values(itemVariations)) {
    for (const itemId of family) {
      families.set(itemId, family);
    }
  }

  for (const [gameVal, itemId] of idsByGameVal) {
    // Active and new crystal equipment differ only in the number of charges.
    const baseName =
      gameVal.match(/^(.+)_(?:worn|dummy)$/)?.[1] ?? gameVal.match(/^(crystal_(?:bow|halberd|shield))_2500$/)?.[1];
    const baseId = idsByGameVal.get(baseName);

    if (items[baseId]?.name === items[itemId].name && families.get(itemId)?.includes(baseId)) {
      (equivalents[baseId] ??= []).push(itemId);
    }
  }

  return equivalents;
}

function buildEquivalents({ items, cacheItems, itemVariations, recipes, itemStates, excludedItems, cosmeticBases }) {
  const equivalents = structuredClone(itemStates);
  const families = Object.values(itemVariations);
  const canonicalIds = new Map(
    Object.entries(equivalents).flatMap(([baseId, variants]) => variants.map((id) => [id, Number(baseId)])),
  );

  function addEquivalent(baseId, itemId) {
    const canonicalId = canonicalIds.get(baseId) ?? baseId;
    const variantId = canonicalIds.get(itemId) ?? itemId;
    if (canonicalId === variantId) {
      return;
    }

    const variants = [variantId, ...(equivalents[variantId] ?? [])];
    (equivalents[canonicalId] ??= []).push(...variants);
    for (const id of variants) {
      canonicalIds.set(id, canonicalId);
    }
    delete equivalents[variantId];
  }

  for (const [baseId, ...variantIds] of families) {
    const base = items[baseId];
    const family = new Set([baseId, ...variantIds]);
    const recolourBaseId = [...family].find(
      (id) =>
        items[id] &&
        !excludedItems.has(id) &&
        /^(?:crystal_(?:helmet|chestplate|platelegs)|serpentine_helm)$/.test(cacheItems[id].gameVal),
    );
    for (const variantId of variantIds) {
      const variant = items[variantId];
      if (!base || !variant) {
        continue;
      }

      const equivalentNames = [`${base.name} (or)`, `${base.name} (s)`, `${base.name} (empty)`];
      if (equivalentNames.includes(variant.name) && (mapsTo(variant, baseId) || mapsTo(base, variantId))) {
        const recipeBases = new Set(
          (recipes[variantId] ?? []).flatMap(({ ingredients }) =>
            ingredients
              .filter(({ itemId, quantity }) => itemId !== variantId && quantity === 1 && family.has(itemId))
              .map(({ itemId }) => itemId),
          ),
        );
        if (recipeBases.size > 1) {
          continue;
        }
        addEquivalent(recipeBases.values().next().value ?? baseId, variantId);
      }
    }

    for (const itemId of family) {
      const item = items[itemId];
      if (!item || excludedItems.has(itemId)) {
        continue;
      }

      if (recolourBaseId && cacheItems[itemId].gameVal?.startsWith(`${cacheItems[recolourBaseId].gameVal}_`)) {
        addEquivalent(recolourBaseId, itemId);
        continue;
      }

      if (item.mapping?.length !== 1) {
        continue;
      }

      const [{ id: unchargedId, quantity }] = item.mapping;
      if (quantity !== 1 || !family.has(unchargedId) || excludedItems.has(unchargedId)) {
        continue;
      }

      const unchargedName = items[unchargedId]?.name;
      const inactiveName = `${item.name.replace(/ \(c\)$/, "")} (inactive)`;
      if (![inactiveName, `${item.name} (uncharged)`, `${item.name} (empty)`].includes(unchargedName)) {
        continue;
      }

      addEquivalent(unchargedId, itemId);
    }
  }

  for (const [id, item] of Object.entries(items)) {
    const itemId = Number(id);
    const etched = item.mapping?.find(
      ({ id, quantity }) => quantity === 1 && items[id]?.name === `Etched ${item.name.toLowerCase()}`,
    );
    if (etched) {
      addEquivalent(itemId, etched.id);
    }

    const cosmeticBaseNames = cosmeticBases.get(normalize(item.name));
    if (excludedItems.has(itemId) || canonicalIds.has(itemId) || (!cosmeticBaseNames && !item.mapping?.length)) {
      continue;
    }

    const recipeBases = new Set(
      (recipes[itemId] ?? []).flatMap(function cosmeticRecipeBases({ ingredients }) {
        const usesCosmeticKit = ingredients.some(({ itemId }) => isCosmeticKit(items[itemId]));

        return ingredients
          .filter(
            ({ itemId: baseId, quantity }) =>
              quantity === 1 &&
              baseId !== itemId &&
              items[baseId] &&
              !excludedItems.has(baseId) &&
              !isCosmeticKit(items[baseId]) &&
              (cosmeticBaseNames?.has(normalize(items[baseId].name)) || (usesCosmeticKit && mapsTo(item, baseId))),
          )
          .map(({ itemId }) => itemId);
      }),
    );
    if (recipeBases.size !== 1) {
      continue;
    }

    const baseId = recipeBases.values().next().value;
    addEquivalent(baseId, itemId);

    const itemState = /\s*\((?:uncharged|empty|l)\)\s*/g;
    const name = item.name.replace(itemState, " ").trim();
    const family = families.find((ids) => ids.includes(itemId));
    for (const variantId of family ?? []) {
      const variant = items[variantId];
      if (
        variant &&
        !excludedItems.has(variantId) &&
        !canonicalIds.has(variantId) &&
        variant.name !== item.name &&
        variant.name.replace(itemState, " ").trim() === name &&
        (cosmeticBaseNames?.has(normalize(items[baseId].name)) || mapsTo(variant, baseId))
      ) {
        addEquivalent(baseId, variantId);
      }
    }
  }

  return equivalents;
}

function isCosmeticKit(item) {
  return /\b(?:ornament|colou?r) kit$/i.test(item?.name ?? "");
}

function mapsTo(item, itemId) {
  return item.mapping?.some(({ id, quantity }) => id === itemId && quantity === 1);
}

async function loadCosmeticBases() {
  const url = new URL("https://oldschool.runescape.wiki/api.php");
  url.search = new URLSearchParams({ action: "parse", page: "Ornament kit", prop: "wikitext", format: "json" });
  const { parse } = JSON.parse(await fetchWiki(url.toString()));
  const cosmeticBases = new Map();

  for (const [table] of parse.wikitext["*"].matchAll(/^\{\|[\s\S]*?^\|\}/gm)) {
    if (!/^!.*\bUsed on\s*$/m.test(table) || !/^!.*\bCreates\s*$/m.test(table)) {
      continue;
    }

    for (const row of table.split(/^\|-.*$/m).slice(1)) {
      const [usedOn, creates] = row
        .split("\n")
        .map((line) => [...line.matchAll(/\{\{plink[pt]?\|([^|{}\n]+)/gi)])
        .filter((links) => links.length)
        .slice(-2);
      if (usedOn?.length !== 1 || creates?.length !== 1) {
        continue;
      }

      const base = normalize(usedOn[0][1]);
      const variant = normalize(creates[0][1]);
      if (base === variant) {
        continue;
      }

      if (!cosmeticBases.has(variant)) {
        cosmeticBases.set(variant, new Set());
      }
      cosmeticBases.get(variant).add(base);
    }
  }

  if (!cosmeticBases.size) {
    throw new Error('No cosmetic item pairs found on the Wiki page "Ornament kit".');
  }

  return cosmeticBases;
}

async function* readBucket(bucket, fields, orderBy) {
  for (let offset = 0; ; offset += BUCKET_PAGE_SIZE) {
    const url = new URL("https://oldschool.runescape.wiki/api.php");
    const query = `bucket('${bucket}').select(${fields}).orderBy(${orderBy}).limit(${BUCKET_PAGE_SIZE}).offset(${offset}).run()`;
    url.search = new URLSearchParams({ action: "bucket", format: "json", query });
    const { bucket: rows } = JSON.parse(await fetchBucketPage(url));

    if (!Array.isArray(rows)) {
      throw new Error(`Wiki bucket "${bucket}" did not return rows.`);
    }

    yield* rows;
    if (rows.length < BUCKET_PAGE_SIZE) {
      break;
    }
    await setTimeout(200);
  }
}

async function fetchBucketPage(url) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchWiki(url.toString());
    } catch (error) {
      const retryable = error instanceof TypeError || error.status === 429 || error.status >= 500;
      if (!retryable || attempt === 2) {
        throw error;
      }
      await setTimeout(1000 * 2 ** attempt);
    }
  }
}

function normalize(value) {
  return value?.replaceAll("_", " ").trim().toLowerCase() ?? "";
}

function indexItem(index, key, itemId) {
  if (!key) {
    return;
  }

  if (!index.has(key)) {
    index.set(key, new Set());
  }

  index.get(key).add(itemId);
}

async function loadItemResolver(items, canonicalItemIds) {
  const names = new Map();
  const wikiPages = new Map();
  const wikiSections = new Map();
  const wikiImages = new Map();
  const removedItemIds = new Set();
  const currentItemIds = new Set();
  const restrictedItemIds = new Set();
  const publicItemIds = new Set();
  const [{ modes, eventPages }, restrictedPages] = await Promise.all([
    loadSeasonalItemPages(),
    loadRestrictedItemPages(),
  ]);
  for (const [id, item] of Object.entries(items)) {
    indexItem(names, normalize(item.name), Number(id));
  }

  for await (const row of readBucket(
    "infobox_item",
    "'page_name','page_name_sub','item_id','item_name','image','removal_date'",
    "'page_name_sub','asc'",
  )) {
    const title = normalize(row.page_name);
    for (const value of row.item_id ?? []) {
      const id = Number(value);
      if (Number.isSafeInteger(id) && id > 0) {
        if (row.removal_date) {
          removedItemIds.add(id);
        } else {
          currentItemIds.add(id);
          if (items[id] && normalize(items[id].name) === normalize(row.item_name)) {
            const restricted = restrictedPages.has(row.page_name) || eventPages.has(row.page_name);
            (restricted ? restrictedItemIds : publicItemIds).add(id);
          }
        }
        indexItem(wikiPages, title, id);
        indexItem(wikiSections, normalize(row.page_name_sub), id);
        for (const image of row.image ?? []) {
          indexItem(wikiImages, normalize(image), id);
        }
      }
    }
  }

  const seasonal = {};
  for (const [title, mode] of modes) {
    const itemIds = (title.includes("#") ? wikiSections : wikiPages).get(normalize(title));

    for (const id of itemIds ?? []) {
      if (items[id]) {
        seasonal[id] = mode;
      }
    }
  }

  function resolveItem({ name, image, txt }) {
    const [link, linkLabel] = normalize(name).split("|");
    const [title, anchor] = link.split("#");
    const nameIds = names.get(linkLabel || normalize(txt) || (anchor ? "" : title));
    const pageIds = (anchor && wikiSections.get(link)) || wikiPages.get(title);
    const imageIds = wikiImages.get(`file:${normalize(image)}`);
    const pageImageIds = pageIds && imageIds && pageIds.intersection(imageIds);
    const exact = !anchor && !linkLabel ? names.get(title) : undefined;

    if (exact?.size === 1) {
      const [exactId] = exact;
      // Variant recipes can use the base name with an image of the parenthesized variant.
      if (pageIds?.has(exactId) && pageImageIds?.size === 1) {
        const [variantId] = pageImageIds;
        if (normalize(items[variantId]?.name).startsWith(`${title} (`)) {
          return variantId;
        }
      }
      return exactId;
    }

    let candidates = (pageImageIds?.size ? pageImageIds : pageIds) ?? imageIds ?? nameIds ?? new Set();

    if (candidates.size > 1 && nameIds) {
      const intersection = candidates.intersection(nameIds);
      if (intersection.size) {
        candidates = intersection;
      }
    }

    const available = [
      ...new Set([...candidates].filter((id) => items[id]).map((id) => canonicalItemIds.get(id) ?? id)),
    ];
    return available.length === 1 ? available[0] : available.sort((first, second) => first - second);
  }

  return {
    resolveItem,
    seasonal,
    publicItemIds,
    removedItemIds: removedItemIds.difference(currentItemIds),
    restrictedItemIds: restrictedItemIds.difference(publicItemIds),
  };
}

function parseQuantity(quantity) {
  const value = String(quantity).trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)) {
    return;
  }

  const number = Number(value.replaceAll(",", ""));
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

async function buildRecipes(items, cacheItems, itemStates) {
  const canonicalItemIds = new Map(
    Object.entries(itemStates).flatMap(([baseId, variants]) => variants.map((id) => [id, Number(baseId)])),
  );
  const { resolveItem, ...availability } = await loadItemResolver(items, canonicalItemIds);
  const recipes = {};
  const signatures = new Set();
  const unresolved = new Set();
  let invalid = 0;

  function resolvePart(part, page) {
    const itemId = resolveItem(part);
    if (Array.isArray(itemId)) {
      unresolved.add(`${page}: ${part.name} (${itemId.length ? `IDs ${itemId.join(", ")}` : "no item ID"})`);
      return;
    }

    const quantity = parseQuantity(part.quantity);
    return quantity ? { itemId: canonicalItemIds.get(itemId) ?? itemId, quantity } : undefined;
  }

  for await (const row of readBucket("recipe", "'page_name','production_json'", "'production_json','asc'")) {
    let production;
    try {
      production = JSON.parse(row.production_json);
    } catch {
      invalid += 1;
      continue;
    }

    if (!production?.output?.name || !production.materials?.length) {
      invalid += 1;
      continue;
    }

    const output = resolvePart(production.output, row.page_name);
    const materials = production.materials.map(function resolveMaterial(part) {
      return part.name ? resolvePart(part, row.page_name) : undefined;
    });
    if (!output || materials.some((part) => !part)) {
      invalid += 1;
      continue;
    }

    const usesSpellRunes = production.skills?.some(({ name }) => normalize(name) === "magic");
    const ingredients = Object.values(
      materials.reduce(function totalIngredients(totals, { itemId, quantity }) {
        const cacheAlternatives = cacheItems[itemId].alternativeRunes ?? [];
        const elementalAlternatives = ELEMENTAL_COMBINATION_RUNES[itemId] ?? [];
        const runeAlternatives = usesSpellRunes ? [...cacheAlternatives, ...elementalAlternatives] : [];
        const inventoryAlternatives = (itemStates[itemId] ?? []).filter(
          (variantId) => !cacheItems[variantId].gameVal.endsWith("_dummy"),
        );
        const alternatives = [...new Set([...inventoryAlternatives, ...runeAlternatives])].filter(
          (alternativeId) => items[alternativeId],
        );
        const ingredient = (totals[itemId] ??= {
          itemId,
          quantity: 0,
          ...(alternatives.length ? { alternatives } : {}),
        });
        ingredient.quantity += quantity;
        return totals;
      }, {}),
    );
    const skills = (production.skills ?? []).map(({ name, level }) => [name, level].filter(Boolean).join(" "));
    const description = [production.output.subtxt, production.tools, production.facilities, ...skills]
      .filter((text) => typeof text === "string" && text.trim())
      .map((text) => text.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1").trim());
    if (production.facilities === "Ilfeen") {
      description.push("minimum price");
    }
    const label = [...new Set(description)].join(", ");
    const page = normalize(row.page_name) === normalize(items[output.itemId].name) ? undefined : row.page_name;
    const method = { quantity: output.quantity, ingredients, ...(label ? { label } : {}), ...(page ? { page } : {}) };
    const signature = JSON.stringify([output.itemId, method]);
    if (!signatures.has(signature)) {
      signatures.add(signature);
      (recipes[output.itemId] ??= []).push(method);
    }
  }

  if (!signatures.size) {
    throw new Error("The Wiki recipe bucket did not produce any usable recipes.");
  }

  for (const methods of Object.values(recipes)) {
    methods.sort(
      (first, second) =>
        first.ingredients.length - second.ingredients.length ||
        first.ingredients.reduce(
          (difference, ingredient, index) => difference || ingredient.itemId - second.ingredients[index].itemId,
          0,
        ),
    );
  }

  for (const entry of [...unresolved].sort()) {
    console.warn(`Unresolved Wiki recipe item: ${entry}`);
  }
  console.info(
    `Imported ${signatures.size} recipes for ${Object.keys(recipes).length} items. Skipped ${invalid} unusable records.`,
  );
  return { recipes, ...availability };
}

async function buildWantedItems(catalogue, cacheItems, itemVariations) {
  console.info("\nStep: Build wanted-items.json");
  const items = {};
  const unavailable = new Set();
  for (const [itemId, item] of Object.entries(catalogue)) {
    const { gameVal = "", legacy, trackingPlaceholder, unbankable } = cacheItems[itemId];
    if (
      legacy ||
      trackingPlaceholder ||
      /^(?:(?:cert_)?beta_|placeholder_|nosave_)/.test(gameVal) ||
      (unbankable && gameVal.startsWith("magictraining_"))
    ) {
      unavailable.add(Number(itemId));
    } else if (!item.lastManStanding) {
      items[itemId] = item;
    }
  }

  const itemStates = buildItemStateVariants(items, cacheItems, itemVariations);
  const [{ unavailable: wikiUnavailable, ownable }, wikiItems, cosmeticBases] = await Promise.all([
    loadUnavailableItemIds(items),
    buildRecipes(items, cacheItems, itemStates),
    loadCosmeticBases(),
  ]);
  const { recipes, seasonal, publicItemIds, removedItemIds, restrictedItemIds } = wikiItems;
  for (const id of Object.keys(items)) {
    const itemId = Number(id);
    const { gameVal = "", hasConstructionLevel, tradeable } = cacheItems[itemId];

    if (
      !tradeable &&
      !publicItemIds.has(itemId) &&
      (INTERFACE_GAMEVAL.test(gameVal) || (hasConstructionLevel && /(?:^|_)poh_/.test(gameVal)))
    ) {
      wikiUnavailable.add(itemId);
    }
  }

  for (const itemId of wikiUnavailable.union(removedItemIds).union(restrictedItemIds.difference(ownable))) {
    if (!items[itemId]) {
      continue;
    }

    unavailable.add(itemId);

    for (const variantId of itemStates[itemId] ?? []) {
      if (cacheItems[variantId].gameVal.endsWith("_dummy")) {
        unavailable.add(variantId);
      }
    }
  }

  const excludedItems = unavailable.union(new Set(Object.keys(seasonal).map(Number)));
  const equivalents = buildEquivalents({
    items,
    cacheItems,
    itemVariations,
    recipes,
    itemStates,
    excludedItems,
    cosmeticBases,
  });
  const sortedUnavailable = [...unavailable].sort((first, second) => first - second);
  return { wantedItems: { equivalents, unavailable: sortedUnavailable, seasonal }, recipes };
}

module.exports = { buildWantedItems };
