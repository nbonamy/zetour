<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ThreeRide,
  type ThreeCameraMode,
} from "../game/ThreeRide";

const props = defineProps<{
  paused: boolean;
}>();

const host = ref<HTMLElement | null>(null);
const announcement = ref<{
  message: string;
  tone: "neutral" | "good" | "bad";
} | null>(null);
const cameraMode = ref<ThreeCameraMode>("Chase");
let ride: ThreeRide | null = null;

onMounted(() => {
  if (!host.value) return;
  ride = new ThreeRide(host.value, {
    onAnnouncement: (next) => {
      announcement.value = next;
    },
    onCameraChange: (next) => {
      cameraMode.value = next;
    },
  });
  ride.setPaused(props.paused);
});

watch(
  () => props.paused,
  (paused) => ride?.setPaused(paused),
);

const cycleCamera = (): void => {
  ride?.cycleCamera();
};

onBeforeUnmount(() => {
  ride?.dispose();
  ride = null;
});
</script>

<template>
  <div ref="host" class="game-canvas game-canvas-3d">
    <div class="three-mode-chip" aria-hidden="true">
      <span>3D</span>
      Chase view
    </div>
    <button
      type="button"
      class="three-camera-control"
      :aria-label="`Current camera: ${cameraMode}. Switch camera`"
      @click="cycleCamera"
    >
      {{ cameraMode }} camera <kbd>C</kbd>
    </button>
    <Transition name="three-callout">
      <div
        v-if="announcement"
        class="three-announcement"
        :class="`three-announcement-${announcement.tone}`"
        aria-live="polite"
      >
        {{ announcement.message }}
      </div>
    </Transition>
    <div class="three-speed-lines" aria-hidden="true">
      <i v-for="line in 10" :key="line"></i>
    </div>
  </div>
</template>
