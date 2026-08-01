<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import GameCanvas from "./components/GameCanvas.vue";
import MobileLandscapeGate from "./components/MobileLandscapeGate.vue";
import PalmaresPanel from "./components/PalmaresPanel.vue";
import UpgradeGraph from "./components/UpgradeGraph.vue";
import {
  gameAudio,
  gameEffectsForTransition,
} from "./audio/gameAudio";
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
import { upgrades } from "./core/upgrades";
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
const firstUpgradeInvitationOpen = ref(false);
const firstUpgradeInvitationButton = ref<HTMLButtonElement | null>(null);
const resetConfirmationOpen = ref(false);
const manuallyPaused = ref(visualQa.paused);
const mobileLandscapeBlocked = ref(false);
const audioState = shallowRef(gameAudio.getState());
const audioModeCopy = computed(() => {
  switch (audioState.value.mode) {
    case "muted":
      return {
        label: "Mute",
        next: "effects only",
        title: "All game audio is muted",
      };
    case "effects":
      return {
        label: "FX",
        next: "music and effects",
        title: "Game effects are on; music is off",
      };
    case "full":
      return {
        label: "Music",
        next: "mute",
        title: `${audioState.value.soundtrackTitle} and game effects are on`,
      };
  }
});
const ridePaused = computed(
  () =>
    manuallyPaused.value ||
    workshopOpen.value ||
    firstUpgradeInvitationOpen.value ||
    resetConfirmationOpen.value ||
    mobileLandscapeBlocked.value ||
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
        suppressed: false,
      }
    : snapshot.value.activePowerUp
    ? {
        type: snapshot.value.activePowerUp.type,
        ...powerUpDefinitions[snapshot.value.activePowerUp.type],
        remainingSeconds: snapshot.value.activePowerUp.remainingSeconds,
        suppressed: snapshot.value.activePowerUp.suppressed,
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
const displayedPaceKmh = computed(
  () => visualQa.speedKmh ?? snapshot.value.stats.effectivePaceKmh,
);
const paceGaugeRatio = computed(() =>
  Math.min(
    1,
    Math.max(
      0,
      displayedPaceKmh.value / 120,
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
const konamiCode = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;
let konamiProgress = 0;
const WORKSHOP_INVITATION_STORAGE_KEY =
  "ze-tour-workshop-invitation-seen-v1";
const workshopInvitationSeen = ref(false);

try {
  workshopInvitationSeen.value =
    typeof window !== "undefined" &&
    window.localStorage.getItem(WORKSHOP_INVITATION_STORAGE_KEY) === "1";
} catch {
  workshopInvitationSeen.value = false;
}

const firstAffordableUpgrade = computed(() => {
  void snapshot.value;
  return (
    upgrades.find(
      (upgrade) => gameStore.purchaseStatus(upgrade, 1).available,
    ) ?? null
  );
});
const hasPurchasedUpgrade = computed(() =>
  Object.values(snapshot.value.upgrades).some((level) => level > 0),
);

const markWorkshopInvitationSeen = (): void => {
  workshopInvitationSeen.value = true;
  try {
    window.localStorage.setItem(WORKSHOP_INVITATION_STORAGE_KEY, "1");
  } catch {
    // The in-memory flag still prevents repeated prompts for this session.
  }
};

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
const unsubscribeAudio = gameAudio.subscribe((state) => {
  audioState.value = state;
});

watch(
  () => displayedStage.value.number,
  (stage) => gameAudio.setStage(stage),
  { immediate: true },
);
watch(ridePaused, (paused) => gameAudio.setPaused(paused), { immediate: true });
watch(
  () => ({
    activePowerUp: snapshot.value.activePowerUp?.type ?? null,
    level: snapshot.value.riderProgress.level,
    raceFinished: snapshot.value.raceFinished,
    raceRevision: snapshot.value.raceRevision,
    stage: snapshot.value.stage,
  }),
  (next, previous) => {
    gameEffectsForTransition(previous, next).forEach((effect) =>
      gameAudio.playEffect(effect),
    );
  },
  { flush: "sync" },
);

watch(
  [
    firstAffordableUpgrade,
    hasPurchasedUpgrade,
    workshopOpen,
    resetConfirmationOpen,
    displayedRaceFinished,
    workshopInvitationSeen,
  ],
  ([affordableUpgrade, alreadyPurchased, isWorkshopOpen, isResetOpen, isFinished, wasSeen]) => {
    if (wasSeen || firstUpgradeInvitationOpen.value) return;
    if (alreadyPurchased) {
      markWorkshopInvitationSeen();
      return;
    }
    if (!affordableUpgrade) return;
    if (isWorkshopOpen) {
      markWorkshopInvitationSeen();
      return;
    }
    if (isResetOpen || isFinished) return;

    firstUpgradeInvitationOpen.value = true;
    markWorkshopInvitationSeen();
    void nextTick(() => firstUpgradeInvitationButton.value?.focus());
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  unsubscribe();
  unsubscribeNotices();
  unsubscribeAudio();
  window.clearTimeout(noticeTimer);
});

const format = (value: number): string => formatCompactNumber(value);

const openWorkshop = (): void => {
  if (displayedRaceFinished.value || workshopOpen.value) return;
  workshopOpen.value = true;
  gameAudio.playEffect("workshop-open");
};

const dismissFirstUpgradeInvitation = (): void => {
  firstUpgradeInvitationOpen.value = false;
};

const openWorkshopFromInvitation = (): void => {
  firstUpgradeInvitationOpen.value = false;
  workshopTab.value = "career";
  openWorkshop();
};

const closeWorkshop = (): void => {
  if (workshopOpen.value) gameAudio.playEffect("workshop-close");
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
    firstUpgradeInvitationOpen.value ||
    resetConfirmationOpen.value
  ) {
    return;
  }
  manuallyPaused.value = !manuallyPaused.value;
};

const activatePowerUp = (): void => {
  if (!ridePaused.value && gameStore.activateReservedPowerUp()) {
    gameAudio.playEffect("power-up-activate");
  }
};

const toggleAudio = (): void => {
  gameAudio.cycleMode();
};

const continueTour = (): void => {
  gameStore.continueTour();
  manuallyPaused.value = false;
};

const startNextSeason = (): void => {
  gameStore.startNextSeason();
  manuallyPaused.value = false;
};

const trackKonamiCode = (event: KeyboardEvent): boolean => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === konamiCode[konamiProgress]) {
    konamiProgress += 1;
    if (konamiProgress === konamiCode.length) {
      konamiProgress = 0;
      gameStore.activateKonamiCheat();
      return true;
    }
    return false;
  }

  konamiProgress = key === konamiCode[0] ? 1 : 0;
  return false;
};

const onKeydown = (event: KeyboardEvent): void => {
  if (trackKonamiCode(event)) {
    event.preventDefault();
  } else if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    toggleAudio();
  } else if (
    event.key === "Escape" &&
    firstUpgradeInvitationOpen.value
  ) {
    dismissFirstUpgradeInvitation();
  } else if (
    event.key.toLowerCase() === "w" &&
    firstUpgradeInvitationOpen.value
  ) {
    event.preventDefault();
    openWorkshopFromInvitation();
  } else if (event.key === "Escape" && resetConfirmationOpen.value) {
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
    !firstUpgradeInvitationOpen.value &&
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

let removeAudioUnlockListeners: (() => void) | undefined;
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  removeAudioUnlockListeners = gameAudio.installUserGestureUnlock(window);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  removeAudioUnlockListeners?.();
});
</script>

