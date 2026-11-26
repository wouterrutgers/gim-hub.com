import { itemQuantityBreakdown } from "./member";
import { equivalents, seasonal, unavailable } from "./wanted-items.json";

const variants = new Map(
  Object.entries(equivalents).flatMap(function mapVariants([itemId, itemVariants]) {
    return itemVariants.map(function mapVariant(variant) {
      return [variant, Number(itemId)];
    });
  }),
);
const excludedMembers = new Set();
const unavailableItems = new Set(unavailable);
const seasonalLabels = { deadman: "Deadman only", leagues: "Leagues item" };

export function wantedSeasonalLabel(itemId) {
  return seasonalLabels[seasonal[itemId]];
}

export function isWantedCatalogueItem(itemId, item) {
  return !item.lastManStanding && !unavailableItems.has(itemId) && !Object.hasOwn(seasonal, itemId);
}

export function wantedItemId(itemId) {
  return variants.get(itemId) ?? itemId;
}

function stockItemIds(itemId) {
  const baseId = wantedItemId(itemId);

  return [...new Set([itemId, baseId, ...(equivalents[baseId] ?? [])])];
}

function stockQuantity(groupItems, itemId) {
  const breakdown = groupItems.get(itemId);

  return breakdown
    ? itemQuantityBreakdown(breakdown, excludedMembers, "All").reduce((quantity, owner) => quantity + owner.quantity, 0)
    : 0;
}

export function wantedOwnedQuantity(groupItems, itemId) {
  return stockItemIds(itemId).reduce((quantity, id) => quantity + stockQuantity(groupItems, id), 0);
}

export function wantedItemProgress(groupItems, { item_id: itemId, target_quantity: target }) {
  const owned = wantedOwnedQuantity(groupItems, itemId);

  return { owned, needed: Math.max(target - owned, 0) };
}

export function wantedMaterialPlan(groupItems, recipes, itemId, quantity, choices, expanded) {
  const targetIds = new Set(stockItemIds(itemId));
  // Existing copies of the target already count towards the goal.
  const available = new Map([...targetIds].map((id) => [id, 0n]));
  const surplus = new Map();

  function spendStock(id, required) {
    const owned = available.get(id) ?? BigInt(stockQuantity(groupItems, id));
    const used = owned < required ? owned : required;
    available.set(id, owned - used);

    return required - used;
  }

  function dependsOn(plan, target, visited = new Set()) {
    if (plan === target) {
      return true;
    }

    if (visited.has(plan)) {
      return false;
    }

    visited.add(plan);

    return [...plan.dependencies].some((dependency) => dependsOn(dependency, target, visited));
  }

  function spendSurplus(plan, ingredient) {
    for (const batch of surplus.get(ingredient.itemId) ?? []) {
      if (!ingredient.quantity) {
        break;
      }

      if (!batch.remaining || dependsOn(batch.plan, plan)) {
        continue;
      }

      const used = batch.remaining < ingredient.quantity ? batch.remaining : ingredient.quantity;
      batch.remaining -= used;
      ingredient.quantity -= used;
      ingredient.fromSurplus += used;
      plan.dependencies.add(batch.plan);
    }
  }

  function createPlan(methods, outputId, required, path, ancestors) {
    const methodIndex = choices.get(path) ?? 0;
    const { quantity: outputQuantity, ingredients } = methods[methodIndex];
    const batchSize = BigInt(outputQuantity);
    const batches = (required + batchSize - 1n) / batchSize;

    return {
      itemId: outputId,
      path,
      methods,
      methodIndex,
      batchSize,
      batches,
      ancestors,
      dependencies: new Set(),
      ingredients: ingredients.map(function materialRequirement(ingredient) {
        const required = BigInt(ingredient.quantity) * batches;

        return { ...ingredient, path: `${path}/${ingredient.itemId}`, required, quantity: required, fromSurplus: 0n };
      }),
    };
  }

  function planIngredient(plan, ingredient) {
    spendSurplus(plan, ingredient);

    const methods = recipes[ingredient.itemId];

    if (!ingredient.quantity || !methods) {
      return;
    }

    const ancestors = new Set([...plan.ancestors, ingredient.itemId]);
    const childMethods = plan.ancestors.has(ingredient.itemId)
      ? []
      : methods.filter(({ ingredients }) => ingredients.every(({ itemId }) => !ancestors.has(itemId)));

    if (!childMethods.length) {
      ingredient.blocked = true;

      return;
    }

    ingredient.expandable = true;

    if (!expanded.has(ingredient.path)) {
      return;
    }

    const child = createPlan(childMethods, ingredient.itemId, ingredient.quantity, ingredient.path, ancestors);
    ingredient.plan = child;
    plan.dependencies.add(child);

    const remaining = child.batches * child.batchSize - ingredient.quantity;

    if (remaining) {
      if (!surplus.has(ingredient.itemId)) {
        surplus.set(ingredient.itemId, []);
      }

      surplus.get(ingredient.itemId).push({ plan: child, remaining });
    }

    return child;
  }

  const methods = [...targetIds].flatMap(function goalMethods(outputId) {
    return (recipes[outputId] ?? [])
      .filter((method) => !method.ingredients.some((ingredient) => targetIds.has(ingredient.itemId)))
      .map((method) => ({ ...method, outputId }));
  });

  if (!methods.length) {
    return;
  }

  const root = createPlan(methods, itemId, BigInt(quantity), "", targetIds);
  const collapsedIngredients = [];

  for (let plans = [root]; plans.length;) {
    // Reserve exact materials across the whole level before considering substitutes.
    for (const plan of plans) {
      for (const ingredient of plan.ingredients) {
        ingredient.quantity = spendStock(ingredient.itemId, ingredient.quantity);
      }
    }

    const nextPlans = [];

    for (const plan of plans) {
      const missingRunes = plan.ingredients.filter(({ quantity, alternatives }) => quantity && alternatives?.length);
      const substitutes = [...new Set(missingRunes.flatMap(({ alternatives }) => alternatives))].map(
        function groupRuneShortages(itemId) {
          return { itemId, runes: missingRunes.filter(({ alternatives }) => alternatives.includes(itemId)) };
        },
      );

      substitutes.sort((first, second) => second.runes.length - first.runes.length);

      for (const { itemId, runes } of substitutes) {
        const required = runes.reduce(
          (maximum, ingredient) => (ingredient.quantity > maximum ? ingredient.quantity : maximum),
          0n,
        );
        const used = required - spendStock(itemId, required);

        for (const ingredient of runes) {
          ingredient.quantity = ingredient.quantity > used ? ingredient.quantity - used : 0n;
        }
      }

      for (const ingredient of plan.ingredients) {
        if (!ingredient.quantity) {
          continue;
        }

        if (!expanded.has(ingredient.path)) {
          collapsedIngredients.push({ plan, ingredient });

          continue;
        }

        const child = planIngredient(plan, ingredient);

        if (child) {
          nextPlans.push(child);
        }
      }
    }

    plans = nextPlans;
  }

  for (const { plan, ingredient } of collapsedIngredients) {
    planIngredient(plan, ingredient);
  }

  return root;
}
