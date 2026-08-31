<script setup>
  import { computed, nextTick, ref, watch } from "vue";
  import { format, isToday, isYesterday } from "date-fns";
  import { useChatStore } from "../../stores/chat";
  import { useGroupStore } from "../../stores/group";
  import "./group-chat-panel.css";

  const chatStore = useChatStore();
  const groupStore = useGroupStore();
  const messagesContainer = ref(null);

  const isExpanded = computed(function getIsExpanded() {
    return chatStore.isPanelExpanded;
  });

  const messages = computed(function getMessages() {
    return chatStore.messages;
  });

  const unreadCount = computed(function getUnreadCount() {
    return chatStore.unreadCount;
  });

  const memberRelayStatuses = computed(function getMemberRelayStatuses() {
    return [...groupStore.memberNames]
      .filter(function excludeShared(name) {
        return name !== "@SHARED";
      })
      .map(function buildMemberStatus(name) {
        return {
          name,
          chatRelayEnabled: groupStore.memberStates.get(name)?.chatRelayEnabled ?? false,
          colorHueDegrees: groupStore.memberColors.get(name)?.hueDegrees,
        };
      });
  });

  function toggle() {
    chatStore.setIsPanelExpanded(!chatStore.isPanelExpanded);
  }

  function formatTimestamp(date) {
    if (isToday(date)) {
      return format(date, "h:mm a");
    }

    if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    }

    return format(date, "MMM d, h:mm a");
  }

  function senderColor(colorHueDegrees) {
    if (colorHueDegrees == null) {
      return "var(--orange)";
    }

    return `hsl(${colorHueDegrees}deg 70% 65%)`;
  }

  function messageSenderColor(msg) {
    const hue = groupStore.memberColors.get(msg.senderName)?.hueDegrees ?? msg.colorHueDegrees;
    return senderColor(hue);
  }

  function scrollToBottom(smooth) {
    const container = messagesContainer.value;

    if (!container) {
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  }

  watch(
    function getMessageCount() {
      return messages.value.length;
    },
    async function onNewMessages(_newCount, oldCount) {
      if (!isExpanded.value) {
        return;
      }

      const container = messagesContainer.value;

      if (!container) {
        return;
      }

      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;

      if (isAtBottom || oldCount === 0) {
        await nextTick();
        scrollToBottom(true);
      }
    },
  );

  watch(isExpanded, async function onExpandedChange(expanded) {
    if (expanded) {
      await nextTick();
      scrollToBottom(false);
    }
  });
</script>

<template>
  <div id="group-chat-panel" class="rsborder-tiny rsbackground">
    <button id="group-chat-panel-header" class="group-chat-panel-header-btn" @click="toggle">
      <span class="group-chat-panel-title">Group Chat</span>
      <span v-if="!isExpanded && unreadCount > 0" class="group-chat-unread-badge">{{ unreadCount }}</span>
      <span class="group-chat-panel-toggle">{{ isExpanded ? "▲" : "▼" }}</span>
    </button>

    <template v-if="isExpanded">
      <div v-if="memberRelayStatuses.length > 0" class="group-chat-member-list" aria-label="Member relay status">
        <span
          v-for="member in memberRelayStatuses"
          :key="member.name"
          class="group-chat-member-status"
          :data-tooltip="member.chatRelayEnabled ? `${member.name}: chat relay enabled` : `${member.name}: chat relay disabled`"
        >
          <span
            class="group-chat-member-dot"
            :class="{ 'group-chat-member-dot--disabled': !member.chatRelayEnabled }"
            :style="member.chatRelayEnabled ? { color: senderColor(member.colorHueDegrees) } : {}"
          >{{member.chatRelayEnabled ? "✓" : "✗"}}</span>
          <span
            class="group-chat-member-name"
            :class="{ 'group-chat-member-name--disabled': !member.chatRelayEnabled }"
            :style="member.chatRelayEnabled ? { color: senderColor(member.colorHueDegrees) } : {}"
          >{{ member.name }}</span>
        </span>
      </div>

      <div ref="messagesContainer" class="group-chat-panel-messages">
        <div v-if="messages.length === 0" class="group-chat-empty">
          No messages yet.
        </div>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="group-chat-message"
        >
          <span class="group-chat-sender" :style="{ color: messageSenderColor(msg) }">{{ msg.senderName }}:</span>
          <span class="group-chat-text">{{ msg.message }}</span>
          <span class="group-chat-timestamp">{{ formatTimestamp(msg.sentAt) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
