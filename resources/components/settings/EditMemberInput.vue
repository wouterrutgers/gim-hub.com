<script setup>
  import { computed, ref } from "vue";
  import * as z from "zod/v4";
  import { useApiStore } from "../../stores/api";
  import { useGroupStore } from "../../stores/group";
  import { memberColorHues } from "../../game/member-colors";
  import { memberNameSchema } from "../../game/member-name";
  import CachedImage from "../cached-image/CachedImage.vue";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import RemoveConfirmationWindow from "./RemoveConfirmationWindow.vue";

  const props = defineProps({
    member: { type: String, required: true },
  });

  const apiStore = useApiStore();
  const groupStore = useGroupStore();

  const nameInput = ref();
  const pendingRename = ref(false);
  const pendingDelete = ref(false);
  const errors = ref();
  const { open: modalOpen, componentProps: modalProps, openModal, closeModal } = useModal();

  const pending = computed(function isPending() {
    return pendingDelete.value || pendingRename.value;
  });
  const hueDegrees = computed(function getHueDegrees() {
    return groupStore.memberColors.get(props.member)?.hueDegrees;
  });
  const errorId = computed(function getErrorId() {
    return `edit-member-errors-${props.member}`;
  });

  async function renameMember() {
    if (pendingRename.value || !apiStore.client || !nameInput.value) {
      return;
    }

    const name = memberNameSchema.safeParse(nameInput.value.value.trim());

    if (!name.success) {
      errors.value = z.flattenError(name.error).formErrors;

      return;
    }

    if (name.data === props.member) {
      errors.value = ["New name must be different than the current one."];

      return;
    }

    pendingRename.value = true;

    try {
      const [result] = await Promise.allSettled([
        apiStore.client.renameGroupMember({ oldName: props.member, newName: name.data }),
        new Promise(function waitForLoadingState(resolve) {
          window.setTimeout(resolve, 1000);
        }),
      ]);

      if (result.status === "rejected") {
        throw result.reason;
      }

      if (result.value.status === "error") {
        errors.value = [result.value.text];
        pendingRename.value = false;

        return;
      }

      errors.value = undefined;
    } catch (reason) {
      console.error("Rename Member Failed:", reason);
      errors.value = ["Failed to rename. Is the name already in use?"];
      pendingRename.value = false;
    }
  }

  async function removeMember() {
    if (pendingDelete.value || !apiStore.client) {
      return;
    }

    pendingDelete.value = true;

    try {
      const [result] = await Promise.allSettled([
        apiStore.client.deleteGroupMember(props.member),
        new Promise(function waitForLoadingState(resolve) {
          window.setTimeout(resolve, 1000);
        }),
      ]);

      if (result.status === "rejected") {
        throw result.reason;
      }

      if (result.value.status === "error") {
        errors.value = [result.value.text];
        pendingDelete.value = false;

        return;
      }

      errors.value = undefined;
    } catch (reason) {
      console.error("Delete Member Failed:", reason);
      errors.value = ["Unknown error."];
      pendingDelete.value = false;
    }
  }

  async function updateColor(hue) {
    if (!apiStore.client) {
      return;
    }

    try {
      const response = await apiStore.client.updateMemberColor({ memberName: props.member, colorHueDegrees: hue });

      if (response.status === "error") {
        errors.value = [response.text];

        return;
      }

      const updates = [{ name: props.member, hueDegrees: response.updated.color_hue_degrees }];

      if (response.swapped) {
        updates.push({ name: response.swapped.name, hueDegrees: response.swapped.color_hue_degrees });
      }

      groupStore.updateMemberColors(updates);
      errors.value = undefined;
    } catch (reason) {
      console.error("Update Member Color Failed:", reason);
      errors.value = ["Failed to update color."];
    }
  }

  function colorIsTaken(hue) {
    if (hueDegrees.value === hue) {
      return false;
    }

    return [...groupStore.memberColors].some(function memberHasHue([name, color]) {
      return color.hueDegrees === hue && name !== props.member && name !== "@SHARED";
    });
  }
</script>

<template>
  <div class="group-settings-member-section rsborder-tiny">
    <div class="group-settings-member-title">
      <h3><PlayerIcon :name="props.member" />{{ props.member }}</h3>
      <button
        :disabled="pending"
        class="group-settings-member-remove men-button small"
        @click="openModal({ member: props.member, onConfirm: removeMember })"
      >
        Remove
      </button>
    </div>

    <div class="group-settings-member-name">
      <label :for="`edit-member-${props.member}`">New name</label>
      <div class="group-settings-member-name-input">
        <input
          :id="`edit-member-${props.member}`"
          ref="nameInput"
          :aria-describedby="errorId"
          :disabled="pending"
          :class="errors?.length ? 'invalid' : 'valid'"
          :value="props.member"
          maxlength="12"
          @blur="$event.target.value = $event.target.value.trim()"
        />
        <button :disabled="pending" class="men-button small" @click="renameMember">Rename</button>
      </div>
      <div v-if="errors?.length" :id="errorId" class="validation-error">
        <template v-for="(error, index) in errors" :key="error"><br v-if="index > 0" />{{ error }}</template>
      </div>
    </div>

    <div class="group-settings-member-color">
      <label>Color</label>
      <div class="group-settings-member-color-options" role="group" aria-label="Member color">
        <button
          v-for="hue in memberColorHues"
          :key="hue"
          :class="['group-settings-member-color-option', { selected: hueDegrees === hue, taken: colorIsTaken(hue) }]"
          :aria-pressed="hueDegrees === hue"
          @click="updateColor(hue)"
        >
          <CachedImage
            :alt="`Player icon for ${props.member}`"
            src="/ui/player-icon.webp"
            :style="{ filter: `hue-rotate(${hue}deg) saturate(100%)` }"
            width="12"
            height="15"
          />
        </button>
      </div>
    </div>

    <div v-if="pending" class="group-settings-pending-overlay"><LoadingScreen /></div>
    <Modal :open="modalOpen" :component="RemoveConfirmationWindow" :component-props="modalProps" @close="closeModal" />
  </div>
</template>
