<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const emit = defineEmits<{
  "blocked-change": [blocked: boolean];
}>();

const compactViewport = ref(false);
const touchFirstDevice = ref(false);
const blocked = computed(
  () => compactViewport.value && touchFirstDevice.value,
);

let compactViewportQuery: MediaQueryList | undefined;
let touchFirstQuery: MediaQueryList | undefined;

const syncMediaQueries = (): void => {
  compactViewport.value = compactViewportQuery?.matches ?? false;
  touchFirstDevice.value = touchFirstQuery?.matches ?? false;
};

watch(
  blocked,
  (value) => emit("blocked-change", value),
  { immediate: true },
);

onMounted(() => {
  if (typeof window.matchMedia !== "function") return;

  compactViewportQuery = window.matchMedia("(max-width: 1024px)");
  touchFirstQuery = window.matchMedia(
    "(hover: none) and (pointer: coarse)",
  );
  compactViewportQuery.addEventListener("change", syncMediaQueries);
  touchFirstQuery.addEventListener("change", syncMediaQueries);
  syncMediaQueries();
});

onBeforeUnmount(() => {
  compactViewportQuery?.removeEventListener("change", syncMediaQueries);
  touchFirstQuery?.removeEventListener("change", syncMediaQueries);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="mobile-unsupported">
      <div
        v-if="blocked"
        class="mobile-unsupported-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-unsupported-title"
        aria-describedby="mobile-unsupported-description"
      >
        <section class="mobile-unsupported-card">
          <img src="/ze-tour-icon.svg" alt="" aria-hidden="true" />
          <p class="eyebrow">Mobile pit stop</p>
          <h2 id="mobile-unsupported-title">Sorry, rider.</h2>
          <p id="mobile-unsupported-description">
            Ze Tour is not available on mobile.
          </p>
          <strong>Open Ze Tour on a desktop or laptop to ride.</strong>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
