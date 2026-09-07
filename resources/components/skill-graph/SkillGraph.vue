<script setup>
  import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
  import { Line } from "vue-chartjs";
  import { Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, TimeScale, Tooltip } from "chart.js";
  import zoomPlugin from "chartjs-plugin-zoom";
  import { useApiStore } from "../../stores/api";
  import { useGroupStore } from "../../stores/group";
  import { skills, skillIcons } from "../../game/skill";
  import CachedImage from "../cached-image/CachedImage.vue";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import {
    buildDatasetsFromMemberSkillData,
    buildLineChartOptions,
    buildTableRowsFromMemberSkillData,
    rangeForPeriod,
    lineChartYAxisOptions,
  } from "./skill-graph-data";
  import "chartjs-adapter-date-fns";
  import "./skill-graph.css";

  ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend, zoomPlugin);

  const skillFilteringOptions = ["Overall", ...skills];
  const historyPresets = ["Day", "Week", "Month", "Year", "All"];
  const apiStore = useApiStore();
  const groupStore = useGroupStore();
  const lastPreset = ref("Day");
  const activePreset = ref("Day");
  const yAxisUnit = ref("Cumulative experience gained");
  const skillFilter = ref("Overall");
  const latest = ref(new Date());
  const range = ref(rangeForPeriod(lastPreset.value, latest.value));
  const history = shallowRef();
  const loading = ref(false);
  const error = ref(false);
  let requestSequence = 0;
  let navigationTimer;

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
        earliest: history.value?.earliest,
        latest: latest.value,
        yAxisUnit: yAxisUnit.value,
        onNavigate: navigate,
        onNavigateStart: invalidateRequest,
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
    return `${range.value.start.toLocaleString()} – ${range.value.end.toLocaleString()}`;
  });
  const tableTitle = computed(function describeMetric() {
    return {
      "Cumulative experience gained": "Experience gained in the visible period",
      "Total experience": "Total experience at the end of the visible period",
      "Experience per hour": "Experience per hour averaged over the visible period",
    }[yAxisUnit.value];
  });
  const chartRows = computed(function buildRows() {
    return buildTableRowsFromMemberSkillData(memberChartData.value, range.value, {
      yAxisUnit: yAxisUnit.value,
      skillFilter: skillFilter.value,
    }).map(function prepareRow(row) {
      const fillPercent = Math.max(0.1, 100 * row.fillFraction);
      return {
        ...row,
        key: `${row.name} ${row.iconSource} ${row.isMemberHeader}`,
        background: `linear-gradient(90deg, ${row.colorCSS} ${fillPercent}%, transparent ${fillPercent}%)`,
      };
    });
  });

  function invalidateRequest() {
    clearTimeout(navigationTimer);
    requestSequence += 1;
  }

  async function loadRange(requestedRange, sequence) {
    try {
      const result = await apiStore.client.fetchSkillData(requestedRange);
      if (sequence !== requestSequence) {
        return;
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

  function requestRange(requestedRange, delay = 0) {
    invalidateRequest();
    if (!apiStore.client) {
      return;
    }
    const sequence = requestSequence;
    loading.value = true;
    error.value = false;
    range.value = requestedRange;
    if (delay) {
      navigationTimer = setTimeout(function fetchVisibleRange() {
        loadRange(requestedRange, sequence);
      }, delay);
    } else {
      loadRange(requestedRange, sequence);
    }
  }

  function navigate({ chart: chartInstance }) {
    chartInstance.setActiveElements([]);
    chartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
    if (
      chartInstance.scales.x.min !== range.value.start?.getTime() ||
      chartInstance.scales.x.max !== range.value.end.getTime()
    ) {
      activePreset.value = undefined;
    }
    requestRange({ start: new Date(chartInstance.scales.x.min), end: new Date(chartInstance.scales.x.max) }, 300);
  }

  function selectPreset(preset) {
    lastPreset.value = preset;
    resetZoom();
  }

  function resetZoom() {
    latest.value = new Date();
    activePreset.value = lastPreset.value;
    requestRange(rangeForPeriod(lastPreset.value, latest.value));
  }

  function retry() {
    requestRange(range.value);
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
      resetZoom();
    },
    { immediate: true },
  );
  onBeforeUnmount(invalidateRequest);
</script>

<template>
  <div id="skill-graph-control-container">
    <div id="skill-graph-presets" class="rsbackground" role="group" aria-label="History period">
      <button
        v-for="preset in historyPresets"
        :key="preset"
        type="button"
        :aria-pressed="activePreset === preset"
        @click="selectPreset(preset)"
      >
        {{ preset }}
      </button>
    </div>
    <select aria-label="Experience metric" v-model="yAxisUnit" class="rsborder-tiny rsbackground rsbackground-hover">
      <option v-for="option in lineChartYAxisOptions" :key="option" :value="option">{{ option }}</option>
    </select>
    <select aria-label="Skill" v-model="skillFilter" class="rsborder-tiny rsbackground rsbackground-hover">
      <option v-for="option in skillFilteringOptions" :key="option" :value="option">{{ option }}</option>
    </select>
    <button type="button" class="rsborder-tiny rsbackground rsbackground-hover" @click="resetZoom">Reset zoom</button>
  </div>
  <div id="skill-graph-details" class="rsborder-tiny rsbackground">
    <p id="skill-graph-range">{{ dateRangeLabel }}</p>
    <p id="skill-graph-navigation-help">Scroll or pinch to zoom. Drag to pan.</p>
  </div>

  <div id="skill-graph-body" class="rsborder rsbackground">
    <div id="skill-graph-container" class="rsborder-tiny">
      <CachedImage id="skill-graph-skill-image" :alt="skillFilter" loading="lazy" :src="skillIcons[skillFilter]" />
      <div id="skill-graph-line-chart-container">
        <Line :options="chart.options" :data="chart.data" />
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
          <th colspan="2">{{ tableTitle }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in chartRows"
          :key="row.key"
          :class="{ 'skill-graph-member-header': row.isMemberHeader }"
          :style="{ background: row.background }"
        >
          <td class="skill-graph-xp-change-table-label">
            <span class="skill-graph-xp-change-table-image-container">
              <CachedImage :alt="row.name" :src="row.iconSource" />
            </span>
            {{ row.name }}
          </td>
          <td class="skill-graph-xp-change-data">
            {{ yAxisUnit === "Total experience" ? "" : "+" }}{{ row.quantity.toLocaleString() }}
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="loading" id="skill-graph-loading-overlay">
      <LoadingScreen />
    </div>
  </div>
</template>
