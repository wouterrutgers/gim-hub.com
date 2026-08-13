import { createRouter, createWebHistory } from "vue-router";
import { useApiStore } from "./stores/api";
import LoadingScreen from "./components/loading-screen/LoadingScreen.vue";

async function openDemo() {
  await useApiStore().logInDemo();

  return "/group/items";
}

function logOut() {
  const apiStore = useApiStore();

  if (apiStore.isDemo) {
    apiStore.disconnect();
  } else {
    apiStore.logOut();
  }

  return "/";
}

const routes = [
  {
    path: "/",
    component: function loadHomepage() {
      return import("./components/homepage/Homepage.vue");
    },
    meta: { layout: "unauthed" },
  },
  {
    path: "/demo",
    component: LoadingScreen,
    beforeEnter: openDemo,
  },
  {
    path: "/create-group",
    component: function loadCreateGroupPage() {
      return import("./components/create-group-page/CreateGroupPage.vue");
    },
    meta: { layout: "unauthed" },
  },
  {
    path: "/setup-instructions",
    component: function loadSetupInstructions() {
      return import("./components/setup-instructions/SetupInstructions.vue");
    },
    meta: { layout: "unauthed" },
  },
  {
    path: "/changelog",
    component: function loadChangelogRoute() {
      return import("./components/changelog-page/ChangelogRoute.vue");
    },
  },
  {
    path: "/login",
    component: function loadLoginPage() {
      return import("./components/login-page/LoginPage.vue");
    },
    meta: { layout: "unauthed" },
  },
  {
    path: "/logout",
    component: LoadingScreen,
    beforeEnter: logOut,
  },
  { path: "/group", redirect: "/group/items" },
  {
    path: "/group/setup-instructions",
    component: function loadAuthenticatedSetupInstructions() {
      return import("./components/setup-instructions/SetupInstructions.vue");
    },
    meta: { layout: "authed", hideHeader: true },
  },
  {
    path: "/group/items",
    component: function loadItemsPage() {
      return import("./components/items-page/ItemsPage.vue");
    },
    meta: { layout: "authed", showPanels: true },
  },
  {
    path: "/group/map",
    component: function loadMapPage() {
      return import("./components/canvas-map/MapPage.vue");
    },
    meta: { layout: "authed", showPanels: true },
  },
  {
    path: "/group/history",
    component: function loadHistoryPage() {
      return import("./components/history-page/HistoryPage.vue");
    },
    meta: { layout: "authed", showPanels: true },
  },
  {
    path: "/group/panels",
    component: function loadPanelsPage() {
      return import("./components/panels-page/PanelsPage.vue");
    },
    meta: { layout: "authed" },
  },
  {
    path: "/group/settings",
    component: function loadSettingsPage() {
      return import("./components/settings/SettingsPage.vue");
    },
    meta: { layout: "authed", showPanels: true },
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

async function restoreStoredSession(apiStore) {
  if (!apiStore.hasStoredCredentials) {
    return false;
  }

  try {
    await apiStore.logInLive();

    return true;
  } catch {
    apiStore.logOut();

    return false;
  }
}

async function prepareRoute(to) {
  const apiStore = useApiStore();

  if (to.path.startsWith("/group") && !apiStore.client) {
    if (!(await restoreStoredSession(apiStore))) {
      return "/";
    }
  }

  if (to.path === "/login" && to.query.addGroup !== "true" && !apiStore.client && apiStore.hasStoredCredentials) {
    if (await restoreStoredSession(apiStore)) {
      return "/group/items";
    }
  }

  if (to.path === "/changelog" && !apiStore.client && apiStore.hasStoredCredentials) {
    await restoreStoredSession(apiStore);
  }
}

export function createApplicationRouter(history = createWebHistory()) {
  const router = createRouter({ history, routes });
  router.beforeEach(prepareRoute);

  return router;
}

export default createApplicationRouter();
