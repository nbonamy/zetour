<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import GameCanvas from "./components/GameCanvas.vue";
import UpgradeGraph from "./components/UpgradeGraph.vue";
import {
  buildElevationProfile,
  displayStageDistanceKm,
  elevationAtProgress,
  gameStore,
  powerUpDefinitions,
  stages,
} from "./core/gameStore";
import { formatRaceTime } from "./core/timeTrial";

const snapshot = shallowRef(gameStore.getSnapshot());
const workshopOpen = ref(false);
const resetConfirmationOpen = ref(false);
const ridePaused = computed(
  () =>
    workshopOpen.value ||
    resetConfirmationOpen.value ||
    snapshot.value.raceFinished,
);
const reservedPowerUp = computed(() =>
  snapshot.value.reservedPowerUp
    ? powerUpDefinitions[snapshot.value.reservedPowerUp]
    : null,
);
const activePowerUp = computed(() =>
  snapshot.value.activePowerUp
    ? {
        ...powerUpDefinitions[snapshot.value.activePowerUp.type],
        remainingSeconds: snapshot.value.activePowerUp.remainingSeconds,
      }
    : null,
);
const windLabel = computed(() => {
  const stage = snapshot.value.stageDefinition;
  if (stage.windPenalty <= 0) return "Calm";
  const raw = Math.round(stage.windPenalty * 100);
  const effective = Math.round(snapshot.value.stats.effectiveWindPenalty * 100);
  return snapshot.value.stats.windMitigation > 0
    ? `${effective}% after aero`
    : `${raw}% headwind`;
});
const gradeLabel = computed(() => {
  const gradient = snapshot.value.currentGradient;
  if (gradient > 0.0005) return `↗ ${(gradient * 100).toFixed(1)}%`;
  if (gradient < -0.0005) return `↘ ${Math.abs(gradient * 100).toFixed(1)}%`;
  return "Flat";
});
const leaderboardDeltaLabel = computed(() => {
  const { deltaSeconds, status } = snapshot.value.leaderboard;
  if (status === "even") return "On record pace";
  return `${Math.abs(deltaSeconds).toFixed(1)}s ${status}`;
});
const raceDeltaLabel = computed(() => {
  const delta = snapshot.value.raceResults?.deltaSeconds ?? 0;
  if (Math.abs(delta) < 0.05) return "Record pace";
  return `${Math.abs(delta).toFixed(1)}s ${delta < 0 ? "ahead" : "behind"}`;
});
const terrainProfile = computed(() => {
  const stage = snapshot.value.stageDefinition;
  const points = buildElevationProfile(stage, 60);
  const elevations = points.map(({ elevationM }) => elevationM);
  const minimum = Math.min(...elevations);
  const maximum = Math.max(...elevations);
  const padding = Math.max(0.5, (maximum - minimum) * 0.06);
  const lower = minimum - padding;
  const upper = maximum + padding;
  const span = Math.max(1, upper - lower);
  const y = (elevationM: number): number =>
    21 - ((elevationM - lower) / span) * 18;

  return {
    points: points
      .map(
        ({ progress, elevationM }) =>
          `${progress * 100},${y(elevationM)}`,
      )
      .join(" "),
    startY: y(0),
    markerX: snapshot.value.stageProgress * 100,
    markerY: y(elevationAtProgress(stage, snapshot.value.stageProgress)),
  };
});
const notice = ref<{ message: string; tone: "good" | "bad" | "neutral" } | null>(
  null,
);
let noticeTimer: number | undefined;

const unsubscribe = gameStore.subscribe((next) => {
  snapshot.value = next;
});
const unsubscribeNotices = gameStore.subscribeToNotices((message, tone) => {
  notice.value = { message, tone };
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.value = null;
  }, 2_200);
});

onBeforeUnmount(() => {
  unsubscribe();
  unsubscribeNotices();
  window.clearTimeout(noticeTimer);
});

const format = (value: number): string =>
  new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(value);

const openWorkshop = (): void => {
  if (snapshot.value.raceFinished) return;
  workshopOpen.value = true;
};

const closeWorkshop = (): void => {
  workshopOpen.value = false;
};

const requestReset = (): void => {
  resetConfirmationOpen.value = true;
};

const cancelReset = (): void => {
  resetConfirmationOpen.value = false;
};

const confirmReset = (): void => {
  gameStore.resetCareer();
  resetConfirmationOpen.value = false;
  workshopOpen.value = false;
};

const activatePowerUp = (): void => {
  if (!ridePaused.value) gameStore.activateReservedPowerUp();
};

