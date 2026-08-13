<script setup>
  import "./search-element.css";

  const props = defineProps({
    id: { type: String, default: undefined },
    className: { type: String, default: "" },
    defaultValue: { type: String, default: undefined },
    value: { type: String, default: undefined },
    placeholder: { type: String, required: true },
  });
  const emit = defineEmits(["change"]);

  function change(event) {
    emit("change", event.target.value);
  }
</script>

<template>
  <div :id="props.id">
    <input
      :class="['search-element-input', props.className]"
      :placeholder="props.placeholder"
      type="text"
      tabindex="0"
      :value="props.value ?? props.defaultValue"
      @input="change"
    />
  </div>
</template>
