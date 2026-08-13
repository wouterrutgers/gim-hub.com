<script setup>
  import { computed, onMounted, ref, watch } from "vue";
  import { useApiStore } from "../../stores/api";
  import { useGameDataStore } from "../../stores/game-data";
  import { useGroupStore } from "../../stores/group";
  import * as CollectionLog from "../../game/collection-log";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import { serializeTooltip } from "../tooltip/tooltip-data";
  import mappings from "./mappings.json";
  import "./collection-log.css";

  const completionMappings = mappings;

  const props = defineProps({
    player: { type: String, required: true },
  });
  const emit = defineEmits(["close"]);

  const apiStore = useApiStore();
  const gameDataStore = useGameDataStore();
  const groupStore = useGroupStore();

  const currentTabName = ref("Bosses");
  const pageIndex = ref(0);
  const hiscores = ref();
  const hiscoresError = ref();

  const collection = computed(function getCollection() {
    return groupStore.collections.get(props.player);
  });
  const totalGroupCollected = computed(function getTotalGroupCollected() {
    const unlockedItems = new Set();

    for (const memberCollection of groupStore.collections.values()) {
      for (const [itemId, quantity] of memberCollection) {
        if (quantity > 0) {
          unlockedItems.add(itemId);
        }
      }
    }

    return unlockedItems.size;
  });
  const pageDirectory = computed(function getPageDirectory() {
    return (gameDataStore.gameData.collectionLogInfo?.tabs.get(currentTabName.value) ?? []).map(
      function buildPageDirectory(page, index) {
        const unlocked = page.items.filter(function itemIsUnlocked(itemId) {
          return (collection.value?.get(itemId) ?? 0) > 0;
        }).length;

        return {
          name: page.name,
          index,
          unlocked,
          total: page.items.length,
          className:
            unlocked >= page.items.length
              ? "collection-log-page-directory-page-all"
              : unlocked > 0
                ? "collection-log-page-directory-page-some"
                : "collection-log-page-directory-page-none",
        };
      },
    );
  });
  const currentPage = computed(function getCurrentPage() {
    const page = gameDataStore.gameData.collectionLogInfo?.tabs.get(currentTabName.value)?.at(pageIndex.value);

    if (!page) {
      return undefined;
    }

    const items = page.items.map(function buildPageItem(itemId) {
      const otherMembers = [];

      for (const [member, memberCollection] of groupStore.collections) {
        if (member !== props.player && (memberCollection.get(itemId) ?? 0) > 0) {
          otherMembers.push({ name: member, quantity: memberCollection.get(itemId) });
        }
      }

      return {
        id: itemId,
        name: gameDataStore.gameData.items?.get(itemId)?.name,
        quantity: collection.value?.get(itemId) ?? 0,
        otherMembers,
      };
    });

    return {
      ...page,
      wikiLink: resolvePageWikiLink(currentTabName.value, page.name),
      obtained: items.filter(function hasItem(item) {
        return item.quantity > 0;
      }).length,
      completionClass: items.every(function hasItem(item) {
        return item.quantity > 0;
      })
        ? "collection-log-page-obtained-all"
        : items.some(function hasItem(item) {
              return item.quantity > 0;
            })
          ? "collection-log-page-obtained-some"
          : "collection-log-page-obtained-none",
      completions: buildCompletionLines(page.name).map(function buildCompletion(line) {
        return { ...line, count: hiscores.value === undefined ? undefined : (hiscores.value.get(line.lookupKey) ?? 0) };
      }),
      items,
    };
  });

  onMounted(function loadCollectionLogs() {
    groupStore.refreshCollectionLogs().catch(function reportCollectionLogError(error) {
      console.error("Failed to fetch collection logs", error);
    });
  });

  function resolvePageWikiLink(tab, page) {
    let rawUrl = `https://oldschool.runescape.wiki/w/Special:Lookup?type=npc&name=${page}`;

    if (tab === "Clues") {
      rawUrl = page.startsWith("Shared")
        ? "https://oldschool.runescape.wiki/w/Collection_log#Shared_Treasure_Trail_Rewards"
        : `https://oldschool.runescape.wiki/w/Clue_scroll_(${page.split(" ")[0].toLowerCase()})`;
    }

    return URL.canParse(rawUrl) ? rawUrl : "";
  }

  function buildCompletionLines(pageName) {
    const entry = completionMappings[pageName];

    if (entry === "kills") {
      return [{ label: `${pageName} kills`, lookupKey: pageName }];
    }

    return entry ?? [];
  }

  function selectTab(tab) {
    if (tab !== currentTabName.value) {
      pageIndex.value = 0;
      currentTabName.value = tab;
    }
  }

  watch(
    function getPlayer() {
      return props.player;
    },
    function loadHiscores(player, _previousPlayer, onCleanup) {
      if (!apiStore.client) {
        return;
      }

      let cancelled = false;
      onCleanup(function cancelHiscoresRequest() {
        cancelled = true;
      });
      apiStore.client.fetchMemberHiscores(player).then(
        function storeHiscores(result) {
          if (!cancelled) {
            hiscores.value = result;
            hiscoresError.value = undefined;
          }
        },
        function reportHiscoresError(reason) {
          if (cancelled) {
            return;
          }

          hiscoresError.value = reason instanceof Error ? reason.message : "Unknown error";
          hiscores.value = new Map();
          console.warn(`Failed to get hiscores for '${player}': `, hiscoresError.value);
        },
      );
    },
    { immediate: true },
  );

  watch(
    function getCollectionLogInfo() {
      return gameDataStore.gameData.collectionLogInfo;
    },
    function verifyMappings(collectionLogInfo) {
      if (!import.meta.env.DEV || !collectionLogInfo) {
        return;
      }

      console.groupCollapsed("Collection log mappings");
      collectionLogInfo.tabs.forEach(function verifyPages(pages) {
        pages.forEach(function verifyPage(page) {
          buildCompletionLines(page.name);
        });
      });
      console.groupEnd();
    },
    { immediate: true },
  );
