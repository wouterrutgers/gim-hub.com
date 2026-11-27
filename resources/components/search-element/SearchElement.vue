<script setup>
  import { ref } from "vue";
  import "./search-element.css";

  const props = defineProps({
    id: { type: String, default: undefined },
    className: { type: String, default: "" },
    defaultValue: { type: String, default: undefined },
    value: { type: String, default: undefined },
    placeholder: { type: String, required: true },
    clearable: Boolean,
  });
  const emit = defineEmits(["change"]);
  const input = ref();

  function change(event) {
    emit("change", event.target.value);
  }

  function clearSearch() {
    emit("change", "");
    input.value.focus();
  }
</script>

<template>
  <div :id="props.id" class="search-element">
    <input
      ref="input"
      :class="['search-element-input', props.className]"
      :placeholder="props.placeholder"
      :aria-label="props.placeholder"
      type="text"
      tabindex="0"
      :value="props.value ?? props.defaultValue"
      @input="change"
    />
    <button
      v-if="props.clearable && (props.value ?? props.defaultValue)"
      type="button"
      class="search-element-clear"
      aria-label="Clear search"
      @click="clearSearch"
    >
      ×
    </button>
  </div>
</template>
