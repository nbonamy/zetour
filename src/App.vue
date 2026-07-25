<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import GameCanvas from "./components/GameCanvas.vue";
import UpgradeGraph from "./components/UpgradeGraph.vue";
import { gameStore } from "./core/gameStore";

const snapshot = shallowRef(gameStore.getSnapshot());
const workshopOpen = ref(false);
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
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value);

const openWorkshop = (): void => {
  workshopOpen.value = true;
};

const closeWorkshop = (): void => {
  workshopOpen.value = false;
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" && workshopOpen.value) {
    closeWorkshop();
  } else if (event.key.toLowerCase() === "u") {
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
          <span class="resource-icon">€</span>
          <span>
            <small>Cash</small>
            <strong>{{ format(snapshot.cash) }}</strong>
          </span>
        </div>
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
          </div>
          <div class="progress-track" aria-label="Stage progress">
            <span :style="{ width: `${snapshot.stageProgress * 100}%` }"></span>
          </div>
        </div>

        <div class="game-frame">
          <GameCanvas :paused="workshopOpen" />
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
                <span><b>€</b> {{ format(snapshot.cash) }} Cash</span>
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
    </Teleport>
  </main>
</template>
