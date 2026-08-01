<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type Phaser from "phaser";
import { createGame } from "../game/createGame";

const props = defineProps<{
  paused: boolean;
}>();

const host = ref<HTMLElement | null>(null);
let game: Phaser.Game | null = null;
let waitingForScene = false;

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
  game?.events.off("poststep", syncWhenSceneReady);
  game?.destroy(true);
  game = null;
});
</script>

<template>
  <div ref="host" class="game-canvas" aria-label="Cycling road"></div>
</template>