<template>
  <main class="app-shell">
    <MobileLandscapeGate
      @blocked-change="mobileLandscapeBlocked = $event"
    />
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
                {{ format(displayedPaceKmh) }}
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
                  title="Clean pickups, near-misses, and drafting boost income. A collision resets the bonus."
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
          :class="{ suppressed: activePowerUp.suppressed }"
          :data-power-up="activePowerUp.type"
          :title="
            activePowerUp.suppressed
              ? 'Acceleration has no effect while drafting a stranger'
              : activePowerUp.description
          "
          aria-live="polite"
        >
          <img
            :src="powerUpImage(activePowerUp.type)"
            alt=""
            aria-hidden="true"
          />
          <span class="active-power-up-copy">
            <strong>
              {{
                activePowerUp.suppressed
                  ? `${activePowerUp.label} blocked`
                  : activePowerUp.label
              }}
            </strong>
            <small>
              {{
                activePowerUp.suppressed
                  ? "Stranger draft takes priority"
                  : activePowerUp.description
              }}
            </small>
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
            <span class="steering-hint hud-control">
              Steer <kbd>↑</kbd> <kbd>↓</kbd>
            </span>
            <button
              type="button"
              class="workshop-trigger hud-control"
              @click="openWorkshop"
            >
              Workshop <kbd>W</kbd>
            </button>
          </div>

          <div
            class="hud-tray"
            aria-label="Rider level, power-up, Sweat, and Cash"
          >
            <div
              class="hud-tray-slot hud-level-slot"
              :aria-label="`Rider Level ${snapshot.riderProgress.level}, ${format(snapshot.riderProgress.xp)} of ${format(snapshot.riderProgress.nextLevelXp)} XP`"
            >
              <span class="hud-level-display" aria-hidden="true">
                <b>{{ snapshot.riderProgress.level }}</b>
              </span>
              <strong
                class="hud-level-progress"
                :style="{
                  '--hud-level-progress': `${snapshot.riderProgress.progress * 100}%`,
                }"
              >
                <span>Level {{ snapshot.riderProgress.level }}</span>
              </strong>
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
                  : 'Power-up empty'
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
              <strong>{{ reservedPowerUp?.label ?? "Power-up" }}</strong>
              <kbd>Space</kbd>
            </button>
            <div
              class="hud-tray-slot"
              :aria-label="`Sweat balance: ${format(snapshot.sweat)}`"
            >
              <img src="/assets/art/bag-sweat.png" alt="" aria-hidden="true" />
              <strong>{{ format(snapshot.sweat) }}</strong>
            </div>
            <div
              class="hud-tray-slot"
              :aria-label="`Cash balance: ${format(snapshot.cash)}`"
            >
              <img src="/assets/art/bag-cash.png" alt="" aria-hidden="true" />
              <strong>{{ format(snapshot.cash) }}</strong>
            </div>
          </div>

          <div class="hud-bottom-side hud-bottom-right">
            <button
              type="button"
              class="audio-toggle hud-control"
              :class="{
                muted: audioState.mode === 'muted',
                'effects-only': audioState.mode === 'effects',
              }"
              :data-audio-mode="audioState.mode"
              :aria-label="`${audioModeCopy.title}. Press M for ${audioModeCopy.next}.`"
              :title="`${audioModeCopy.title} · press M for ${audioModeCopy.next}`"
              @click="toggleAudio"
            >
              <span>{{ audioModeCopy.label }}</span>
              <kbd>M</kbd>
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
            <button
              type="button"
              class="reset-trigger hud-control"
              @click="requestReset"
            >
              Restart race <kbd>R</kbd>
            </button>
          </div>
        </footer>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="workshop">
        <div
          v-if="firstUpgradeInvitationOpen && firstAffordableUpgrade"
          class="workshop-overlay first-upgrade-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="first-upgrade-title"
          aria-describedby="first-upgrade-description"
        >
          <section class="reset-dialog first-upgrade-dialog">
            <p class="eyebrow">First upgrade ready</p>
            <h2 id="first-upgrade-title">Time to tune the bike</h2>
            <p id="first-upgrade-description">
              You can now afford <strong>{{ firstAffordableUpgrade.name }}</strong>.
              Open the workshop to buy your first upgrade and ride faster.
            </p>
            <div class="reset-actions first-upgrade-actions">
              <button
                type="button"
                class="reset-cancel"
                @click="dismissFirstUpgradeInvitation"
              >
                Keep riding
              </button>
              <button
                ref="firstUpgradeInvitationButton"
                type="button"
                class="first-upgrade-open"
                @click="openWorkshopFromInvitation"
              >
                Open workshop <kbd>W</kbd>
              </button>
            </div>
          </section>
        </div>
      </Transition>

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
                  Your workshop stays installed; only Sweat, Cash, and route
                  progress reset.
                  Or complete another Tour before banking for a larger reward.
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
                Victory lap · keep Sweat &amp; Cash
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
