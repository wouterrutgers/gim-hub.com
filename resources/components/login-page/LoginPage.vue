<script setup>
  import { computed, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import * as z from "zod/v4";
  import { useApiStore } from "../../stores/api";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import "./login-page.css";

  const requiredValueSchema = z.string().trim().min(1, "This field is required.");

  const apiStore = useApiStore();
  const route = useRoute();
  const router = useRouter();

  const nameErrors = ref();
  const tokenErrors = ref();
  const serverErrors = ref();
  const pendingSubmission = ref(false);

  const isAddingGroup = computed(function addingGroup() {
    return route.query.addGroup === "true";
  });

  async function tryLogin(event) {
    const formData = new FormData(event.currentTarget);
    const groupName = requiredValueSchema.safeParse(formData.get("login-group-name"));
    const groupToken = requiredValueSchema.safeParse(formData.get("login-group-token"));

    serverErrors.value = undefined;
    nameErrors.value = groupName.success ? undefined : ["Name is required."];
    tokenErrors.value = groupToken.success ? undefined : ["Token is required."];

    if (!groupName.success || !groupToken.success) {
      return;
    }

    pendingSubmission.value = true;

    try {
      await new Promise(function waitForLoadingState(resolve) {
        setTimeout(resolve, 500);
      });
      await apiStore.logInLive({ name: groupName.data, token: groupToken.data });
      await router.push("/group");
    } catch (reason) {
      if (reason instanceof Error) {
        serverErrors.value = [reason.message];
      }

      console.error("LoginPage: Error during form submission:", reason);
    } finally {
      pendingSubmission.value = false;
    }
  }
</script>

<template>
  <div id="login-page-container">
    <form id="login-page-window" class="rsborder rsbackground" @submit.prevent="tryLogin">
      <div class="login-page-step">
        <label for="login-group-name">Group name</label>
        <br />
        <input
          aria-required="true"
          id="login-group-name"
          :class="nameErrors ? 'invalid' : 'valid'"
          name="login-group-name"
          placeholder="Group name"
          maxlength="16"
        />
        <div class="validation-error">
          <template v-for="(error, index) in nameErrors" :key="error">
            <br v-if="index > 0" />
            {{ error }}
          </template>
        </div>
      </div>

      <div class="login-page-step">
        <label for="login-group-token">Group token</label>
        <br />
        <input
          aria-required="true"
          id="login-group-token"
          :class="tokenErrors ? 'invalid' : 'valid'"
          name="login-group-token"
          placeholder="Group token"
          maxlength="60"
          type="password"
        />
        <div class="validation-error">
          <template v-for="(error, index) in tokenErrors" :key="error">
            <br v-if="index > 0" />
            {{ error }}
          </template>
        </div>
      </div>

      <button :disabled="pendingSubmission" id="login-page-submit" class="men-button" type="submit">Login</button>

      <div v-if="serverErrors?.length" class="validation-error">
        <template v-for="(error, index) in serverErrors" :key="error">
          <br v-if="index > 0" />
          {{ error }}
        </template>
      </div>

      <div v-if="pendingSubmission" id="login-page-loading-overlay">
        <LoadingScreen />
      </div>
    </form>
  </div>
</template>
