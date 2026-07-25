<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type Phaser from "phaser";
import { createGame } from "../game/createGame";

const props = defineProps<{
  paused: boolean;
}>();

const host = ref<HTMLElement | null>(null);
let game: Phaser.Game | null = null;

const syncPause = (): void => {
  if (!game) return;
  if (props.paused) {
    game.scene.pause("ride");
  } else {
    game.scene.resume("ride");
  }
};

onMounted(() => {
  if (host.value) {
    game = createGame(host.value);
    game.events.once("ready", syncPause);
    syncPause();
  }
});

watch(() => props.paused, syncPause);

onBeforeUnmount(() => {
  game?.destroy(true);
  game = null;
});
</script>

<template>
  <div ref="host" class="game-canvas" aria-label="Cycling road"></div>
</template>
