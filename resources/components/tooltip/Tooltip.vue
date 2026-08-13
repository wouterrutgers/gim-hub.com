<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
  import * as Member from "../../game/member";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import StatBar from "../player-panel/StatBar.vue";
  import { deserializeTooltip } from "./tooltip-data";
  import "./tooltip.css";

  const container = ref(null);
  const tooltipElement = ref(null);
  const pointerPosition = ref({ x: 0, y: 0 });
  const tooltip = ref();

  const itemLines = computed(function getItemLines() {
    if (!tooltip.value || typeof tooltip.value === "string") {
      return [];
    }

    return buildItemLines(tooltip.value);
  });

  onMounted(function addTooltipListeners() {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerover", handlePointerOver);
    window.addEventListener("pointerout", handlePointerOut);
    window.addEventListener("pointerdown", handlePointerDown);
  });

  onBeforeUnmount(function removeTooltipListeners() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerover", handlePointerOver);
    window.removeEventListener("pointerout", handlePointerOut);
    window.removeEventListener("pointerdown", handlePointerDown);
  });

  function buildItemLines(data) {
    const lines = [];

    if (data.type === "item") {
      lines.push({
        key: "name",
        value: data.quantity > 1 ? `${data.name} x ${data.quantity.toLocaleString()}` : data.name,
      });

      if (data.highAlch > 0 || data.gePrice > 0) {
        lines.push({ key: "after-name", type: "separator" });
      }

      if (data.highAlch > 0) {
        const unitPrice = data.highAlch.toLocaleString();
        const totalPrice = (data.highAlch * data.quantity).toLocaleString();
        lines.push({
          key: "high-alch",
          value: data.quantity > 1 ? `HA: ${totalPrice}gp (${unitPrice}gp each)` : `HA: ${unitPrice}gp`,
        });
      }

      if (data.gePrice > 0) {
        const unitPrice = data.gePrice.toLocaleString();
        const totalPrice = (data.gePrice * data.quantity).toLocaleString();
        lines.push({
          key: "grand-exchange",
          value: data.quantity > 1 ? `GE: ${totalPrice}gp (${unitPrice}gp each)` : `GE: ${unitPrice}gp`,
        });
      }
    } else if (data.type === "rune-pouch") {
      lines.push(
        { key: "name", value: data.name },
        { key: "after-name", type: "separator" },
        { key: "high-alch", value: `HA total: ${data.totalHighAlch.toLocaleString()}gp` },
        { key: "grand-exchange", value: `GE total: ${data.totalGePrice.toLocaleString()}gp` },
        { key: "after-prices", type: "separator" },
      );

      for (const { name, quantity } of data.runes) {
        lines.push({ key: `rune ${name} ${quantity}`, value: `${quantity.toLocaleString()} ${name}` });
      }
    }

    let previousWasSeparator = false;

    return lines.map(function addBreakInformation(line, index) {
      const lineWithBreak = { ...line, breakBefore: index > 0 && !previousWasSeparator && line.type !== "separator" };
      previousWasSeparator = line.type === "separator";

      return lineWithBreak;
    });
  }

  function positionTooltip() {
    if (!container.value || !tooltipElement.value?.hasChildNodes()) {
      return;
    }

    const { x, y } = pointerPosition.value;
    container.value.style.transform = `translate(${x}px, ${y}px)`;

    const rectangle = tooltipElement.value.getBoundingClientRect();
    const offsetX = x + 5 + rectangle.width > window.innerWidth ? -(rectangle.width + 5) : 5;
    const offsetY = y - rectangle.height - 5 < 0 ? 5 : -(rectangle.height + 5);
    tooltipElement.value.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }

  function getDataTooltipElement(target) {
    return target instanceof Element ? target.closest("[data-tooltip]") : null;
  }

  function handlePointerMove({ clientX: x, clientY: y }) {
    pointerPosition.value = { x, y };
    positionTooltip();
  }

  function handlePointerOver(event) {
    const hoveredElement = getDataTooltipElement(event.target);

    if (!hoveredElement) {
      return;
    }

    pointerPosition.value = { x: event.clientX, y: event.clientY };
    tooltip.value = deserializeTooltip(hoveredElement.dataset.tooltip ?? "");
  }

  function handlePointerOut(event) {
    if (getDataTooltipElement(event.target) !== getDataTooltipElement(event.relatedTarget)) {
      tooltip.value = undefined;
    }
  }

  function handlePointerDown() {
    tooltip.value = undefined;
  }

  watch(tooltip, async function repositionAfterContentChange() {
    await nextTick();
    positionTooltip();
  });
</script>

<template>
  <div id="tooltip-container" ref="container">
    <div id="tooltip" ref="tooltipElement" role="tooltip">
      <template v-if="typeof tooltip === 'string'">{{ tooltip }}</template>

      <template v-else-if="tooltip?.type === 'item' || tooltip?.type === 'rune-pouch'">
        <template v-for="line in itemLines" :key="line.key">
          <hr v-if="line.type === 'separator'" />
          <template v-else>
            <br v-if="line.breakBefore" />
            {{ line.value }}
          </template>
        </template>
      </template>

      <template v-else-if="tooltip?.type === 'skill-total'"
        >Total XP: {{ tooltip.experience.toLocaleString() }}</template
      >

      <template v-else-if="tooltip?.type === 'skill-individual'">
        Level: {{ tooltip.level.toLocaleString() }}
        <br />
        Total XP: {{ tooltip.experience.toLocaleString() }}
        <br />
        Until level: {{ tooltip.untilNext.toLocaleString() }}
        <StatBar
          :color="`hsl(${107 * tooltip.untilNextRatio}, 100%, 41%)`"
          bg-color="#222222"
          :ratio="tooltip.untilNextRatio"
        />
        Until max: {{ tooltip.untilMax.toLocaleString() }}
        <StatBar
          :color="`hsl(${107 * tooltip.untilMaxRatio}, 100%, 41%)`"
          bg-color="#222222"
          :ratio="tooltip.untilMaxRatio"
        />
      </template>

      <template v-else-if="tooltip?.type === 'item-price'">
        {{ tooltip.perPiecePrice.toLocaleString() }}gp × {{ tooltip.quantity.toLocaleString() }}
      </template>

      <template v-else-if="tooltip?.type === 'item-breakdown'">
        {{ tooltip.name }}
        <br />
        <hr />
        <div class="tooltip-item-breakdown">
          <template v-for="itemContainer in Member.itemContainerNames" :key="itemContainer">
            <template
              v-if="
                (tooltip.filter === 'All' || tooltip.filter === itemContainer) &&
                (tooltip.filter !== 'All' || (tooltip.breakdown[itemContainer] ?? 0) !== 0)
              "
            >
              <span>{{ itemContainer }}</span>
              <span>{{ (tooltip.breakdown[itemContainer] ?? 0).toLocaleString() }}</span>
            </template>
          </template>
        </div>
      </template>

      <template v-else-if="tooltip?.type === 'collection-log-item'">
        {{ tooltip.name }}
        <template v-for="member in tooltip.memberQuantities" :key="member.name">
          <br />
          <PlayerIcon :name="member.name" />
          {{ member.name }}: {{ member.quantity }}
        </template>
      </template>

      <template v-else-if="tooltip?.type === 'local-time'">
        Local time for {{ tooltip.name }}
        <br />
        Timezone: {{ tooltip.timezone }}
      </template>
    </div>
  </div>
</template>
