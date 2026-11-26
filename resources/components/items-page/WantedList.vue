<script setup>
  import { computed, nextTick, reactive, ref, shallowRef, watch } from "vue";
  import { useApiStore } from "../../stores/api";
  import { useGameDataStore } from "../../stores/game-data";
  import { useGroupStore } from "../../stores/group";
  import { MAX_WANTED_QUANTITY, WantedItemConflict } from "../../api/requests/wanted-items";
  import { fetchVersionedData } from "../../api/fetch-versioned-data";
  import { composeItemIconHref, fetchItemData } from "../../game/items";
  import {
    isWantedCatalogueItem,
    wantedItemId,
    wantedItemProgress,
    wantedOwnedQuantity,
    wantedSeasonalLabel,
  } from "../../game/wanted-items";
  import CachedImage from "../cached-image/CachedImage.vue";
  import WantedMaterials from "./WantedMaterials.vue";
  import "./wanted-list.css";

  const REFRESH_INTERVAL = 15_000;
  const SEARCH_LIMIT = 12;
  const props = defineProps({ active: Boolean });
  const apiStore = useApiStore();
  const gameDataStore = useGameDataStore();
  const groupStore = useGroupStore();
  const goals = ref([]);
  const goalsLoaded = ref(false);
  const reloadCount = ref(0);
  const loadError = ref(false);
  const fallbackCatalogue = ref();
  const editing = ref(false);
  const saving = ref(false);
  const confirmingRemoval = ref(false);
  const saveError = ref("");
  const search = ref("");
  const selectedItemId = ref();
  const quantity = ref(1);
  const list = ref();
  const heading = ref();
  const addButton = ref();
  const searchInput = ref();
  const quantityInput = ref();
  const recipeCatalogue = shallowRef();
  const loadingRecipes = ref(false);
  const recipeLoadError = ref(false);
  const materialViews = reactive(new Map());
  let editorSource;
  let writeVersion = 0;

  const catalogue = computed(function itemCatalogue() {
    return gameDataStore.gameData.items ?? fallbackCatalogue.value;
  });
  const countsAvailable = computed(function hasCurrentCounts() {
    return groupStore.loaded && !groupStore.syncError;
  });
  const targetsByItem = computed(function indexTargets() {
    return new Map(goals.value.map(({ item_id, target_quantity }) => [item_id, target_quantity]));
  });
  const savedIdsByCanonicalId = computed(function indexEquivalentTargets() {
    const saved = new Map();

    for (const itemId of targetsByItem.value.keys()) {
      const canonicalId = wantedItemId(itemId);
      const previous = saved.get(canonicalId);

      if (itemId === canonicalId || previous === undefined || (previous !== canonicalId && itemId < previous)) {
        saved.set(canonicalId, itemId);
      }
    }

    return saved;
  });

  function targetItemId(itemId) {
    if (targetsByItem.value.has(itemId)) {
      return itemId;
    }

    const canonicalId = wantedItemId(itemId);

    return savedIdsByCanonicalId.value.get(canonicalId) ?? canonicalId;
  }

  function itemName(itemId) {
    return catalogue.value?.get(itemId)?.name ?? `Item ${itemId}`;
  }

  function itemIcon(itemId) {
    return composeItemIconHref({ itemID: itemId, quantity: 1 }, catalogue.value?.get(itemId));
  }

  const sections = computed(function groupGoals() {
    const rows = goals.value
      .map(function showProgress(goal) {
        return {
          ...goal,
          name: itemName(goal.item_id),
          ...(countsAvailable.value ? wantedItemProgress(groupStore.items, goal) : {}),
        };
      })
      .sort(function sortByName(left, right) {
        return left.name.localeCompare(right.name);
      });

    return countsAvailable.value
      ? [
          { title: "Still needed", rows: rows.filter((row) => row.needed > 0) },
          { title: "Completed", rows: rows.filter((row) => row.needed === 0) },
        ].filter((section) => section.rows.length > 0)
      : [{ title: "Group targets", rows }];
  });
  const hasMissingGoals = computed(() => sections.value.some(({ rows }) => rows.some((goal) => goal.needed > 0)));

  watch(
    goals,
    function syncMaterialViews(currentGoals) {
      const currentIds = new Set(currentGoals.map((goal) => goal.item_id));

      for (const itemId of materialViews.keys()) {
        if (!currentIds.has(itemId)) {
          materialViews.delete(itemId);
        }
      }

      for (const itemId of currentIds) {
        if (!materialViews.has(itemId)) {
          materialViews.set(itemId, { open: false, choices: new Map(), expanded: new Set() });
        }
      }
    },
    { flush: "sync" },
  );

  async function loadRecipes() {
    loadingRecipes.value = true;
    recipeLoadError.value = false;

    try {
      recipeCatalogue.value = await fetchVersionedData("/data/wanted_recipes.json");
    } catch (error) {
      recipeLoadError.value = true;
      console.error("Could not load Wanted recipes", error);
    } finally {
      loadingRecipes.value = false;
    }
  }

  watch(
    [() => props.active, hasMissingGoals],
    function loadRecipesWhenNeeded([active, needed]) {
      if (active && needed && !recipeCatalogue.value && !loadingRecipes.value && !recipeLoadError.value) {
        void loadRecipes();
      }
    },
    { immediate: true },
  );

  function retryRecipes() {
    heading.value.focus();
    void loadRecipes();
  }

  function toggleMaterial(itemId, { path, open }) {
    const expanded = materialViews.get(itemId).expanded;

    if (open) {
      expanded.add(path);
    } else {
      expanded.delete(path);
    }
  }

  const searchResults = computed(function searchCatalogue() {
    const query = search.value.trim().toLowerCase();

    if (!query || !catalogue.value) {
      return [];
    }

    const matches = [];

    for (const [itemId, item] of catalogue.value) {
      const name = item.name.toLowerCase();

      if (!isWantedCatalogueItem(itemId, item) || (String(itemId) !== query && !name.includes(query))) {
        continue;
      }

      const rank = name === query || String(itemId) === query ? 0 : name.startsWith(query) ? 1 : 2;
      matches.push({ itemId: targetItemId(itemId), name, rank });
    }

    matches.sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));

    return [...new Set(matches.map(({ itemId }) => itemId))];
  });
  const visibleResults = computed(() => searchResults.value.slice(0, SEARCH_LIMIT));
  const searchStatus = computed(function describeSearch() {
    const count = searchResults.value.length;

    if (!search.value.trim()) {
      return "";
    }

    if (!count) {
      return "No matching items. Try a shorter item name.";
    }

    return count > SEARCH_LIMIT
      ? `Showing ${SEARCH_LIMIT} of ${count} matches. Refine your search for more.`
      : `${count} ${count === 1 ? "match" : "matches"}`;
  });
  const editedTarget = computed(() => targetsByItem.value.get(selectedItemId.value));
  const selectedUnavailable = computed(function isUnavailable() {
    if (!catalogue.value || selectedItemId.value === undefined) {
      return false;
    }

    const item = catalogue.value.get(selectedItemId.value);

    return !item || !isWantedCatalogueItem(selectedItemId.value, item);
  });
  const editorOwned = computed(function ownedByGroup() {
    if (!countsAvailable.value || selectedItemId.value === undefined) {
      return undefined;
    }

    return wantedOwnedQuantity(groupStore.items, selectedItemId.value);
  });
  const editorShortfall = computed(function shortfall() {
    if (editorOwned.value !== undefined && Number.isInteger(quantity.value) && quantity.value > 0) {
      return Math.max(quantity.value - editorOwned.value, 0);
    }

    return undefined;
  });

  function editButton(itemId) {
    return list.value.querySelector(`[data-edit-goal="${itemId}"]`);
  }

  async function openEditor(itemId) {
    editorSource = itemId;
    search.value = "";
    editing.value = true;

    if (itemId !== undefined) {
      await selectItem(itemId);

      return;
    }

    await changeItem();
  }

  async function selectItem(itemId) {
    selectedItemId.value = targetItemId(itemId);
    saveError.value = "";
    confirmingRemoval.value = false;
    quantity.value = editedTarget.value ?? Math.min((editorOwned.value ?? 0) + 1, MAX_WANTED_QUANTITY);
    await nextTick();

    quantityInput.value?.focus();
  }

  async function changeItem() {
    selectedItemId.value = undefined;
    saveError.value = "";
    confirmingRemoval.value = false;
    await nextTick();
    searchInput.value?.focus();
  }

  function chooseSearchResult() {
    if (searchResults.value.length === 1) {
      void selectItem(searchResults.value[0]);
    } else {
      list.value.querySelector(".wanted-search-results button")?.focus();
    }
  }

  async function closeEditor(focusItemId = editorSource) {
    editing.value = false;
    await nextTick();

    if (props.active && !editing.value) {
      const target = focusItemId === undefined ? addButton.value : (editButton(focusItemId) ?? addButton.value);
      (target ?? heading.value).focus();
    }
  }

  function replaceGoal(itemId, target) {
    const remaining = goals.value.filter((goal) => goal.item_id !== itemId);
    goals.value = target === null ? remaining : [...remaining, { item_id: itemId, target_quantity: target }];
  }

  async function submitGoal(remove = false) {
    const itemId = selectedItemId.value;

    if (saving.value || !props.active) {
      return;
    }

    if (itemId === undefined) {
      chooseSearchResult();

      return;
    }

    if (!remove && selectedUnavailable.value) {
      return;
    }

    const client = apiStore.client;
    const expectedQuantity = editedTarget.value ?? null;
    saving.value = true;
    writeVersion += 1;
    saveError.value = "";

    try {
      const savedGoal = remove
        ? await client.removeWantedItem(itemId, expectedQuantity)
        : await client.saveWantedItem({
            item_id: itemId,
            target_quantity: quantity.value,
            expected_quantity: expectedQuantity,
            ...(expectedQuantity === null ? {} : { exact_item_id: true }),
          });

      if (apiStore.client !== client) {
        return;
      }

      replaceGoal(savedGoal?.item_id ?? itemId, savedGoal?.target_quantity ?? null);

      await closeEditor(remove ? undefined : savedGoal.item_id);
    } catch (error) {
      if (apiStore.client !== client) {
        return;
      }

      confirmingRemoval.value = false;

      if (error instanceof WantedItemConflict) {
        const currentItemId = error.itemId ?? itemId;
        replaceGoal(currentItemId, error.currentQuantity);
        selectedItemId.value = currentItemId;
        saveError.value =
          error.currentQuantity === null
            ? "A teammate removed this goal. Review your quantity before adding it again."
            : `A teammate changed the target to ${error.currentQuantity.toLocaleString()}. Review your change and try again.`;
        await nextTick();

        if (props.active && document.activeElement === document.body) {
          quantityInput.value?.focus();
        }
      } else {
        console.error("Could not change wanted item", error);
        saveError.value = remove ? "Could not remove goal. Try again." : "Could not save goal. Try again.";
      }
    } finally {
      if (apiStore.client === client) {
        saving.value = false;
      }
    }
  }

  function requestRemoval() {
    if (saving.value) {
      return;
    }

    if (confirmingRemoval.value) {
      void submitGoal(true);
    } else {
      confirmingRemoval.value = true;
    }
  }

  function retryGoals() {
    heading.value.focus();
    reloadCount.value += 1;
  }

  watch(
    [() => props.active, () => apiStore.client, reloadCount],
    function loadGoals([active, client], [, previousClient], onCleanup) {
      if (client !== previousClient) {
        goals.value = [];
        goalsLoaded.value = false;
        saving.value = false;
      }

      if (!active || !client) {
        return;
      }

      let cancelled = false;
      let refreshing = false;

      if (!saving.value) {
        editing.value = false;
      }

      async function refreshGoals() {
        if (refreshing || saving.value || editing.value || document.hidden) {
          return;
        }

        const version = writeVersion;
        refreshing = true;

        try {
          const fetchedGoals = await client.fetchWantedItems();

          if (cancelled || apiStore.client !== client || version !== writeVersion || editing.value) {
            return;
          }

          loadError.value = false;
          goals.value = fetchedGoals;
          goalsLoaded.value = true;
        } catch (error) {
          if (!cancelled && apiStore.client === client && version === writeVersion) {
            loadError.value = true;
            console.error("Could not load wanted items", error);
          }
        } finally {
          refreshing = false;
        }
      }

      loadError.value = false;
      void refreshGoals();
      const interval = window.setInterval(refreshGoals, REFRESH_INTERVAL);
      window.addEventListener("focus", refreshGoals);
      document.addEventListener("visibilitychange", refreshGoals);
      onCleanup(function stopRefreshing() {
        cancelled = true;
        window.clearInterval(interval);
        window.removeEventListener("focus", refreshGoals);
        document.removeEventListener("visibilitychange", refreshGoals);
      });
    },
    { immediate: true },
  );

  watch(
    [() => props.active, () => groupStore.syncError],
    async function loadCatalogueDuringSyncFailure([active, failed]) {
      if (!active || !failed || catalogue.value) {
        return;
      }

      try {
        fallbackCatalogue.value = await fetchItemData();
      } catch (error) {
        console.error("Could not load the item catalogue", error);
      }
    },
    { immediate: true },
  );

  watch(sections, async function preserveGoalFocus() {
    const focused = document.activeElement;
    const goal = focused?.closest(".wanted-goal");

    if (!props.active || !goal || !list.value.contains(goal)) {
      return;
    }

    const summaries = [];

    for (let details = focused.closest("details"); details; details = details.parentElement.closest("details")) {
      summaries.push(details.querySelector(":scope > summary"));
    }

    await nextTick();

    if (props.active && !focused.isConnected && document.activeElement === document.body) {
      const summary = summaries.find((element) => element?.isConnected);
      (summary ?? editButton(goal.dataset.itemId) ?? addButton.value ?? heading.value).focus();
    }
  });