const restartRace = (): void => {
  gameStore.restartRace();
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" && resetConfirmationOpen.value) {
    cancelReset();
  } else if (event.key === "Escape" && workshopOpen.value) {
    closeWorkshop();
  } else if (
    event.key.toLowerCase() === "w" &&
    !resetConfirmationOpen.value
  ) {
    workshopOpen.value ? closeWorkshop() : openWorkshop();
  } else if (event.code === "Space" && !ridePaused.value) {
    event.preventDefault();
    activatePowerUp();
  }
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="app-shell">
    <header class="masthead">
      <h1>Ze Tour</h1>
      <div class="resource-strip" aria-label="Game resources">
        <div
          class="resource sweat"
          :aria-label="`Sweat balance: ${format(snapshot.sweat)}`"
        >
          <span class="resource-icon" aria-hidden="true">💧</span>
          <strong>{{ format(snapshot.sweat) }}</strong>
        </div>
        <div
          class="resource cash"
          :aria-label="`Cash balance: ${format(snapshot.cash)}`"
        >
          <span class="resource-icon" aria-hidden="true">$</span>
          <strong>{{ format(snapshot.cash) }}</strong>
        </div>
        <button type="button" class="reset-trigger" @click="requestReset">
          Restart race
        </button>
      </div>
    </header>

    <section class="ride-column">
      <div class="stage-card">
        <div class="stage-route">
          <span>
            Tour {{ snapshot.tourNumber }} ·
            Sector {{ snapshot.stage }} / {{ stages.length }} ·
            {{ snapshot.stageDefinition.name }}
          </span>
          <strong>
            {{ snapshot.stageDefinition.start }}
            <i aria-hidden="true">→</i>
            {{ snapshot.stageDefinition.finish }}
          </strong>
          <small>{{ snapshot.stageDefinition.landmark }}</small>
          <svg
            class="terrain-profile"
            viewBox="0 0 100 24"
            role="img"
            aria-label="Current sector elevation profile"
          >
            <line
              class="terrain-profile-zero"
              x1="0"
              :y1="terrainProfile.startY"
              x2="100"
              :y2="terrainProfile.startY"
            />
            <polyline :points="terrainProfile.points" />
            <line
              class="terrain-profile-progress"
              :x1="terrainProfile.markerX"
              y1="1"
              :x2="terrainProfile.markerX"
              y2="23"
            />
            <circle
              :cx="terrainProfile.markerX"
              :cy="terrainProfile.markerY"
              r="2.2"
            />
          </svg>
        </div>
        <div class="stage-metrics">
          <div class="ride-metric ride-metric-primary">
            <small>Speed</small>
            <strong>
              {{ snapshot.stats.speedKmh.toFixed(1) }}
              <em>km/h</em>
            </strong>
          </div>
          <div
            class="ride-metric ride-metric-primary ride-metric-distance"
          >
            <small>Sector distance</small>
            <strong>
              <span>
                {{
                  displayStageDistanceKm(
                    snapshot.stageDefinition,
                    snapshot.stageDistanceM,
                  ).toFixed(0)
                }}
              </span>
              <em>/ {{ snapshot.stageDefinition.routeDistanceKm.toFixed(0) }} km</em>
            </strong>
          </div>
          <div class="ride-metric">
            <small>Wind</small>
            <strong>{{ windLabel }}</strong>
          </div>
          <div class="ride-metric">
            <small>Grade</small>
            <strong>{{ gradeLabel }}</strong>
          </div>
        </div>
        <div class="progress-track" aria-label="Sector progress">
          <span :style="{ width: `${snapshot.stageProgress * 100}%` }"></span>
        </div>
      </div>

      <div class="game-frame">
        <GameCanvas :paused="ridePaused" />
        <aside
          v-if="!snapshot.raceFinished"
          class="leaderboard-hud"
          :class="`leaderboard-${snapshot.leaderboard.status}`"
          aria-label="Live sector leaderboard"
        >
          <header>
            <span>Leaderboard</span>
            <small>
              {{
                snapshot.leaderboard.recordSource === "personal"
                  ? "Personal record"
                  : "Course record"
              }}
            </small>
          </header>
          <div class="leaderboard-times">
            <span>
              <small>Record</small>
              <strong>
                {{
                  formatRaceTime(snapshot.leaderboard.recordTotalSeconds)
                }}
              </strong>
            </span>
            <span>
              <small>You</small>
              <strong>
                {{ formatRaceTime(snapshot.leaderboard.elapsedSeconds) }}
              </strong>
            </span>
          </div>
          <b class="leaderboard-delta">
            {{ leaderboardDeltaLabel }}
          </b>
        </aside>
        <Transition name="notice">
          <div
            v-if="notice"
            class="notice"
            :class="`notice-${notice.tone}`"
          >
            {{ notice.message }}
          </div>
        </Transition>
        <div v-if="activePowerUp" class="active-power-up" aria-live="polite">
          <span aria-hidden="true">{{ activePowerUp.icon }}</span>
          <strong>{{ activePowerUp.label }}</strong>
          <b>{{ activePowerUp.remainingSeconds.toFixed(1) }}s</b>
        </div>
      </div>

      <div class="ride-footer">
        <span class="steering-hint">
          Steer <kbd>↑</kbd> <kbd>↓</kbd>
        </span>
        <div
          class="power-up-reserve"
          :class="{ loaded: reservedPowerUp }"
          aria-live="polite"
        >
          <span class="power-up-icon" aria-hidden="true">
            {{ reservedPowerUp?.icon ?? "○" }}
          </span>
          <span>
            <small>Power-up reserve</small>
            <strong>{{ reservedPowerUp?.label ?? "Empty" }}</strong>
            <em v-if="reservedPowerUp">{{ reservedPowerUp.description }}</em>
          </span>
          <button
            type="button"
            :disabled="!reservedPowerUp || !!activePowerUp"
            @click="activatePowerUp"
          >
            {{ activePowerUp ? "Wait" : "Use" }} <kbd>Space</kbd>
          </button>
        </div>
        <button type="button" class="workshop-trigger" @click="openWorkshop">
          Open workshop <kbd>W</kbd>
        </button>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="workshop">
        <div
          v-if="workshopOpen"
          class="workshop-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workshop-title"
        >
          <section class="workshop-window">
            <header class="workshop-header">
              <div>
                <p class="eyebrow">Ride paused</p>
                <h2 id="workshop-title">Career workshop</h2>
              </div>
              <div class="workshop-resources" aria-label="Available resources">
                <span :aria-label="`Sweat balance: ${format(snapshot.sweat)}`">
                  <b aria-hidden="true">💧</b>
                  <strong>{{ format(snapshot.sweat) }}</strong>
                </span>
                <span :aria-label="`Cash balance: ${format(snapshot.cash)}`">
                  <b aria-hidden="true">$</b>
                  <strong>{{ format(snapshot.cash) }}</strong>
                </span>
              </div>
              <button
                type="button"
                class="workshop-close"
                aria-label="Close workshop and resume ride"
                @click="closeWorkshop"
              >
                Resume ride <kbd>Esc</kbd>
              </button>
            </header>
            <UpgradeGraph :snapshot="snapshot" />
          </section>
        </div>
      </Transition>

      <Transition name="workshop">
        <div
          v-if="snapshot.raceFinished && snapshot.raceResults"
          class="workshop-overlay race-results-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="race-results-title"
        >
          <section class="race-results-window">
            <p class="eyebrow">Tour complete</p>
            <h2 id="race-results-title">Alpe d'Huez finish</h2>
            <div class="race-result-summary">
              <span>
                <small>Your time</small>
                <strong>
                  {{ formatRaceTime(snapshot.raceResults.totalSeconds) }}
                </strong>
              </span>
              <span>
                <small>Fastest target</small>
                <strong>
                  {{ formatRaceTime(snapshot.raceResults.recordTotalSeconds) }}
                </strong>
              </span>
              <b :class="{ ahead: snapshot.raceResults.deltaSeconds < 0 }">
                {{ raceDeltaLabel }}
              </b>
            </div>

            <h3>Final leaderboard</h3>
            <ol class="race-result-list">
              <li
                v-for="row in snapshot.raceResults.rows"
                :key="row.stage"
              >
                <span>
                  <small>Sector {{ row.stage }}</small>
                  <strong>{{ row.route }}</strong>
                </span>
                <span>
                  <b>{{ formatRaceTime(row.timeSeconds) }}</b>
                  <small>
                    {{
                      Math.abs(row.deltaSeconds) < 0.05
                        ? "record"
                        : `${Math.abs(row.deltaSeconds).toFixed(1)}s ${
                            row.deltaSeconds < 0 ? "ahead" : "behind"
                          }`
                    }}
                  </small>
                </span>
              </li>
            </ol>

            <button
              type="button"
              class="race-restart"
              @click="restartRace"
            >
              Ride again
            </button>
          </section>
        </div>
      </Transition>

      <Transition name="workshop">
        <div
          v-if="resetConfirmationOpen"
          class="workshop-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
        >
          <section class="reset-dialog">
            <p class="eyebrow">Restart race</p>
            <h2 id="reset-title">Back to Paris?</h2>
            <p>Your current Tour ends here.</p>
            <div class="reset-actions">
              <button type="button" class="reset-cancel" @click="cancelReset">
                Stay in the race
              </button>
              <button type="button" class="reset-confirm" @click="confirmReset">
                Start over
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>
