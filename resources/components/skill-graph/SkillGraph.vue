<script setup>
  import { computed, ref, watch } from "vue";
  import { Line } from "vue-chartjs";
  import {
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    TimeScale,
    Title,
    Tooltip,
  } from "chart.js";
  import * as DateFNS from "date-fns";
  import { aggregatePeriods } from "../../api/requests/skill-data";
  import { useApiStore } from "../../stores/api";
  import { useGroupStore } from "../../stores/group";
  import { skills, skillIcons } from "../../game/skill";
  import CachedImage from "../cached-image/CachedImage.vue";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import {
    buildDatasetsFromMemberSkillData,
    buildLineChartOptions,
    buildTableRowsFromMemberSkillData,
    enumerateDateBinsForPeriod,
    lineChartYAxisOptions,
  } from "./skill-graph-data";
  import "chartjs-adapter-date-fns";
  import "./skill-graph.css";

  ChartJS.register(CategoryScale, TimeScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

  const skillFilteringOptions = ["Overall", ...skills];

  const apiStore = useApiStore();
  const groupStore = useGroupStore();

  const period = ref("Day");
  const yAxisUnit = ref("Cumulative experience gained");
  const skillFilter = ref("Overall");
  const tableData = ref();
  const chart = ref({
    data: { datasets: [] },
    options: buildLineChartOptions({ period: period.value, yAxisUnit: yAxisUnit.value }),
  });
  const loading = ref(true);

  let updateChartPromise;

  const hasChartData = computed(() => chart.value.data.datasets.length > 0);

  const chartRows = computed(() => {
    return (tableData.value?.rows ?? []).map(function prepareChartRow(row) {
      const fillPercent = Math.max(0.1, Math.min(100, 100 * row.fillFraction));

      return {
        ...row,
        key: `${row.iconSource} ${row.name} ${row.quantity} ${row.fillFraction} ${row.colorCSS}`,
        background: `linear-gradient(90deg, ${row.colorCSS} ${fillPercent}%, transparent ${fillPercent}%)`,
      };
    });
  });

  function configureChartDefaults() {
    const style = getComputedStyle(document.body);
    ChartJS.defaults.font.family = "rssmall";
    ChartJS.defaults.font.size = 16;
    ChartJS.defaults.color = style.getPropertyValue("--white");
    ChartJS.defaults.scale.grid.color = style.getPropertyValue("--graph-grid-border");
  }

  function buildMemberChartData(skillData) {
    const memberChartData = [];

    for (const [member, skillSamples] of skillData) {
      const hueDegrees = groupStore.memberColors.get(member)?.hueDegrees;
      if (!hueDegrees || skillSamples.length === 0) {
        continue;
      }

      memberChartData.push({
        member,
        style: {
          lineBorder: `hsl(${hueDegrees}deg 60% 50%)`,
          lineBackground: `hsl(${hueDegrees}deg 60% 40%)`,
          barBackground: `hsl(${hueDegrees}deg 60% 40%)`,
        },
        skillSamples: [...skillSamples].sort(function sortSamples({ time: firstTime }, { time: secondTime }) {
          return DateFNS.compareAsc(firstTime, secondTime);
        }),
      });
    }

    return memberChartData;
  }

  function buildTableData(memberChartData, dateBins) {
    const data = {
      title: "",
      numberPrefix: "",
      rows: buildTableRowsFromMemberSkillData(memberChartData, dateBins, {
        yAxisUnit: yAxisUnit.value,
        skillFilter: skillFilter.value,
      }),
    };

    switch (yAxisUnit.value) {
      case "Cumulative experience gained":
        data.title = `Experience gained over the preceding ${period.value.toLowerCase()}`;
        data.numberPrefix = "+";
        break;
      case "Total experience":
        data.title = "Current total experience";
        break;
      case "Experience per hour":
        data.title = `Experience per hour averaged over the preceding ${period.value.toLowerCase()}`;
        data.numberPrefix = "+";
        break;
    }

    return data;
  }

  function updateSkillGraph() {
    if (!apiStore.client) {
      return;
    }

    const selectedPeriod = period.value;
    const selectedYAxisUnit = yAxisUnit.value;
    const selectedSkillFilter = skillFilter.value;
    loading.value = true;

    const promise = Promise.allSettled([
      apiStore.client.fetchSkillData(selectedPeriod),
      new Promise(function waitForLoadingIndicator(resolve) {
        setTimeout(resolve, 1000);
      }),
    ])
      .then(function renderSkillData([result]) {
        if (result.status !== "fulfilled" || updateChartPromise !== promise) {
          return;
        }

        const dateBins = enumerateDateBinsForPeriod(selectedPeriod);
        const memberChartData = buildMemberChartData(result.value);
        const datasets = buildDatasetsFromMemberSkillData(memberChartData, dateBins, {
          yAxisUnit: selectedYAxisUnit,
          skillFilter: selectedSkillFilter,
        }).map(function configureDataset(dataset) {
          return {
            ...dataset,
            pointBorderWidth: 0,
            pointHoverBorderWidth: 0,
            pointHoverRadius: 3,
            pointRadius: 0,
            borderWidth: 2,
          };
        });

        chart.value = {
          data: { datasets },
          options: buildLineChartOptions({ period: selectedPeriod, yAxisUnit: selectedYAxisUnit }),
        };
        tableData.value = buildTableData(memberChartData, dateBins);
      })
      .finally(function finishLoading() {
        if (updateChartPromise !== promise) {
          return;
        }

        updateChartPromise = undefined;
        loading.value = false;
      });

    updateChartPromise = promise;
  }

  configureChartDefaults();

  watch(
    [
      period,
      yAxisUnit,
      skillFilter,
      function getClient() {
        return apiStore.client;
      },
      function getMemberColors() {
        return groupStore.memberColors;
      },
    ],
    updateSkillGraph,
    { immediate: true },
  );
</script>

<template>
  <div id="skill-graph-control-container">
    <select v-model="period" class="rsborder-tiny rsbackground rsbackground-hover">
      <option v-for="option in aggregatePeriods" :key="option" :value="option">{{ option }}</option>
    </select>
    <select v-model="yAxisUnit" class="rsborder-tiny rsbackground rsbackground-hover">
      <option v-for="option in lineChartYAxisOptions" :key="option" :value="option">{{ option }}</option>
    </select>
    <select v-model="skillFilter" class="rsborder-tiny rsbackground rsbackground-hover">
      <option v-for="option in skillFilteringOptions" :key="option" :value="option">{{ option }}</option>
    </select>
  </div>

  <div id="skill-graph-body" class="rsborder rsbackground">
    <div id="skill-graph-container" class="rsborder-tiny">
      <CachedImage id="skill-graph-skill-image" :alt="skillFilter" loading="lazy" :src="skillIcons[skillFilter]" />
      <div id="skill-graph-line-chart-container">
        <Line :options="chart.options" :data="chart.data" />
      </div>
    </div>

    <div v-if="!loading && !hasChartData" id="skill-graph-no-data">
      <h3>Your group has no recorded skill data!</h3>
      <p>
        Either no members have logged in more than a couple hours with the plugin, or there is an issue. Please double
        check that the names in the <RouterLink to="../settings" class="orange-link">settings</RouterLink> page
        <span class="emphasize">exactly</span> match your group members' in-game display names.
      </p>
    </div>

    <table v-else-if="hasChartData && tableData" id="skill-graph-xp-change-table">
      <thead>
        <tr>
          <th colspan="2">{{ tableData.title }}</th>
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
              <CachedImage alt="attack" :src="row.iconSource" />
            </span>
            {{ row.name }}
          </td>
          <td class="skill-graph-xp-change-data">{{ tableData.numberPrefix }}{{ row.quantity.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="loading" id="skill-graph-loading-overlay">
      <LoadingScreen />
    </div>
  </div>
</template>
