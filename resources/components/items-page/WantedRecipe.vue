<script setup>
  import { computed, nextTick, ref, useId } from "vue";
  import WantedMaterialLabel from "./WantedMaterialLabel.vue";

  const props = defineProps({
    plan: { type: Object, required: true },
    itemName: { type: Function, required: true },
    itemIcon: { type: Function, required: true },
  });
  const emit = defineEmits(["choose-method", "toggle-material"]);
  const methodId = useId();
  const announcement = ref("");
  const selected = computed(() => props.plan.methods[props.plan.methodIndex]);
  const missingCount = computed(() => props.plan.ingredients.filter(({ quantity }) => quantity > 0n).length);
  const coveredStatus = computed(() =>
    props.plan.ingredients.some(({ fromSurplus }) => fromSurplus) ? "Materials covered" : "Materials ready",
  );
  const item = computed(() => props.itemName(props.plan.itemId));
  const sourceUrl = computed(function recipeSource() {
    const method = selected.value;
    const title = method.page ?? props.itemName(method.outputId ?? props.plan.itemId);

    return `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
  });
  const optionLabels = computed(function describeMethods() {
    const methods = props.plan.methods;
    const outputDiffers = methods.some(
      (method) => method.quantity !== methods[0].quantity || method.outputId !== methods[0].outputId,
    );
    const options = methods.map(function describeOption(method) {
      const differingInputs = method.ingredients.filter(({ itemId, quantity }) =>
        methods.some(
          (other) => !other.ingredients.some((input) => input.itemId === itemId && input.quantity === quantity),
        ),
      );
      const inputs = differingInputs.length ? differingInputs : method.ingredients;
      const ingredients = inputs
        .map(function describeInput({ itemId, quantity }) {
          const quantityDiffers = methods.some((other) =>
            other.ingredients.some((input) => input.itemId === itemId && input.quantity !== quantity),
          );

          return quantityDiffers ? describeItem(itemId, quantity) : props.itemName(itemId);
        })
        .join(" + ");
      const label = differingInputs.length || !method.label ? ingredients : method.label;

      return {
        label: outputDiffers
          ? `${describeItem(method.outputId ?? props.plan.itemId, method.quantity)} from ${label}`
          : label,
        ingredients,
        methodLabel: method.label,
        shortMethod: method.label?.split(", ", 1)[0],
        ids: [
          ...(outputDiffers && method.outputId ? [method.outputId] : []),
          ...inputs.map(({ itemId }) => itemId),
        ].join(", "),
        page: method.page,
      };
    });

    const labels = options.map(function distinguishMethod(option) {
      const matches = options.filter((other) => other !== option && other.label === option.label);

      if (!matches.length || !option.methodLabel) {
        return option.label;
      }

      const method = matches.some((other) => other.shortMethod === option.shortMethod)
        ? option.methodLabel
        : option.shortMethod;

      return `${method} | ${option.ingredients}`;
    });

    return labels.map(function distinguishSource(label, index) {
      if (labels.indexOf(label) === labels.lastIndexOf(label)) {
        return label;
      }

      const { page, ids } = options[index];
      const pageDiffers =
        page &&
        !options.some(
          (other, otherIndex) => index !== otherIndex && labels[otherIndex] === label && other.page === page,
        );

      return `${pageDiffers ? page : `Item IDs ${ids}`} | ${label}`;
    });
  });

  async function chooseMethod(event) {
    emit("choose-method", { path: props.plan.path, index: Number(event.target.value) });
    announcement.value = "";
    await nextTick();
    const count = missingCount.value;
    announcement.value = count
      ? `${item.value}: ${count} ${count === 1 ? "material" : "materials"} still needed.`
      : `${item.value}: ${coveredStatus.value.toLowerCase()}.`;
  }

  function describeItem(itemId, quantity) {
    return `${quantity.toLocaleString()} × ${props.itemName(itemId)}`;
  }
</script>

<template>
  <div class="wanted-recipe">
    <div class="wanted-recipe-meta">
      <div class="wanted-recipe-requirements">
        <span v-if="selected.label">{{ selected.label }}</span>
        <span v-if="plan.batchSize > 1n">
          {{ plan.batches.toLocaleString() }} {{ plan.batches === 1n ? "batch" : "batches" }} of
          {{ plan.batchSize.toLocaleString() }}
        </span>
      </div>
      <a
        :href="sourceUrl"
        target="_blank"
        rel="noopener"
        class="wanted-recipe-source"
        :aria-label="`Wiki recipe for ${item}`"
      >
        Wiki <span aria-hidden="true">↗</span>
      </a>
    </div>
    <div v-if="plan.methods.length > 1" class="wanted-method">
      <label :for="methodId">Making method<span class="visually-hidden"> for {{ item }}</span></label>
      <span class="select-container">
        <select :id="methodId" class="search-element-input" :value="plan.methodIndex" @change="chooseMethod">
          <option v-for="(label, index) in optionLabels" :key="index" :value="index">{{ label }}</option>
        </select>
      </span>
      <span class="visually-hidden" role="status">{{ announcement }}</span>
    </div>
    <p v-if="plan.path && !missingCount" class="wanted-recipe-ready">{{ coveredStatus }}</p>
    <ul class="wanted-material-list" role="list">
      <li v-for="ingredient in plan.ingredients" :key="ingredient.itemId">
        <details
          v-if="ingredient.expandable"
          :open="Boolean(ingredient.plan)"
          @toggle="$emit('toggle-material', { path: ingredient.path, open: $event.target.open })"
        >
          <summary class="wanted-material-row">
            <WantedMaterialLabel
              :name="itemName(ingredient.itemId)"
              :icon="itemIcon(ingredient.itemId)"
              :quantity="ingredient.quantity"
              :required="ingredient.required"
              :from-surplus="ingredient.fromSurplus"
            />
          </summary>
          <WantedRecipe
            v-if="ingredient.plan"
            class="wanted-recipe-branch"
            :plan="ingredient.plan"
            :item-name="itemName"
            :item-icon="itemIcon"
            @choose-method="$emit('choose-method', $event)"
            @toggle-material="$emit('toggle-material', $event)"
          />
        </details>
        <template v-else>
          <div class="wanted-material-row">
            <WantedMaterialLabel
              :name="itemName(ingredient.itemId)"
              :icon="itemIcon(ingredient.itemId)"
              :quantity="ingredient.quantity"
              :required="ingredient.required"
              :from-surplus="ingredient.fromSurplus"
            />
          </div>
          <p v-if="ingredient.blocked" class="wanted-material-blocked">
            Recipe requires an item already missing above.
          </p>
        </template>
      </li>
    </ul>
  </div>
</template>
