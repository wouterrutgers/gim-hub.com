<script setup>
  import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
  import { Line } from "vue-chartjs";
  import { Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, TimeScale, Tooltip } from "chart.js";
  import { useApiStore } from "../../stores/api";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import { rangeForPeriod } from "../../api/requests/skill-data";
  import { skills, skillIcons } from "../../game/skill";
  import CachedImage from "../cached-image/CachedImage.vue";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import {
    buildDatasetsFromMemberSkillData,
    buildLineChartOptions,
    buildTableRowsFromMemberSkillData,
    lineChartYAxisOptions,
  } from "./skill-graph-data";
  import "chartjs-adapter-date-fns";
  import "./skill-graph.css";

  ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

  const skillFilteringOptions = ["Overall", ...skills];
  const historyPresets = {
    Day: "24 hours",
    Week: "7 days",
    Month: "Month",
    Year: "Year",
    All: "All",
  };
  const apiStore = useApiStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();
  const lastPreset = ref("Day");
  const activePreset = ref("Day");
  const yAxisUnit = ref("Cumulative experience gained");
  const skillFilter = ref("Overall");
  const latest = ref(new Date());
  const range = ref(rangeForPeriod(lastPreset.value, latest.value));
  const memberExpansion = ref(new Map());
  const history = shallowRef();
  const loading = ref(false);
  const error = ref(false);
  let requestSequence = 0;

  const memberChartData = computed(function buildMemberChartData() {
    const members = [];

    for (const [member, skillSamples] of history.value?.members ?? []) {
      if (!groupStore.memberColors.has(member) || !skillSamples.length) {
        continue;
      }

      const { hueDegrees } = groupStore.memberColors.get(member);
      members.push({
        member,
        skillSamples,
        style: {
          lineBorder: `hsl(${hueDegrees}deg 60% 50%)`,
          lineBackground: `hsl(${hueDegrees}deg 60% 40%)`,
          barBackground: `hsl(${hueDegrees}deg 60% 40%)`,
        },
      });
    }

    return members;
  });

  const chart = computed(function buildChart() {
    return {
      data: {
        datasets: buildDatasetsFromMemberSkillData(memberChartData.value, range.value, {
          yAxisUnit: yAxisUnit.value,
          skillFilter: skillFilter.value,
        }),
      },
      options: buildLineChartOptions({
        range: range.value,
        yAxisUnit: yAxisUnit.value,
      }),
    };
  });
  const hasChartData = computed(function hasData() {
    return chart.value.data.datasets.some(function hasPoints(dataset) {
      return dataset.data.length > 0;
    });
  });
  const dateRangeLabel = computed(function formatRange() {
    if (!range.value.start) {
      return "All recorded history";
    }

    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year:
        range.value.start.getFullYear() !== latest.value.getFullYear() ||
        range.value.end.getFullYear() !== latest.value.getFullYear()
          ? "numeric"
          : undefined,
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${dateFormatter.format(range.value.start)} to ${dateFormatter.format(range.value.end)}`;
  });
  const canGoPrevious = computed(function hasEarlierHistory() {
    return history.value?.earliest && range.value.start > history.value.earliest;
  });
  const canGoNext = computed(function hasLaterHistory() {
    return history.value?.earliest && range.value.end < latest.value;
  });
  const tableTitle = computed(function describeMetric() {
    return {
      "Cumulative experience gained": "XP gained in this period",
      "Total experience": "Total XP at the end of this period",
      "Experience per hour": "Average XP/h in this period",
    }[yAxisUnit.value];
  });
  const chartRows = computed(function buildRows() {
    return buildTableRowsFromMemberSkillData(memberChartData.value, range.value, {
      yAxisUnit: yAxisUnit.value,
      skillFilter: skillFilter.value,
    }).map(function prepareRow(row) {
      const fillPercent = 100 * row.fillFraction;

      return {
        ...row,
        background: `linear-gradient(90deg, color-mix(in srgb, ${row.colorCSS} 24%, transparent) ${fillPercent}%, transparent ${fillPercent}%)`,
      };
    });
  });

  function invalidateRequest() {
    requestSequence += 1;
  }

  async function requestRange(requestedRange) {
    invalidateRequest();

    if (!apiStore.client) {
      return;
    }

    const sequence = requestSequence;
    loading.value = true;
    error.value = false;

    if (!requestedRange.period) {
      range.value = requestedRange;
    }

    try {
      const result = await apiStore.client.fetchSkillData(requestedRange);

      if (sequence !== requestSequence) {
        return;
      }

      if (requestedRange.period) {
        latest.value = result.end;
      }

      history.value = result;
      range.value = { start: result.start, end: result.end };
    } catch (reason) {
      if (sequence === requestSequence) {
        console.error("Unable to load skill history", reason);
        error.value = true;
      }
    } finally {
      if (sequence === requestSequence) {
        loading.value = false;
      }
    }
  }

  function selectPreset(preset) {
    lastPreset.value = preset;
    activePreset.value = preset;
    requestRange({ period: preset });
  }

  function shiftPeriod(direction) {
    const duration = range.value.end - range.value.start;
    const start = Math.min(
      latest.value.getTime() - duration,
      Math.max(history.value.earliest.getTime(), range.value.start.getTime() + direction * duration),
    );
    activePreset.value = undefined;
    requestRange({ start: new Date(start), end: new Date(start + duration) });
  }

  function isMemberExpanded(member) {
    return memberExpansion.value.get(member) ?? settingsStore.expandPlayerHistory;
  }

  function toggleMember(member) {
    memberExpansion.value.set(member, !isMemberExpanded(member));
  }

  function retry() {
    requestRange(activePreset.value ? { period: activePreset.value } : range.value);
  }

  const style = getComputedStyle(document.body);
  ChartJS.defaults.font.family = "rssmall";
  ChartJS.defaults.font.size = 16;
  ChartJS.defaults.color = style.getPropertyValue("--white");
  ChartJS.defaults.scale.grid.color = style.getPropertyValue("--graph-grid-border");

  watch(
    function getClient() {
      return apiStore.client;
    },
    function resetHistory() {
      history.value = undefined;
      memberExpansion.value.clear();
      selectPreset(lastPreset.value);
    },
    { immediate: true },
  );
  onBeforeUnmount(invalidateRequest);
</script>

<template>
  <div id="skill-graph-control-container" class="rsborder-tiny rsbackground">
    <div id="skill-graph-presets" role="group" aria-label="History period">
      <button
        v-for="(label, preset) in historyPresets"
        :key="preset"
        type="button"
        :aria-pressed="activePreset === preset"
        @click="selectPreset(preset)"
      >
        {{ label }}
      </button>
    </div>
    <div id="skill-graph-period-navigation" role="group" aria-label="Period navigation">
      <button
        type="button"
        aria-label="Previous period"
        class="rsborder-tiny rsbackground rsbackground-hover"
        :disabled="loading || !canGoPrevious"
        @click="shiftPeriod(-1)"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <p id="skill-graph-range" aria-live="polite">{{ dateRangeLabel }}</p>
      <button
        type="button"
        aria-label="Next period"
        class="rsborder-tiny rsbackground rsbackground-hover"
        :disabled="loading || !canGoNext"
        @click="shiftPeriod(1)"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
    <div id="skill-graph-filters">
      <span class="select-container">
        <select aria-label="Skill" v-model="skillFilter">
          <option v-for="option in skillFilteringOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </span>
      <span class="select-container">
        <select aria-label="Experience metric" v-model="yAxisUnit">
          <option v-for="(label, value) in lineChartYAxisOptions" :key="value" :value="value">{{ label }}</option>
        </select>
      </span>
    </div>
  </div>

  <div id="skill-graph-body" class="rsborder rsbackground" :aria-busy="loading">
    <div id="skill-graph-container" class="rsborder-tiny">
      <CachedImage id="skill-graph-skill-image" :alt="skillFilter" loading="lazy" :src="skillIcons[skillFilter]" />
      <div id="skill-graph-line-chart-container">
        <Line :options="chart.options" :data="chart.data" aria-label="Skill progress by player over time" />
      </div>
    </div>

    <div v-if="error" id="skill-graph-error" role="alert">
      <p>Skill history could not be loaded.</p>
      <button type="button" class="rsborder-tiny rsbackground rsbackground-hover" @click="retry">Try again</button>
    </div>
    <div v-else-if="!loading && !hasChartData" id="skill-graph-no-data">
      <p>
        No skill history is available for this period. New samples are recorded every five minutes while the plugin
        sends updates.
      </p>
    </div>

    <table v-else-if="hasChartData" id="skill-graph-xp-change-table">
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">{{ tableTitle }}</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in chartRows" :key="row.key">
          <tr
            v-if="row.isMemberHeader || isMemberExpanded(row.memberName)"
            :class="{ 'skill-graph-member-header': row.isMemberHeader }"
            :style="{ background: row.background }"
          >
            <th scope="row" class="skill-graph-xp-change-table-label">
              <span
                v-if="row.isMemberHeader"
                class="skill-graph-member-color"
                :style="{ background: row.colorCSS }"
              ></span>
              <span v-else class="skill-graph-xp-change-table-image-container">
                <CachedImage alt="" :src="row.iconSource" />
              </span>
              <button
                v-if="row.isMemberHeader && skillFilter === 'Overall' && row.quantity > 0"
                type="button"
                class="skill-graph-member-toggle"
                :aria-expanded="isMemberExpanded(row.name)"
                :aria-label="`${isMemberExpanded(row.name) ? 'Hide' : 'Show'} skill details for ${row.name}`"
                @click="toggleMember(row.name)"
              >
                <span class="skill-graph-row-name">{{ row.name }}</span>
              </button>
              <span v-else class="skill-graph-row-name">{{ row.name }}</span>
            </th>
            <td class="skill-graph-xp-change-data">
              {{ yAxisUnit === "Cumulative experience gained" ? "+" : "" }}{{ row.quantity.toLocaleString() }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <div v-if="loading" id="skill-graph-loading-overlay">
      <LoadingScreen />
    </div>
  </div>
</template>
