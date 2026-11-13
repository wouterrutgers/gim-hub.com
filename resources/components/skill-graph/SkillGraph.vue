<script setup>
  import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
  import { Line } from "vue-chartjs";
  import { Chart as ChartJS, LinearScale, LineElement, PointElement, TimeScale, Tooltip } from "chart.js";
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

  ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip);

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
  const hiddenChartMembers = ref(new Set());
  const history = shallowRef();
  const loading = ref(false);
  const error = ref(false);
  let requestSequence = 0;

  const memberChartData = computed(function buildMemberChartData() {
    const members = [];
    const lineLightness = settingsStore.siteTheme === "light" ? 35 : 65;

    for (const [member, skillSamples] of history.value?.members ?? []) {
      if (!groupStore.memberColors.has(member) || !skillSamples.length) {
        continue;
      }

      const { hueDegrees } = groupStore.memberColors.get(member);
      members.push({
        member,
        skillSamples,
        style: {
          lineBorder: `hsl(${hueDegrees}deg 60% ${lineLightness}%)`,
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
        }).map(function setVisibility(dataset) {
          return { ...dataset, hidden: hiddenChartMembers.value.has(dataset.label) };
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
  const allChartMembersHidden = computed(function allMembersHidden() {
    return (
      hasChartData.value &&
      chart.value.data.datasets.every(function isHidden(dataset) {
        return dataset.hidden;
      })
    );
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
  const periodSummary = computed(function summarizeProgress() {
    const members = chartRows.value.filter(function memberRow(row) {
      return row.isMemberHeader;
    });

    return {
      experienceGained: members.reduce(function totalExperience(total, member) {
        return total + member.experienceGained;
      }, 0),
      levelsGained: members.reduce(function totalLevels(total, member) {
        return total + member.levelsGained;
      }, 0),
      activePlayers: members.filter(function gainedExperience(member) {
        return member.experienceGained > 0;
      }).length,
      sampledPlayers: members.length,
      topContributor: members.reduce(function mostExperience(top, member) {
        return member.experienceGained > (top?.experienceGained ?? 0) ? member : top;
      }, undefined),
    };
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

  function toggleChartMember(member) {
    if (hiddenChartMembers.value.has(member)) {
      hiddenChartMembers.value.delete(member);

      return;
    }

    hiddenChartMembers.value.add(member);
  }

  function retry() {
    requestRange(activePreset.value ? { period: activePreset.value } : range.value);
  }

  const style = getComputedStyle(document.body);
  ChartJS.defaults.font.family = style.fontFamily;
  ChartJS.defaults.font.size = 12;
  ChartJS.defaults.color = style.getPropertyValue("--white");
  ChartJS.defaults.scale.grid.color = style.getPropertyValue("--graph-grid-border");

  watch(
    function getClient() {
      return apiStore.client;
    },
    function resetHistory() {
      history.value = undefined;
      memberExpansion.value.clear();
      hiddenChartMembers.value.clear();
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
        <span class="chevron chevron-left" aria-hidden="true" />
      </button>
      <p id="skill-graph-range" aria-live="polite">{{ dateRangeLabel }}</p>
      <button
        type="button"
        aria-label="Next period"
        class="rsborder-tiny rsbackground rsbackground-hover"
        :disabled="loading || !canGoNext"
        @click="shiftPeriod(1)"
      >
        <span class="chevron chevron-right" aria-hidden="true" />
      </button>
    </div>
    <div id="skill-graph-filters">
      <label class="skill-graph-field" for="skill-graph-skill">
        <span>Skill</span>
        <span class="select-container">
          <select id="skill-graph-skill" v-model="skillFilter">
            <option v-for="option in skillFilteringOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </span>
      </label>
      <label class="skill-graph-field" for="skill-graph-metric">
        <span>Chart metric</span>
        <span class="select-container">
          <select id="skill-graph-metric" v-model="yAxisUnit">
            <option v-for="(label, value) in lineChartYAxisOptions" :key="value" :value="value">{{ label }}</option>
          </select>
        </span>
      </label>
    </div>
  </div>

  <div id="skill-graph-body" class="rsborder rsbackground" :aria-busy="loading">
    <div v-if="error" id="skill-graph-error" role="alert">
      <p>Skill history could not be loaded.</p>
      <button type="button" class="rsborder-tiny rsbackground rsbackground-hover" @click="retry">Try again</button>
    </div>
    <div v-else id="skill-graph-content" :inert="loading">
      <dl v-if="hasChartData" id="skill-graph-summary">
        <div>
          <dt>XP gained</dt>
          <dd>+{{ periodSummary.experienceGained.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Levels gained</dt>
          <dd>{{ periodSummary.levelsGained > 0 ? "+" : "" }}{{ periodSummary.levelsGained.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Active players</dt>
          <dd>{{ periodSummary.activePlayers }} / {{ periodSummary.sampledPlayers }}</dd>
        </div>
        <div>
          <dt>Top contributor</dt>
          <dd>
            {{ periodSummary.topContributor?.name ?? "No XP gained" }}
            <span v-if="periodSummary.topContributor" class="skill-graph-summary-detail">
              +{{ periodSummary.topContributor.experienceGained.toLocaleString() }} XP
            </span>
          </dd>
        </div>
      </dl>

      <header id="skill-graph-heading">
        <h3>{{ skillFilter }} progress</h3>
        <p class="skill-graph-metric-label">{{ lineChartYAxisOptions[yAxisUnit] }}</p>
      </header>

      <div v-if="hasChartData" id="skill-graph-legend" role="group" aria-label="Chart players">
        <span class="skill-graph-legend-label">Chart players</span>
        <button
          v-for="dataset in chart.data.datasets"
          :key="dataset.label"
          type="button"
          :aria-pressed="!dataset.hidden"
          :disabled="loading"
          @click="toggleChartMember(dataset.label)"
        >
          <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
            <line
              x1="1"
              y1="6"
              x2="27"
              y2="6"
              :stroke="dataset.borderColor"
              stroke-width="3"
              :stroke-dasharray="dataset.borderDash?.join(' ')"
            />
          </svg>
          <span>{{ dataset.label }}</span>
        </button>
      </div>

      <div id="skill-graph-container" class="rsborder-tiny">
        <CachedImage id="skill-graph-skill-image" alt="" loading="lazy" :src="skillIcons[skillFilter]" />
        <div id="skill-graph-line-chart-container">
          <Line
            :options="chart.options"
            :data="chart.data"
            :aria-label="`${skillFilter} ${lineChartYAxisOptions[yAxisUnit]} by player, ${dateRangeLabel}`"
            :aria-describedby="hasChartData ? 'skill-graph-summary' : undefined"
          />
        </div>
        <p v-if="allChartMembersHidden" id="skill-graph-hidden-lines">Choose a player above to show their progress.</p>
      </div>

      <div v-if="!loading && !hasChartData" id="skill-graph-no-data">
        <p>
          No skill history is available for this period. New samples are recorded every five minutes while the plugin
          sends updates.
        </p>
      </div>

      <div
        v-else-if="hasChartData"
        id="skill-graph-table-scroll"
        role="region"
        aria-label="Player skill progress"
        tabindex="0"
      >
        <table
          id="skill-graph-xp-change-table"
          :class="{ 'has-total-experience': yAxisUnit === 'Total experience' }"
          :aria-label="`${skillFilter} progress`"
        >
          <thead>
            <tr>
              <th scope="col">Player / skill</th>
              <th scope="col">XP gained</th>
              <th scope="col">XP/h</th>
              <th v-if="yAxisUnit === 'Total experience'" scope="col">Total XP</th>
              <th scope="col">Level</th>
              <th scope="col">Levels gained</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in chartRows" :key="row.key">
              <tr
                v-if="row.isMemberHeader || isMemberExpanded(row.memberName)"
                :class="{ 'skill-graph-member-header': row.isMemberHeader }"
              >
                <th
                  scope="row"
                  class="skill-graph-xp-change-table-label"
                  :aria-label="row.isMemberHeader ? undefined : `${row.memberName}: ${row.name}`"
                  :style="{ backgroundImage: row.background }"
                >
                  <span class="skill-graph-row-label">
                    <span
                      v-if="row.isMemberHeader"
                      class="skill-graph-member-color"
                      :style="{ background: row.colorCSS }"
                      aria-hidden="true"
                    ></span>
                    <span v-else class="skill-graph-xp-change-table-image-container">
                      <CachedImage alt="" :src="row.iconSource" />
                    </span>
                    <button
                      v-if="row.isMemberHeader && skillFilter === 'Overall' && row.experienceGained > 0"
                      type="button"
                      class="skill-graph-member-toggle"
                      :aria-expanded="isMemberExpanded(row.name)"
                      :aria-label="`${isMemberExpanded(row.name) ? 'Hide' : 'Show'} skill details for ${row.name}`"
                      @click="toggleMember(row.name)"
                    >
                      <span class="skill-graph-row-name">{{ row.name }}</span>
                      <span
                        class="chevron"
                        :class="{ 'chevron-right': !isMemberExpanded(row.name) }"
                        aria-hidden="true"
                      />
                    </button>
                    <span v-else class="skill-graph-row-name">{{ row.name }}</span>
                  </span>
                </th>
                <td class="skill-graph-xp-change-data">+{{ row.experienceGained.toLocaleString() }}</td>
                <td class="skill-graph-rate">{{ row.experiencePerHour.toLocaleString() }}</td>
                <td v-if="yAxisUnit === 'Total experience'" class="skill-graph-total-experience">
                  {{ row.quantity.toLocaleString() }}
                </td>
                <td class="skill-graph-level">
                  <template v-if="row.startLevel !== row.endLevel">{{ row.startLevel.toLocaleString() }} → </template>
                  {{ row.endLevel.toLocaleString() }}
                  <span v-if="row.isMemberHeader && skillFilter === 'Overall'" class="skill-graph-level-kind">
                    total
                  </span>
                </td>
                <td class="skill-graph-level-gain" :class="{ 'has-gain': row.levelsGained > 0 }">
                  {{ row.levelsGained > 0 ? "+" : "" }}{{ row.levelsGained.toLocaleString() }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="loading" id="skill-graph-loading-overlay">
      <LoadingScreen />
    </div>
  </div>
</template>
