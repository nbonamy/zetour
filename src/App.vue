<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import GameCanvas from "./components/GameCanvas.vue";
import PalmaresPanel from "./components/PalmaresPanel.vue";
import UpgradeGraph from "./components/UpgradeGraph.vue";
import {
  courseRecordForStage,
  displayStageDistanceKm,
  gameStore,
  powerUpDefinitions,
  stages,
  type PowerUpType,
  type RaceResults,
} from "./core/gameStore";
import { formatCompactNumber, formatMultiplier } from "./core/format";
import { formatRaceTime } from "./core/timeTrial";
import { flowMultiplier as rideFlowMultiplier } from "./game/rideSystems";
import { readVisualQaOverrides } from "./game/visualQa";

const snapshot = shallowRef(gameStore.getSnapshot());
const visualQa = readVisualQaOverrides();
const visualQaRaceResults: RaceResults | null = visualQa.finished
  ? (() => {
      const offsets = [-2.3, 4.7, -1.2, 8.9, 14.6];
      const rows = stages.map((stage, index) => {
        const recordSeconds = courseRecordForStage(stage).totalSeconds;
        const deltaSeconds = offsets[index] ?? 0;
        return {
          stage: stage.number,
          route: `${stage.start} → ${stage.finish}`,
          timeSeconds: recordSeconds + deltaSeconds,
          recordSeconds,
          deltaSeconds,
        };
      });
      const totalSeconds = rows.reduce(
        (total, row) => total + row.timeSeconds,
        0,
      );
      const recordTotalSeconds = rows.reduce(
        (total, row) => total + row.recordSeconds,
        0,
      );
      return {
        totalSeconds,
        recordTotalSeconds,
        deltaSeconds: totalSeconds - recordTotalSeconds,
        rows,
      };
    })()
  : null;
const displayedRaceResults = computed(
  () => snapshot.value.raceResults ?? visualQaRaceResults,
);
const displayedRaceFinished = computed(
  () => snapshot.value.raceFinished || visualQa.finished,
);
const displayedStage = computed(() =>
  visualQa.stage === null
    ? snapshot.value.stageDefinition
    : stages[visualQa.stage - 1],
);
const displayedStageProgress = computed(() =>
  visualQa.stage === null ? snapshot.value.stageProgress : 0.42,
);
const displayedStageDistanceM = computed(() =>
  visualQa.stage === null
    ? snapshot.value.stageDistanceM
    : displayedStage.value.distanceM * displayedStageProgress.value,
);
const workshopOpen = ref(false);
const workshopTab = ref<"career" | "palmares">("career");
const resetConfirmationOpen = ref(false);
const manuallyPaused = ref(visualQa.paused);
const ridePaused = computed(
  () =>
    manuallyPaused.value ||
    workshopOpen.value ||
    resetConfirmationOpen.value ||
    displayedRaceFinished.value,
);
const reservedPowerUp = computed(() =>
  snapshot.value.reservedPowerUp
    ? {
        type: snapshot.value.reservedPowerUp,
        ...powerUpDefinitions[snapshot.value.reservedPowerUp],
      }
    : null,
);
const activePowerUp = computed(() =>
  visualQa.powerUp
    ? {
        type: visualQa.powerUp,
        ...powerUpDefinitions[visualQa.powerUp],
        remainingSeconds:
          powerUpDefinitions[visualQa.powerUp].durationSeconds * 0.6,
      }
    : snapshot.value.activePowerUp
    ? {
        type: snapshot.value.activePowerUp.type,
        ...powerUpDefinitions[snapshot.value.activePowerUp.type],
        remainingSeconds: snapshot.value.activePowerUp.remainingSeconds,
      }
    : null,
);
const powerUpImage = (type: PowerUpType): string =>
  `/assets/art/${powerUpDefinitions[type].assetKey}.png`;
