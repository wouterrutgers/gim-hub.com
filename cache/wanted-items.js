const { setTimeout } = require("node:timers/promises");
const fetchWiki = require("./wiki");

const BUCKET_PAGE_SIZE = 500;
const ELEMENTAL_COMBINATION_RUNES = {
  554: [4694, 4697, 4699], // Fire: steam, smoke, lava
  555: [4694, 4695, 4698], // Water: steam, mist, mud
  556: [4695, 4696, 4697], // Air: mist, dust, smoke
  557: [4696, 4698, 4699], // Earth: dust, mud, lava
};

function buildEquivalents(items, itemVariations, recipes) {
  const equivalents = {};
  for (const [baseId, ...variantIds] of Object.values(itemVariations)) {
    const base = items[baseId];
    if (!base) {
      continue;
    }

    const family = new Set([baseId, ...variantIds]);
    for (const variantId of variantIds) {
      const variant = items[variantId];
      const equivalentNames = [`${base.name} (or)`, `${base.name} (s)`, `${base.name} (empty)`];
      if (variant && equivalentNames.includes(variant.name) && (mapsTo(variant, baseId) || mapsTo(base, variantId))) {
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
        const canonicalId = recipeBases.values().next().value ?? baseId;
        (equivalents[canonicalId] ??= []).push(variantId);
      }
    }
  }

  for (const [itemId, item] of Object.entries(items)) {
    const etched = item.mapping?.find(
      ({ id, quantity }) => quantity === 1 && items[id]?.name === `Etched ${item.name.toLowerCase()}`,
    );
    if (etched) {
      (equivalents[itemId] ??= []).push(etched.id);
    }
  }

  return equivalents;
}

function mapsTo(item, itemId) {
  return item.mapping?.some(({ id, quantity }) => id === itemId && quantity === 1);
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

async function loadItemResolver(items) {
  const names = new Map();
  const wikiPages = new Map();
  const wikiSections = new Map();
  const wikiImages = new Map();
  for (const [id, item] of Object.entries(items)) {
    indexItem(names, normalize(item.name), Number(id));
  }

  for await (const row of readBucket(
    "infobox_item",
    "'page_name','page_name_sub','item_id','image'",
    "'page_name_sub','asc'",
  )) {
    const title = normalize(row.page_name);
    for (const value of row.item_id ?? []) {
      const id = Number(value);
      if (Number.isSafeInteger(id) && id > 0) {
        indexItem(wikiPages, title, id);
        indexItem(wikiSections, normalize(row.page_name_sub), id);
        for (const image of row.image ?? []) {
          indexItem(wikiImages, normalize(image), id);
        }
      }
    }
  }

  return function resolveItem({ name, image, txt }) {
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

    const available = [...candidates].filter((id) => items[id]);
    return available.length === 1 ? available[0] : available.sort((first, second) => first - second);
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

async function buildRecipes(items, cacheItems) {
  const resolveItem = await loadItemResolver(items);
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
    return quantity ? { itemId, quantity } : undefined;
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
        const alternatives = usesSpellRunes
          ? [...new Set([...cacheAlternatives, ...elementalAlternatives])].filter(
              (alternativeId) => items[alternativeId],
            )
          : undefined;
        const ingredient = (totals[itemId] ??= {
          itemId,
          quantity: 0,
          ...(alternatives?.length ? { alternatives } : {}),
        });
        ingredient.quantity += quantity;
        return totals;
      }, {}),
    );
    const skills = (production.skills ?? []).map(({ name, level }) => [name, level].filter(Boolean).join(" "));
    const description = [production.output.subtxt, production.tools, production.facilities, ...skills]
      .filter((text) => typeof text === "string" && text.trim())
      .map((text) => text.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1").trim());
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
  return recipes;
}

async function buildWantedItems(catalogue, cacheItems, itemVariations) {
  console.info("\nStep: Build wanted-items.json");
  const items = {};
  const unavailable = [];
  for (const [itemId, item] of Object.entries(catalogue)) {
    if (cacheItems[itemId].legacy) {
      unavailable.push(Number(itemId));
    } else if (!item.lastManStanding) {
      items[itemId] = item;
    }
  }

  const recipes = await buildRecipes(items, cacheItems);
  const equivalents = buildEquivalents(items, itemVariations, recipes);
  return { wantedItems: { equivalents, unavailable }, recipes };
}

module.exports = { buildWantedItems };