</script>

<template>
  <section ref="list" class="wanted-list" aria-labelledby="wanted-heading">
    <header class="wanted-heading">
      <h2 id="wanted-heading" ref="heading" tabindex="-1">Wanted list</h2>
      <button
        v-if="goalsLoaded && catalogue && !editing"
        ref="addButton"
        type="button"
        class="men-button button-primary"
        @click="openEditor()"
      >
        Add item
      </button>
    </header>

    <div v-if="loadError" class="wanted-heading">
      <p role="alert">
        {{ goalsLoaded ? "Could not refresh goals. Showing the last saved list." : "Could not load wanted items." }}
      </p>
      <button type="button" class="men-button" :disabled="editing" @click="retryGoals">Retry</button>
    </div>
    <p v-if="!goalsLoaded && !loadError" role="status">Loading wanted items…</p>
    <template v-if="goalsLoaded">
      <form
        v-if="editing"
        class="wanted-editor rsborder rsbackground"
        @submit.prevent="submitGoal()"
        @keydown.esc.prevent="!saving && closeEditor()"
      >
        <template v-if="selectedItemId === undefined">
          <div class="wanted-heading">
            <label for="wanted-search">Search item catalogue</label>
            <button type="button" class="men-button" @click="closeEditor()">Cancel</button>
          </div>
          <input
            id="wanted-search"
            ref="searchInput"
            v-model="search"
            class="search-element-input"
            type="search"
            @keydown.enter.prevent="chooseSearchResult"
          />
          <p class="wanted-note wanted-status" role="status">{{ searchStatus }}</p>
          <ul v-if="visibleResults.length" class="wanted-search-results" role="list">
            <li v-for="itemId in visibleResults" :key="itemId">
              <button type="button" class="men-button" @click="selectItem(itemId)">
                <CachedImage :src="itemIcon(itemId)" alt="" width="24" height="24" />
                <span>
                  {{ itemName(itemId) }}
                  <small
                    v-if="visibleResults.some((other) => other !== itemId && itemName(other) === itemName(itemId))"
                  >
                    #{{ itemId }}
                  </small>
                  <small v-if="targetsByItem.has(itemId)" class="wanted-search-note">Already wanted</small>
                </span>
              </button>
            </li>
          </ul>
        </template>
        <template v-else>
          <div class="wanted-editor-item">
            <CachedImage :src="itemIcon(selectedItemId)" alt="" width="32" height="32" />
            <h3 id="wanted-editor-item">
              {{ itemName(selectedItemId) }}
              <small v-if="wantedSeasonalLabel(selectedItemId)" class="wanted-search-note">
                {{ wantedSeasonalLabel(selectedItemId) }}
              </small>
            </h3>
          </div>
          <div class="wanted-editor-quantity">
            <label for="wanted-quantity">Total quantity wanted</label>
            <input
              id="wanted-quantity"
              ref="quantityInput"
              v-model.number="quantity"
              class="search-element-input wanted-quantity"
              type="number"
              inputmode="numeric"
              min="1"
              :max="MAX_WANTED_QUANTITY"
              aria-describedby="wanted-editor-item wanted-quantity-preview"
              :readonly="saving || selectedUnavailable"
              required
            />
            <p id="wanted-quantity-preview" class="wanted-note">
              <template v-if="editorOwned !== undefined">
                {{ editorOwned.toLocaleString() }} already owned<span v-if="editorShortfall !== undefined"
                  >, {{ editorShortfall.toLocaleString() }} still needed</span
                >.
              </template>
              <template v-else>Group counts are not available yet.</template>
            </p>
          </div>
          <p v-if="selectedUnavailable" class="wanted-note">
            This item is unavailable. You can still remove this goal.
          </p>
          <p v-if="confirmingRemoval">Remove this goal for everyone in the group?</p>
          <div class="wanted-actions">
            <button
              v-if="!confirmingRemoval && !selectedUnavailable"
              type="submit"
              class="men-button button-primary"
              :aria-disabled="saving"
            >
              {{ editedTarget === undefined ? "Add goal" : "Save changes" }}
            </button>
            <button type="button" class="men-button" :aria-disabled="saving" @click="!saving && closeEditor()">
              Cancel
            </button>
            <button
              v-if="catalogue && editorSource === undefined"
              type="button"
              class="men-button"
              :aria-disabled="saving"
              @click="!saving && changeItem()"
            >
              Change item
            </button>
            <button
              v-if="editedTarget !== undefined"
              type="button"
              class="men-button wanted-remove"
              :aria-disabled="saving"
              @click="requestRemoval"
            >
              {{ confirmingRemoval ? "Confirm removal" : "Remove goal" }}
            </button>
          </div>
        </template>
        <p v-if="saveError" class="validation-error" role="alert">{{ saveError }}</p>
      </form>

      <p v-if="!catalogue" class="wanted-note">
        {{ groupStore.syncError ? "Item search is unavailable." : "Loading item catalogue…" }}
      </p>
      <p v-if="!goals.length && !editing" class="wanted-note">Add an item and set how many your group wants to own.</p>
      <template v-if="goals.length">
        <p v-if="!countsAvailable" class="wanted-note">
          {{ groupStore.syncError ? "Synced item counts are temporarily unavailable." : "Loading synced item counts…" }}
        </p>
        <p v-if="loadingRecipes && hasMissingGoals" class="wanted-note" role="status">Loading recipes…</p>
        <div v-else-if="recipeLoadError && hasMissingGoals" class="wanted-heading">
          <p role="status">Could not load recipes. If retrying fails, reload the page.</p>
          <button type="button" class="men-button" @click="retryRecipes">Retry recipes</button>
        </div>
        <section v-for="section in sections" :key="section.title" class="wanted-section">
          <h3>{{ section.title }}</h3>
          <ul class="wanted-goals rsborder rsbackground" role="list">
            <li v-for="goal in section.rows" :key="goal.item_id" class="wanted-goal" :data-item-id="goal.item_id">
              <div class="wanted-goal-row">
                <CachedImage :src="itemIcon(goal.item_id)" alt="" width="32" height="32" />
                <div class="wanted-goal-item">
                  <strong>{{ goal.name }}</strong>
                  <small v-if="wantedSeasonalLabel(goal.item_id)" class="wanted-search-note">
                    {{ wantedSeasonalLabel(goal.item_id) }}
                  </small>
                  <div class="wanted-note">
                    <template v-if="goal.owned !== undefined">{{ goal.owned.toLocaleString() }} owned / </template
                    >{{ goal.target_quantity.toLocaleString() }} wanted
                  </div>
                </div>
                <strong v-if="goal.needed" class="wanted-shortfall">{{ goal.needed.toLocaleString() }} needed</strong>
                <button
                  type="button"
                  class="men-button men-button-small wanted-edit"
                  :aria-label="`Edit goal for ${goal.name}`"
                  :data-edit-goal="goal.item_id"
                  :disabled="editing"
                  @click="openEditor(goal.item_id)"
                >
                  Edit
                </button>
              </div>
              <WantedMaterials
                v-if="goal.needed && recipeCatalogue"
                :item-id="goal.item_id"
                :quantity="goal.needed"
                :group-items="groupStore.items"
                :item-name="itemName"
                :item-icon="itemIcon"
                :recipes="recipeCatalogue"
                :view="materialViews.get(goal.item_id)"
                @open-change="materialViews.get(goal.item_id).open = $event"
                @choose-method="materialViews.get(goal.item_id).choices.set($event.path, $event.index)"
                @toggle-material="toggleMaterial(goal.item_id, $event)"
              />
            </li>
          </ul>
        </section>
      </template>
    </template>
  </section>
</template>