const windLabel = computed(() => {
  const stage = displayedStage.value;
  if (stage.windPenalty <= 0) return "Wind calm";
  const raw = Math.round(stage.windPenalty * 100);
  const effective = Math.round(snapshot.value.stats.effectiveWindPenalty * 100);
  return effective < raw
    ? `Wind ${effective}% effective`
    : `Wind ${raw}% headwind`;
});
const gradeLabel = computed(() => {
  const gradient = visualQa.gradient ?? snapshot.value.currentGradient;
  if (gradient > 0.0005) return `Slope ↗ ${(gradient * 100).toFixed(1)}%`;
  if (gradient < -0.0005) {
    return `Slope ↘ ${Math.abs(gradient * 100).toFixed(1)}%`;
  }
  return "Slope 0.0%";
});
const leaderboardDeltaLabel = computed(() => {
  const { deltaSeconds, status } = snapshot.value.leaderboard;
  if (status === "even") return "On record pace";
  return `${Math.abs(deltaSeconds).toFixed(1)}s ${status}`;
});
const raceDeltaLabel = computed(() => {
  const delta = displayedRaceResults.value?.deltaSeconds ?? 0;
  if (Math.abs(delta) < 0.05) return "Record pace";
  return `${Math.abs(delta).toFixed(1)}s ${delta < 0 ? "ahead" : "behind"}`;
});
const displayedPendingPalmares = computed(() =>
  visualQa.finished && !snapshot.value.raceFinished
    ? 10
    : snapshot.value.pendingPalmares,
);
const paceGaugeRatio = computed(() =>
  Math.min(
    1,
    Math.max(
      0,
      Math.log10(1 + snapshot.value.stats.effectivePaceKmh) /
        Math.log10(100_001),
    ),
  ),
);
const paceGaugeSegments = computed(() =>
  Math.round(paceGaugeRatio.value * 10),
);
const speedNeedleAngle = computed(
  () => `${-135 + paceGaugeRatio.value * 180}deg`,
);
const displayedFlowMultiplier = computed(() =>
  visualQa.flow === null
    ? snapshot.value.stats.flowMultiplier
    : rideFlowMultiplier(visualQa.flow),
);
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

const format = (value: number): string => formatCompactNumber(value);

const openWorkshop = (): void => {
  if (displayedRaceFinished.value) return;
  workshopOpen.value = true;
};

const closeWorkshop = (): void => {
  workshopOpen.value = false;
  manuallyPaused.value = false;
};

const requestReset = (): void => {
  resetConfirmationOpen.value = true;
};

const cancelReset = (): void => {
  resetConfirmationOpen.value = false;
};

const confirmReset = (): void => {
  gameStore.resetCareer();
  manuallyPaused.value = false;
  resetConfirmationOpen.value = false;
  workshopOpen.value = false;
};

const toggleManualPause = (): void => {
  if (
    displayedRaceFinished.value ||
    workshopOpen.value ||
    resetConfirmationOpen.value
  ) {
    return;
  }
  manuallyPaused.value = !manuallyPaused.value;
};

const activatePowerUp = (): void => {
  if (!ridePaused.value) gameStore.activateReservedPowerUp();
};

const continueTour = (): void => {
  gameStore.continueTour();
  manuallyPaused.value = false;
};

