<script setup>
  import { computed, ref } from "vue";
  import { useRouter } from "vue-router";
  import * as z from "zod/v4";
  import { fetchCreateGroup } from "../../api/requests/create-group";
  import { useApiStore } from "../../stores/api";
  import { memberNameSchema } from "../../game/member-name";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import "./create-group-page.css";

  const groupNameSchema = z
    .string("Group name is required.")
    .refine(
      function hasNoOuterSpaces(name) {
        return name === name.trim();
      },
      { error: "Group name cannot begin or end with spaces." },
    )
    .refine(
      function hasAllowedCharacters(name) {
        return !/[^A-Za-z 0-9-_]/g.test(name);
      },
      { error: "Group name must use characters 'A-Z', 'a-z', '0-9', and '-', '_', or ' '." },
    )
    .refine(
      function hasValidLength(name) {
        return name.length >= 1 && name.length <= 16;
      },
      {
        error({ input }) {
          return input.length === 0 ? "Group name is required." : "Group name must be between 1 and 16 characters.";
        },
      },
    )
    .transform(function trimGroupName(name) {
      return name.trim();
    });
  const memberCountSchema = z.coerce
    .number()
    .int()
    .min(2, "Group size must be between 2 and 5.")
    .max(5, "Group size must be between 2 and 5.");
  const memberNamesSchema = z.array(memberNameSchema).nonempty();

  const apiStore = useApiStore();
  const router = useRouter();

  const memberCount = ref();
  const pending = ref(false);
  const formState = ref({ type: "Pending" });

  const groupNameErrors = computed(function getGroupNameErrors() {
    return formState.value.type === "Pending" ? formState.value.groupNameErrors : undefined;
  });
  const memberCountErrors = computed(function getMemberCountErrors() {
    return formState.value.type === "Pending" ? formState.value.memberCountErrors : undefined;
  });
  const memberInputIndexes = computed(function getMemberInputIndexes() {
    return Array.from({ length: memberCount.value ?? 0 }, function getIndex(_value, index) {
      return index;
    });
  });

  async function createGroup(formData) {
    const groupName = groupNameSchema.safeParse(formData.get("group-name"));
    const memberCount = memberCountSchema.safeParse(formData.get("group-member-count"));
    const memberNamesRaw = formData.getAll("member-name");
    const memberNames = memberNamesSchema.safeParse(memberNamesRaw);

    if (!groupName.success || !memberCount.success || !memberNames.success) {
      const memberNameErrors = memberNames.success ? undefined : z.treeifyError(memberNames.error).items;

      return {
        type: "Pending",
        groupNameErrors: groupName.success ? undefined : z.flattenError(groupName.error).formErrors,
        memberCountErrors: memberCount.success ? undefined : z.flattenError(memberCount.error).formErrors,
        memberErrors: memberNames.success
          ? undefined
          : Array.from({ length: memberNamesRaw.length }, function getMemberErrors(_value, index) {
              return memberNameErrors?.at(index)?.errors ?? [];
            }),
      };
    }

    try {
      const credentials = await fetchCreateGroup(groupName.data, memberNames.data);
      await new Promise(function waitForLoadingState(resolve) {
        setTimeout(resolve, 500);
      });

      return { type: "Success", credentials };
    } catch (reason) {
      return { type: "Pending", serverErrors: [reason instanceof Error ? reason.message : "Unknown error"] };
    }
  }

  async function submit(event) {
    pending.value = true;

    if (formState.value.type === "Pending") {
      formState.value = { ...formState.value, serverErrors: undefined };
    }

    try {
      const result = await createGroup(new FormData(event.currentTarget));
      formState.value = result;

      if (result.type === "Success") {
        await apiStore.logInLive(result.credentials);
        await router.push("/group/setup-instructions");
      }
    } catch (reason) {
      console.error("Unexpected error during form submission:", reason);
    } finally {
      pending.value = false;
    }
  }

  function updateMemberCount(event) {
    const newMemberCount = parseInt(event.target.value);

    if (!Number.isSafeInteger(newMemberCount) || newMemberCount === memberCount.value) {
      return;
    }

    if (formState.value.type === "Pending") {
      formState.value = {
        ...formState.value,
        memberErrors: formState.value.memberErrors?.slice(0, Math.min(memberCount.value ?? 0, newMemberCount)),
      };
    }

    memberCount.value = newMemberCount;
  }

  function getMemberErrors(index) {
    return formState.value.type === "Pending" ? formState.value.memberErrors?.at(index) : undefined;
  }
</script>

<template>
  <div id="create-group-container">
    <form id="create-group-window" class="rsborder rsbackground" @submit.prevent="submit">
      <div>
        <h3>Pick a name for your group</h3>
        <p>This does <span class="emphasize">not</span> need to be the in-game name.</p>
        <label for="create-group-group-name">Group name</label>
        <br />
        <input
          id="create-group-group-name"
          name="group-name"
          :class="groupNameErrors?.length ? 'invalid' : 'valid'"
          placeholder="Group name"
          maxlength="16"
        />
        <div class="validation-error">
          <template v-for="(error, index) in groupNameErrors" :key="error">
            <br v-if="index > 0" />
            {{ error }}
          </template>
        </div>
      </div>

      <div>
        <h3>What size is the group?</h3>
        <p>This can be changed later.</p>
        <label for="group-member-count">Group size</label>
        <br />
        <div
          :class="[
            'select-container',
            'rsborder-tiny',
            'rsbackground',
            memberCountErrors?.length ? 'invalid' : 'valid',
          ]"
        >
          <select id="group-member-count" name="group-member-count" value="0" @change="updateMemberCount">
            <option value="0" disabled>Select an option</option>
            <option v-for="count in [2, 3, 4, 5]" :key="count" :value="count">{{ count }} Members</option>
          </select>
        </div>
        <div class="validation-error">
          <template v-for="(error, index) in memberCountErrors" :key="error">
            <br v-if="index > 0" />
            {{ error }}
          </template>
        </div>
      </div>

      <div v-if="memberInputIndexes.length > 0">
        <h3>Enter each members' name</h3>
        <p>This <span class="emphasize">does</span> need to match the in-game name. (Can be changed later)</p>

        <template v-for="index in memberInputIndexes" :key="index">
          <label :for="`create-group-member-name-${index}`">Name for Member {{ index + 1 }}</label>
          <br />
          <input
            aria-required="true"
            :id="`create-group-member-name-${index}`"
            :class="getMemberErrors(index)?.length ? 'invalid' : 'valid'"
            placeholder="Member name"
            name="member-name"
            maxlength="16"
          />
          <div class="validation-error">
            <template v-for="(error, errorIndex) in getMemberErrors(index)" :key="error">
              <br v-if="errorIndex > 0" />
              {{ error }}
            </template>
          </div>
        </template>
      </div>

      <button :disabled="pending" class="men-button" type="submit">Create group</button>

      <div v-if="formState.type === 'Pending' && formState.serverErrors?.length" class="validation-error">
        <template v-for="(error, index) in formState.serverErrors" :key="error">
          <br v-if="index > 0" />
          {{ error }}
        </template>
      </div>

      <div v-if="pending" id="create-group-loading-overlay">
        <LoadingScreen />
      </div>
    </form>
  </div>
</template>
