<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import GameCanvas from "./components/GameCanvas.vue";
import UpgradeGraph from "./components/UpgradeGraph.vue";
import { gameStore } from "./core/gameStore";

const snapshot = shallowRef(gameStore.getSnapshot());
const workshopOpen = ref(false);
const resetConfirmationOpen = ref(false);
const ridePaused = computed(
  () => workshopOpen.value || resetConfirmationOpen.value,
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

const format = (value: number): string =>
  new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(value);

const openWorkshop = (): void => {
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

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" && resetConfirmationOpen.value) {
    cancelReset();
  } else if (event.key === "Escape" && workshopOpen.value) {
    closeWorkshop();
  } else if (
    event.key.toLowerCase() === "u" &&
    !resetConfirmationOpen.value
  ) {
    workshopOpen.value ? closeWorkshop() : openWorkshop();
  }
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="app-shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">An incremental cycling experiment</p>
        <h1>BIKER INC.</h1>
      </div>
      <div class="resource-strip" aria-label="Game resources">
        <div class="resource sweat">
          <span class="resource-icon">S</span>
          <span>
            <small>Sweat</small>
            <strong>{{ format(snapshot.sweat) }}</strong>
          </span>
        </div>
        <div class="resource cash">
          <span class="resource-icon">$</span>
          <span>
            <small>Cash</small>
            <strong>{{ format(snapshot.cash) }}</strong>
          </span>
        </div>
        <button type="button" class="reset-trigger" @click="requestReset">
          Reset career
        </button>
      </div>
    </header>

    <section class="ride-column">
        <div class="stage-card">
          <div>
            <span>Stage {{ snapshot.stage }}</span>
            <strong>{{ snapshot.stageDefinition.name }}</strong>
          </div>
          <div class="stage-metrics">
            <span>{{ snapshot.stats.speedKmh.toFixed(1) }} km/h</span>
            <span>{{ (snapshot.distanceM / 1000).toFixed(2) }} km</span>
            <span>
              {{
    snapshot.stageDefinition.windPenalty > 0
      ? snapshot.stats.windMitigation > 0
        ? `${Math.round(snapshot.stageDefinition.windPenalty * 100)}% headwind · ${Math.round(snapshot.stats.effectiveWindPenalty * 100)}% after aero`
        : `${Math.round(snapshot.stageDefinition.windPenalty * 100)}% headwind`
      : "Calm"
  }}
</span>
            <span>
              {{
                snapshot.stageDefinition.gradient > 0
                  ? `↗ ${(snapshot.stageDefinition.gradient * 100).toFixed(1)}%`
                  : "Flat"
              }}
            </span>
          </div>
          <div class="progress-track" aria-label="Stage progress">
            <span :style="{ width: `${snapshot.stageProgress * 100}%` }"></span>
          </div>
        </div>

        <div class="game-frame">
          <GameCanvas :paused="ridePaused" />
          <Transition name="notice">
            <div
              v-if="notice"
              class="notice"
              :class="`notice-${notice.tone}`"
            >
              {{ notice.message }}
            </div>
          </Transition>
        </div>

        <div class="ride-footer">
          <span>All collected resources are available immediately</span>
          <span>
            {{ snapshot.stats.sweatPerSecond.toFixed(1) }} Sweat/s ·
            {{ snapshot.stats.cashPerSecond.toFixed(2) }} Cash/s
          </span>
          <button type="button" class="workshop-trigger" @click="openWorkshop">
            Open workshop <kbd>U</kbd>
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
              <div class="workshop-resources">
                <span><b>S</b> {{ format(snapshot.sweat) }} Sweat</span>
                <span><b>$</b> {{ format(snapshot.cash) }} Cash</span>
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
          v-if="resetConfirmationOpen"
          class="workshop-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
        >
          <section class="reset-dialog">
            <p class="eyebrow">Permanent action</p>
            <h2 id="reset-title">Reset your career?</h2>
            <p>
              This erases all Sweat, Cash, distance, stages, and purchased
              upgrades. You will restart on the Local circuit.
            </p>
            <div class="reset-actions">
              <button type="button" class="reset-cancel" @click="cancelReset">
                Keep my career
              </button>
              <button type="button" class="reset-confirm" @click="confirmReset">
                Yes, reset everything
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>
