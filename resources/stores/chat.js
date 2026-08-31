import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { useApiStore } from "./api";

const CHAT_POLL_INTERVAL_MILLISECONDS = 5000;

export const useChatStore = defineStore("chat", function createChatStore() {
  const apiStore = useApiStore();

  const messages = ref([]);
  const unreadCount = ref(0);
  const isPanelExpanded = ref(false);

  function markAsRead() {
    unreadCount.value = 0;
  }

  function setIsPanelExpanded(value) {
    isPanelExpanded.value = value;

    if (value) {
      markAsRead();
    }
  }

  watch(
    function getClient() {
      return apiStore.client;
    },
    function connectClient(client, _previousClient, onCleanup) {
      messages.value = [];
      unreadCount.value = 0;
      isPanelExpanded.value = false;

      if (!client) {
        return;
      }

      let cancelled = false;
      let timeout;
      let lastMessageId = 0;

      async function pollChatMessages() {
        try {
          const newMessages = await client.fetchChatMessages(lastMessageId);

          if (cancelled) {
            return;
          }

          if (newMessages.length > 0) {
            messages.value = [...messages.value, ...newMessages];
            lastMessageId = newMessages[newMessages.length - 1].id;

            if (!isPanelExpanded.value) {
              unreadCount.value += newMessages.length;
            }
          }
        } catch (reason) {
          console.error("Failed to fetch chat messages", reason);
        }

        if (!cancelled) {
          timeout = window.setTimeout(pollChatMessages, CHAT_POLL_INTERVAL_MILLISECONDS);
        }
      }

      void pollChatMessages();

      onCleanup(function disconnectClient() {
        cancelled = true;
        window.clearTimeout(timeout);
      });
    },
    { immediate: true },
  );

  return {
    messages,
    unreadCount,
    isPanelExpanded,
    markAsRead,
    setIsPanelExpanded,
  };
});