</script>

<template>
  <div class="collection-log-container dialog-container metal-border rsbackground">
    <div class="collection-log-header">
      <h1 class="collection-log-title">
        {{ `${props.player}'s collection log` }} - {{ collection?.size ?? 0 }} /
        {{ gameDataStore.gameData.collectionLogInfo?.uniqueSlots ?? 0 }} (Group: {{ totalGroupCollected }} /
        {{ gameDataStore.gameData.collectionLogInfo?.uniqueSlots ?? 0 }})
      </h1>
      <button class="collection-log-close dialog-close" data-tooltip="Close dialog" @click="emit('close')">
        <CachedImage src="/ui/1731-0.png" alt="Close dialog" />
      </button>
    </div>
    <div class="collection-log-title-border" />
    <div v-if="hiscoresError" class="collection-log-error" role="alert">
      <template v-if="hiscoresError === 'User was not found in the hiscores'">
        User {{ props.player }} was not found in the hiscores.
      </template>
      <template v-else>Hiscores unavailable for {{ props.player }}: {{ hiscoresError }}</template>
    </div>
    <div class="collection-log-main">
      <div class="collection-log-tab-buttons">
        <button
          v-for="tab in CollectionLog.tabNames"
          :key="tab"
          :class="{ 'collection-log-tab-button-active': tab === currentTabName }"
          @click="selectTab(tab)"
        >
          {{ tab }}
        </button>
      </div>
      <div class="collection-log-tab-container">
        <div class="collection-log-tab-list">
          <button
            v-for="page in pageDirectory"
            :key="page.name"
            :class="[
              'collection-log-page-directory-page',
              page.className,
              { 'collection-log-page-active': page.index === pageIndex },
            ]"
            @click="pageIndex = page.index"
          >
            {{ page.name }}<span>{{ page.unlocked }} / {{ page.total }}</span>
          </button>
        </div>

        <div class="collection-log-page-container">
          <template v-if="currentPage">
            <div class="collection-log-page-top">
              <h2 class="collection-log-page-name-link">
                <a :href="currentPage.wikiLink" target="_blank" rel="noopener noreferrer">{{ currentPage.name }}</a>
              </h2>
              Obtained:
              <span :class="currentPage.completionClass"
                >{{ currentPage.obtained }}/{{ currentPage.items.length }}</span
              >
              <br />
              <template v-for="completion in currentPage.completions" :key="completion.label">
                {{ completion.label }}:
                <span
                  :class="
                    completion.count === undefined
                      ? 'collection-log-page-completion-quantity-loading'
                      : 'collection-log-page-completion-quantity'
                  "
                >
                  {{ completion.count ?? "-" }}
                </span>
                <br />
              </template>
            </div>

            <div class="collection-log-page-items">
              <a
                v-for="(item, index) in currentPage.items"
                :key="`${item.id}-${index}`"
                :data-tooltip="
                  item.name
                    ? serializeTooltip({
                        type: 'collection-log-item',
                        name: item.name,
                        memberQuantities: item.otherMembers,
                      })
                    : undefined
                "
                class="collection-log-page-item"
                :href="`https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.id}`"
                target="_blank"
                rel="noopener noreferrer"
              >
                <CachedImage
                  :class="{ 'collection-log-page-item-missing': item.quantity === 0 }"
                  :alt="item.name ?? 'osrs item'"
                  :src="`/item-icons/${item.id}.webp`"
                />
                <span v-if="item.quantity > 0" class="collection-log-page-item-quantity">{{ item.quantity }}</span>
                <span style="position: absolute; bottom: 0; left: 0">
                  <PlayerIcon
                    v-for="member in item.otherMembers.filter(function hasItem(otherMember) {
                      return otherMember.quantity > 0;
                    })"
                    :key="member.name"
                    :name="member.name"
                  />
                </span>
              </a>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
