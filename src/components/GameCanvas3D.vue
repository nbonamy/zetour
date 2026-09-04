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
const flow = ref(0);
const combo = ref(0);
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
    onFlowChange: (nextFlow, nextCombo) => {
      flow.value = nextFlow;
      combo.value = nextCombo;
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
    <button
      type="button"
      class="three-camera-control"
      :aria-label="`Current camera: ${cameraMode}. Switch camera`"
      @click="cycleCamera"
    >
      {{ cameraMode }} camera <kbd>C</kbd>
    </button>
    <div class="three-flow-meter" aria-live="polite">
      <strong v-if="flow > 0">
        Flow ×{{ (1 + Math.floor(flow / 20) * 0.4).toFixed(1) }}<template v-if="combo > 0"> · {{ combo }} combo</template>
      </strong>
      <strong v-else>Find your flow</strong>
      <span><i :style="{ width: `${flow}%` }"></i></span>
    </div>
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
