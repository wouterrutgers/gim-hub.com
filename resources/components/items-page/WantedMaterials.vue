<script setup>
  import { computed } from "vue";
  import { wantedMaterialPlan } from "../../game/wanted-items";
  import WantedRecipe from "./WantedRecipe.vue";

  const props = defineProps({
    itemId: { type: Number, required: true },
    quantity: { type: Number, required: true },
    groupItems: { type: Map, required: true },
    itemName: { type: Function, required: true },
    itemIcon: { type: Function, required: true },
    recipes: { type: Object, required: true },
    view: { type: Object, required: true },
  });
  defineEmits(["open-change", "choose-method", "toggle-material"]);

  const closedBranches = new Set();

  const plan = computed(function buildPlan() {
    return wantedMaterialPlan(
      props.groupItems,
      props.recipes,
      props.itemId,
      props.quantity,
      props.view.choices,
      props.view.open ? props.view.expanded : closedBranches,
    );
  });
  const summary = computed(() =>
    plan.value?.ingredients.some(({ quantity }) => quantity > 0n) ? "Materials still needed" : "Materials ready",
  );
</script>

<template>
  <details v-if="plan" class="wanted-ingredients" :open="view.open" @toggle="$emit('open-change', $event.target.open)">
    <summary class="wanted-materials-title" :aria-label="`${summary} for ${itemName(itemId)}`">{{ summary }}</summary>
    <div v-if="view.open" class="wanted-materials-body">
      <WantedRecipe
        :plan="plan"
        :item-name="itemName"
        :item-icon="itemIcon"
        @choose-method="$emit('choose-method', $event)"
        @toggle-material="$emit('toggle-material', $event)"
      />
    </div>
  </details>
</template>
