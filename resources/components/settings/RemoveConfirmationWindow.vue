<script setup>
  import { computed, ref } from "vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";

  const props = defineProps({
    member: { type: String, required: true },
    onConfirm: { type: Function, required: true },
  });
  const emit = defineEmits(["close"]);

  const input = ref();

  const inputMatchesMember = computed(function inputMatchesMember() {
    return input.value?.trim() === props.member;
  });

  function confirm() {
    if (!inputMatchesMember.value) {
      return;
    }

    props.onConfirm();
    emit("close");
  }
</script>

<template>
  <div id="group-settings-remove-confirmation" class="rsbackground rsborder">
    <h1>Delete <PlayerIcon :name="props.member" /> {{ props.member }}?</h1>
    <p>All player data will be lost and cannot be recovered.</p>
    <label for="group-settings-remove-confirmation-input">
      Please type "{{ props.member }}" below to proceed with deletion.
    </label>
    <br />
    <input id="group-settings-remove-confirmation-input" v-model="input" />
    <button :disabled="!inputMatchesMember" class="group-settings-member-remove men-button small" @click="confirm">
      Yes, delete {{ props.member }} from the group.
    </button>
    <button class="men-button small" @click="emit('close')">No, do not delete {{ props.member }}.</button>
  </div>
</template>