const startNextSeason = (): void => {
  gameStore.startNextSeason();
  manuallyPaused.value = false;
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" && resetConfirmationOpen.value) {
    cancelReset();
  } else if (event.key === "Escape" && workshopOpen.value) {
    closeWorkshop();
  } else if (
    (event.key === "Escape" || event.key.toLowerCase() === "p") &&
    !resetConfirmationOpen.value
  ) {
    event.preventDefault();
    toggleManualPause();
  } else if (
    event.key.toLowerCase() === "r" &&
    !resetConfirmationOpen.value &&
    !workshopOpen.value &&
    !displayedRaceFinished.value
  ) {
    requestReset();
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
    <section class="ride-column">
      <div class="game-frame" :class="{ 'is-paused': ridePaused }">
        <GameCanvas :paused="ridePaused" />
        <header class="tour-hud">
          <section class="hud-panel hud-speed" aria-label="Tour pace">
            <div class="speed-dial" aria-hidden="true">
              <span
                class="speed-needle"
                :style="{ transform: `rotate(${speedNeedleAngle})` }"
              ></span>
              <i></i>
            </div>
            <div class="hud-speed-copy">
              <strong>
                {{ format(snapshot.stats.effectivePaceKmh) }}
                <em>km/h</em>
              </strong>
              <div class="speed-segments" aria-hidden="true">
                <span
                  v-for="segment in 10"
                  :key="segment"
                  :class="{ active: segment <= paceGaugeSegments }"
                ></span>
              </div>
              <b class="effective-pace">
                <span>Tour pace</span>
                <span
                  v-if="displayedFlowMultiplier > 1"
                  class="flow-bonus"
                  title="Clean pickups, near-misses, and drafting boost Tour pace and income. A collision resets the bonus."
                >
                  Flow {{ formatMultiplier(displayedFlowMultiplier) }}
                </span>
              </b>
              <small>{{ gradeLabel }} · {{ windLabel }}</small>
            </div>
          </section>

          <div class="hud-title">
            <div class="hud-title-plaque">
              <small class="hud-tour-meta">
                Season {{ snapshot.season }} · Tour {{ snapshot.tourNumber }} ·
                Sector
                {{ displayedStage.number }} /
                {{ stages.length }}
              </small>
              <svg
                class="title-sprig title-sprig-left"
                viewBox="0 0 28 42"
                aria-hidden="true"
              >
                <path d="M15 39C15 28 11 17 5 7" />
                <path d="M12 28C7 28 4 25 3 20C8 20 11 22 12 28Z" />
                <path d="M9 19C5 18 3 14 4 10C8 11 10 14 9 19Z" />
                <path d="M15 32C20 30 22 26 21 21C17 22 14 26 15 32Z" />
                <path d="M12 23C17 21 19 17 18 12C14 14 12 18 12 23Z" />
              </svg>
              <h1 aria-label="Ze Tour">
                <span class="sr-only">Ze Tour</span>
                <span class="title-word" aria-hidden="true">
                  <i>Z</i><i>E</i>
                </span>
                <span class="title-word" aria-hidden="true">
                  <i>T</i><i>O</i><i>U</i><i>R</i>
                </span>
              </h1>
              <svg
                class="title-sprig title-sprig-right"
                viewBox="0 0 28 42"
                aria-hidden="true"
              >
                <path d="M15 39C15 28 11 17 5 7" />
                <path d="M12 28C7 28 4 25 3 20C8 20 11 22 12 28Z" />
                <path d="M9 19C5 18 3 14 4 10C8 11 10 14 9 19Z" />
                <path d="M15 32C20 30 22 26 21 21C17 22 14 26 15 32Z" />
                <path d="M12 23C17 21 19 17 18 12C14 14 12 18 12 23Z" />
              </svg>
            </div>
            <div class="hud-route-ribbon">
              <strong>
                {{ displayedStage.start }}
                <i aria-hidden="true">→</i>
                {{ displayedStage.finish }}
              </strong>
              <small class="sr-only">
                {{ displayedStage.name }}
                <template v-if="displayedStage.surface === 'gravel'">
                  · GRAVEL
                </template>
              </small>
            </div>
          </div>

          <section class="hud-panel hud-distance" aria-label="Sector distance">
            <div class="hud-distance-copy">
              <strong>
                <span>
                  {{
                    displayStageDistanceKm(
                      displayedStage,
                      displayedStageDistanceM,
                    ).toFixed(0)
                  }}
                </span>
                <em>/ {{ displayedStage.routeDistanceKm.toFixed(0) }} km</em>
              </strong>
              <div class="hud-distance-track" aria-hidden="true">
                <span
                  :style="{ width: `${displayedStageProgress * 100}%` }"
                ></span>
              </div>
              <small>{{ displayedStage.landmark }}</small>
            </div>
            <span class="finish-badge" aria-hidden="true">
              <i class="finish-flag"></i>
            </span>
          </section>
        </header>

        <aside
          v-if="!displayedRaceFinished"
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
        <div
          v-if="activePowerUp"
          class="active-power-up"
          :data-power-up="activePowerUp.type"
          :title="activePowerUp.description"
          aria-live="polite"
        >
          <img
            :src="powerUpImage(activePowerUp.type)"
            alt=""
            aria-hidden="true"
          />
          <span class="active-power-up-copy">
            <strong>{{ activePowerUp.label }}</strong>
            <small>{{ activePowerUp.description }}</small>
          </span>
          <b>{{ activePowerUp.remainingSeconds.toFixed(1) }}s</b>
        </div>
        <div
          v-if="manuallyPaused && !visualQa.paused"
          class="pause-indicator"
          role="status"
        >
          <strong>Ride paused</strong>
          <small><kbd>P</kbd> or <kbd>Esc</kbd> to resume</small>
        </div>

        <footer class="hud-bottom">
          <div class="hud-bottom-side hud-bottom-left">
            <button
              type="button"
              class="reset-trigger hud-control"
              @click="requestReset"
            >
              Restart race <kbd>R</kbd>
            </button>
            <button
              type="button"
              class="pause-trigger hud-control"
              :class="{ active: manuallyPaused }"
              :aria-pressed="manuallyPaused"
              @click="toggleManualPause"
            >
              {{ manuallyPaused ? "Resume" : "Pause" }} <kbd>P</kbd>
            </button>
            <span class="steering-hint hud-control">
              Steer <kbd>↑</kbd> <kbd>↓</kbd>
            </span>
          </div>

          <div
            class="hud-tray"
            :class="{ 'has-palmares': snapshot.totalPalmares > 0 }"
            aria-label="Resources and power-up reserve"
          >
            <div
              class="hud-tray-slot"
              :aria-label="`Sweat balance: ${format(snapshot.sweat)}`"
            >
              <img src="/assets/art/bag-sweat.png" alt="" aria-hidden="true" />
              <strong>{{ format(snapshot.sweat) }}</strong>
            </div>
            <button
              type="button"
              class="hud-tray-slot hud-power-slot"
              :class="{ loaded: reservedPowerUp }"
              :disabled="!reservedPowerUp || !!activePowerUp"
              :title="
                reservedPowerUp
                  ? `${reservedPowerUp.label}: ${reservedPowerUp.description}`
                  : undefined
              "
              :aria-label="
                reservedPowerUp
                  ? `Use ${reservedPowerUp.label}: ${reservedPowerUp.description}`
                  : 'Power-up reserve empty'
              "
              @click="activatePowerUp"
            >
              <img
                v-if="reservedPowerUp"
                :src="powerUpImage(reservedPowerUp.type)"
                alt=""
                aria-hidden="true"
              />
              <span v-else aria-hidden="true">○</span>
              <strong>{{ reservedPowerUp?.label ?? "Reserve" }}</strong>
              <kbd>Space</kbd>
            </button>
            <div
              class="hud-tray-slot"
              :aria-label="`Cash balance: ${format(snapshot.cash)}`"
            >
              <img src="/assets/art/bag-cash.png" alt="" aria-hidden="true" />
              <strong>{{ format(snapshot.cash) }}</strong>
            </div>
            <div
              v-if="snapshot.totalPalmares > 0"
              class="hud-tray-slot hud-palmares-slot"
              :aria-label="`Palmarès balance: ${format(snapshot.palmares)}`"
            >
              <span aria-hidden="true">★</span>
              <strong>{{ format(snapshot.palmares) }}</strong>
            </div>
          </div>

          <button
            type="button"
            class="workshop-trigger hud-workshop hud-control"
            @click="openWorkshop"
          >
            Workshop <kbd>W</kbd>
          </button>
        </footer>
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
                  <img
                    src="/assets/art/bag-sweat.png"
                    alt=""
                    aria-hidden="true"
                  />
                  <strong>{{ format(snapshot.sweat) }}</strong>
                </span>
                <span :aria-label="`Cash balance: ${format(snapshot.cash)}`">
                  <img
                    src="/assets/art/bag-cash.png"
                    alt=""
                    aria-hidden="true"
                  />
                  <strong>{{ format(snapshot.cash) }}</strong>
                </span>
                <span
                  v-if="snapshot.totalPalmares > 0"
                  class="workshop-palmares"
                  :aria-label="`Palmarès balance: ${format(snapshot.palmares)}`"
                >
                  <b aria-hidden="true">★</b>
                  <strong>{{ format(snapshot.palmares) }}</strong>
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
            <nav class="workshop-tabs" aria-label="Workshop sections">
              <button
                type="button"
                :class="{ active: workshopTab === 'career' }"
                @click="workshopTab = 'career'"
              >
                This Season
              </button>
              <button
                type="button"
                :class="{ active: workshopTab === 'palmares' }"
                @click="workshopTab = 'palmares'"
              >
                Palmarès
                <span v-if="snapshot.palmares > 0">
                  ★ {{ format(snapshot.palmares) }}
                </span>
              </button>
            </nav>
            <UpgradeGraph
              v-if="workshopTab === 'career'"
              :snapshot="snapshot"
            />
            <PalmaresPanel v-else :snapshot="snapshot" />
          </section>
        </div>
      </Transition>

      <Transition name="workshop">
        <div
          v-if="displayedRaceFinished && displayedRaceResults"
          class="workshop-overlay race-results-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="race-results-title"
        >
          <section class="race-results-window">
            <p class="eyebrow">
              Season {{ snapshot.season }} · Tour {{ snapshot.tourNumber }}
              complete
            </p>
            <h2 id="race-results-title">Alpe d'Huez finish</h2>
            <div class="race-result-summary">
              <span>
                <small>Your time</small>
                <strong>
                  {{ formatRaceTime(displayedRaceResults.totalSeconds) }}
                </strong>
              </span>
              <span>
                <small>Fastest target</small>
                <strong>
                  {{ formatRaceTime(displayedRaceResults.recordTotalSeconds) }}
                </strong>
              </span>
              <b :class="{ ahead: displayedRaceResults.deltaSeconds < 0 }">
                {{ raceDeltaLabel }}
              </b>
            </div>

            <div class="season-reward">
              <span aria-hidden="true">★</span>
              <div>
                <small>Start the next Season now</small>
                <strong>+{{ format(displayedPendingPalmares) }} Palmarès</strong>
                <p>
                  Permanent pace becomes
                  {{
                    formatMultiplier(
                      snapshot.stats.palmaresMultiplier *
                        (1 +
                          displayedPendingPalmares /
                            Math.max(1, 10 + snapshot.totalPalmares)),
                    )
                  }}.
                  Or keep this build and complete another Tour for a larger
                  reward.
                </p>
              </div>
            </div>

            <h3>Final leaderboard</h3>
            <ol class="race-result-list">
              <li
                v-for="row in displayedRaceResults.rows"
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

            <div class="season-actions">
              <button
                type="button"
                class="race-restart race-victory-lap"
                @click="continueTour"
              >
                Victory lap · keep everything
              </button>
              <button
                type="button"
                class="race-restart race-next-season"
                @click="startNextSeason"
              >
                Start Season {{ snapshot.season + 1 }} ·
                +{{ format(displayedPendingPalmares) }} ★
              </button>
            </div>
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
