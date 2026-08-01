<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type Phaser from "phaser";
import { createGame } from "../game/createGame";
import type { GameScene } from "../game/GameScene";

const props = defineProps<{
  paused: boolean;
}>();

const host = ref<HTMLElement | null>(null);
let game: Phaser.Game | null = null;
let waitingForScene = false;
let swipeStart:
  | {
      pointerId: number;
      x: number;
      y: number;
      startedAt: number;
    }
  | undefined;

const MIN_SWIPE_DISTANCE_PX = 28;
const MAX_SWIPE_DURATION_MS = 700;
const VERTICAL_DOMINANCE = 1.15;

const beginSwipe = (event: PointerEvent): void => {
  if (
    props.paused ||
    !event.isPrimary ||
    event.pointerType === "mouse"
  ) {
    return;
  }

  swipeStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    startedAt: performance.now(),
  };

  try {
    host.value?.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic events and a few older mobile browsers cannot capture here.
  }
};

const clearSwipe = (event?: PointerEvent): void => {
  if (event && swipeStart?.pointerId === event.pointerId) {
    try {
      host.value?.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
  }
  swipeStart = undefined;
};

const finishSwipe = (event: PointerEvent): void => {
  const start = swipeStart;
  if (!start || start.pointerId !== event.pointerId) return;

  const elapsed = performance.now() - start.startedAt;
  const deltaX = event.clientX - start.x;
  const deltaY = event.clientY - start.y;
  const verticalDistance = Math.abs(deltaY);
  const hostHeight = host.value?.getBoundingClientRect().height ?? 0;
  const minimumDistance = Math.max(
    MIN_SWIPE_DISTANCE_PX,
    hostHeight * 0.07,
  );

  clearSwipe(event);
  if (
    props.paused ||
    elapsed > MAX_SWIPE_DURATION_MS ||
    verticalDistance < minimumDistance ||
    verticalDistance < Math.abs(deltaX) * VERTICAL_DOMINANCE
  ) {
    return;
  }

  event.preventDefault();
  const rideScene = game?.scene.getScene("ride") as GameScene | undefined;
  rideScene?.changeLane(deltaY < 0 ? -1 : 1);
};

const syncPause = (): boolean => {
  if (!game || !game.scene.getScene("ride")) return false;
  const sceneActive = game.scene.isActive("ride");
  const scenePaused = game.scene.isPaused("ride");
  if (!sceneActive && !scenePaused) return false;
  if (props.paused) {
    game.scene.pause("ride");
  } else {
    game.scene.resume("ride");
  }
  return true;
};

const syncWhenSceneReady = (): void => {
  if (!syncPause() || !game) return;
  game.events.off("poststep", syncWhenSceneReady);
  waitingForScene = false;
};

const requestPauseSync = (): void => {
  if (syncPause() || !game || waitingForScene) return;
  waitingForScene = true;
  game.events.on("poststep", syncWhenSceneReady);
};

onMounted(() => {
  if (host.value) {
    game = createGame(host.value);
    game.events.once("ready", requestPauseSync);
    requestPauseSync();
  }
});

watch(() => props.paused, requestPauseSync);

onBeforeUnmount(() => {
  clearSwipe();
  game?.events.off("poststep", syncWhenSceneReady);
  game?.destroy(true);
  game = null;
});
</script>

<template>
  <div
    ref="host"
    class="game-canvas"
    aria-label="Cycling road. Swipe up or down to change lane."
    @pointerdown="beginSwipe"
    @pointerup="finishSwipe"
    @pointercancel="clearSwipe"
  ></div>
</template>
