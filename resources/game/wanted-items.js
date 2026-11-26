import { itemQuantityBreakdown } from "./member";
import { equivalents, unavailable } from "./wanted-items.json";

const variants = new Map(
  Object.entries(equivalents).flatMap(function mapVariants([itemId, itemVariants]) {
    return itemVariants.map(function mapVariant(variant) {
      return [variant, Number(itemId)];
    });
  }),
);
const excludedMembers = new Set();
const unavailableItems = new Set(unavailable);

export function isWantedCatalogueItem(itemId, item) {
  return !item.lastManStanding && !unavailableItems.has(itemId);
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

  function spendStock(id, required) {
    const owned = available.get(id) ?? BigInt(stockQuantity(groupItems, id));
    const used = owned < required ? owned : required;
    available.set(id, owned - used);

    return required - used;
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
      ingredients: ingredients.map(function materialRequirement(ingredient) {
        const required = BigInt(ingredient.quantity) * batches;

        return { ...ingredient, path: `${path}/${ingredient.itemId}`, required, quantity: required };
      }),
    };
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

  for (let plans = [root]; plans.length;) {
    // Reserve exact materials across the whole level before considering substitutes.
    for (const plan of plans) {
      for (const ingredient of plan.ingredients) {
        ingredient.quantity = spendStock(ingredient.itemId, ingredient.quantity);
      }
    }

    const nextPlans = [];

    for (const plan of plans) {
      const substitutes = new Set(plan.ingredients.flatMap(({ alternatives }) => alternatives ?? []));

      for (const substitute of substitutes) {
        const runeIngredients = plan.ingredients.filter(({ alternatives }) => alternatives?.includes(substitute));
        const required = runeIngredients.reduce(
          (maximum, ingredient) => (ingredient.quantity > maximum ? ingredient.quantity : maximum),
          0n,
        );
        const used = required - spendStock(substitute, required);

        for (const ingredient of runeIngredients) {
          ingredient.quantity = ingredient.quantity > used ? ingredient.quantity - used : 0n;
        }
      }

      for (const ingredient of plan.ingredients) {
        const methods = recipes[ingredient.itemId];

        if (!ingredient.quantity || !methods) {
          continue;
        }

        const ancestors = new Set([...plan.ancestors, ingredient.itemId]);
        const childMethods = plan.ancestors.has(ingredient.itemId)
          ? []
          : methods.filter(({ ingredients }) => ingredients.every(({ itemId }) => !ancestors.has(itemId)));

        if (childMethods.length) {
          ingredient.expandable = true;

          if (expanded.has(ingredient.path)) {
            ingredient.plan = createPlan(
              childMethods,
              ingredient.itemId,
              ingredient.quantity,
              ingredient.path,
              ancestors,
            );
            nextPlans.push(ingredient.plan);
          }
        } else {
          ingredient.blocked = true;
        }
      }
    }

    plans = nextPlans;
  }

  return root;
}
